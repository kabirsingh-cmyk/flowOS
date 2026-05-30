#!/usr/bin/env python3
# FlowOS — Python dev server
# Serves static files + proxies Anthropic API (keeps the key server-side)
# Falls back to simulation if ANTHROPIC_API_KEY is not set
# Usage: ANTHROPIC_API_KEY=sk-ant-... python3 server.py

import json
import mimetypes
import os
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT_DIR = Path(__file__).parent
PORT = int(os.environ.get("PORT", 8765))


class FlowOSHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Suppress per-request noise; keep errors
        if args and str(args[1]) not in ("200", "304"):
            super().log_message(fmt, *args)

    # ── Static file serving ────────────────────────────────────────────────
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/":
            path = "/index.html"

        file_path = PROJECT_DIR / path.lstrip("/")

        # Guard against path traversal
        try:
            file_path.resolve().relative_to(PROJECT_DIR.resolve())
        except ValueError:
            self._send(403, "text/plain", b"Forbidden")
            return

        if file_path.exists() and file_path.is_file():
            mime, _ = mimetypes.guess_type(str(file_path))
            mime = mime or "application/octet-stream"
            # Babel needs correct MIME for JSX files served as JS
            if file_path.suffix == ".jsx":
                mime = "text/javascript"
            data = file_path.read_bytes()
            self._send(200, mime, data)
        else:
            self._send(404, "text/plain", b"Not found")

    # ── API ────────────────────────────────────────────────────────────────
    def do_POST(self):
        if self.path != "/api/chat":
            self._send(404, "text/plain", b"Not found")
            return

        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length))
        except Exception:
            self._send(400, "text/plain", b"Bad JSON")
            return

        api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()

        if not api_key:
            self._send(200, "application/json", json.dumps({"type": "fallback"}).encode())
            return

        self._proxy_claude(body, api_key)

    # ── Claude proxy with SSE passthrough ─────────────────────────────────
    def _proxy_claude(self, body, api_key):
        messages   = body.get("messages", [])
        specialist = body.get("specialist", "supervisor")

        request_body = {
            "model":      "claude-opus-4-7",
            "max_tokens": 1024,
            "system":     SYSTEM_PROMPTS.get(specialist, SYSTEM_PROMPTS["supervisor"]),
            "messages":   messages,
            "tools":      TOOLS if specialist == "supervisor" else [t for t in TOOLS if t["name"] != "delegate_to"],
            "stream":     True,
        }

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(request_body).encode(),
            headers={
                "x-api-key":          api_key,
                "anthropic-version":  "2023-06-01",
                "content-type":       "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req) as resp:
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "keep-alive")
                self.end_headers()
                while True:
                    chunk = resp.read(512)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            self._send(502, "application/json", json.dumps({"type": "error", "message": err}).encode())
        except Exception as e:
            self._send(502, "application/json", json.dumps({"type": "error", "message": str(e)}).encode())

    # ── Helper ─────────────────────────────────────────────────────────────
    def _send(self, code, mime, data):
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


# ─── System prompts ────────────────────────────────────────────────────────
SYSTEM_PROMPTS = {
  "supervisor": """You are Supervisor — the orchestrating AI for FlowOS, a marketing operating system for DTC beauty and wellness brands.

ROLE
You are the operator's strategic partner. You triage requests, route tasks to specialist AIs, and synthesise insights into clear, direct recommendations.

BRAND CONTEXT (MVEDA default)
- Brand: MVEDA Ayurvedic luxury skincare. Ritual-forward, quiet luxury, sensory.
- Products: Hair Mist, Night Serum, Body Oil, Hair Ritual kit, Honey & Vanilla Body Oil.
- Channels: Instagram, TikTok, Email (Klaviyo), SMS (Postscript), Google Pmax, Meta Advantage+.
- Prohibited claims: "clinically proven", "anti-aging", "effortless", "game-changer".
- Voice: sparse, editorial, unhurried. Ayurvedic references welcome. Never exclamation marks.

SPECIALIST TEAM
- Drafter: writes posts, emails, captions, SMS, ad copy in brand voice
- Analyst: pulls metrics, explains ROAS, cohort data, budget forecasts
- Brand Guard: policy checks, claim validation, platform compliance, tone review
- Inbox: triages DMs, comments, escalations, drafts replies

ROUTING RULES
Use the delegate_to tool when:
- The user wants copy written → delegate to "drafter"
- The user wants data, metrics, or analysis → delegate to "analyst"
- The user wants policy/compliance review → delegate to "brand_guard"
- The user wants inbox/DM triage → delegate to "inbox"

Handle directly (no delegation) when:
- Strategic questions about channels, budgets, sequencing
- Status updates, scheduling decisions
- Opening workspace views (use open_workspace tool)

BEHAVIOUR
- Be direct. Lead with the answer.
- Brief — operators are busy. One clear recommendation.
- When delegating, say in one sentence what you're doing and why.
- Use open_workspace when a canvas view would help.""",

  "drafter": """You are Drafter — the content AI for FlowOS.

You write in the brand's voice: ritual-forward, sensory, quiet luxury.

VOICE RULES
- Short sentences. No exclamation marks.
- Sensory and specific — reference texture, scent, ritual, time of day.
- Ayurvedic references welcome: doshas, oils, herbs, seasons.
- Prohibited: "clinically proven", "anti-aging", "effortless", "game-changer", "revolutionary".
- Never generic. Always specific to MVEDA's products and rituals.

OUTPUT BY FORMAT
- IG captions: 3 variants, each under 150 chars, different angles/hooks. No hashtag lists.
- Email: subject line + preview text + body. Open with the ritual moment, not a greeting.
- SMS: under 160 chars, conversational.
- Ad copy: punchy headline + 2 lines body.

Use the show_drafts tool to display your output so it renders in the canvas for review.
Output clean copy only — no preamble, just the work.""",

  "analyst": """You are Analyst — the data AI for FlowOS.

You interpret marketing performance, surface insights, and explain numbers clearly.

CHANNEL BENCHMARKS (MVEDA)
- Email (Klaviyo): open rate benchmark 38%, click rate 5.8%
- IG organic: avg reach 12,400, median engagement 4.2%
- Meta Advantage+: target ROAS 3.5x, frequency warning at 3.5+
- Google Pmax: target ROAS 4.0x

BEHAVIOUR
- Lead with the number, then the implication, then one action.
- If a metric is anomalous, name the likely cause.
- One recommendation per insight.
- Use show_metric for key numbers that deserve canvas prominence.""",

  "brand_guard": """You are Brand Guard — the policy and tone AI for FlowOS.

PROHIBITED CLAIMS
- "clinically proven", "dermatologist tested", "anti-aging", "scientifically formulated"
- Specific % results without substantiation

PROHIBITED WORDS
- "effortless", "game-changer", "revolutionary"
- Superlatives without evidence

APPROVED ALTERNATIVES
- "clinically proven" → "tested in our atelier"
- "anti-aging" → "lasting" or "over time"

For each issue: Flag → Rule → Fix (exact replacement copy).
If copy is clean, say so briefly.""",

  "inbox": """You are Inbox — the customer communications AI for FlowOS.

TRIAGE LEVELS
- Urgent: refund requests, product safety, press enquiries
- Standard: delivery questions, product recommendations, feedback
- Low: compliments, general engagement

BRAND VOICE IN REPLIES
- Warm but not gushing. Specific, not generic.
- Acknowledge the person, then the issue.

Output: triage classification → suggested reply → flag if human review needed.""",
}

# ─── Tools ────────────────────────────────────────────────────────────────
TOOLS = [
    {
        "name": "delegate_to",
        "description": "Route this task to the appropriate specialist AI.",
        "input_schema": {
            "type": "object",
            "properties": {
                "specialist": {
                    "type": "string",
                    "enum": ["drafter", "analyst", "brand_guard", "inbox"],
                },
                "context": { "type": "string" },
            },
            "required": ["specialist", "context"],
        },
    },
    {
        "name": "open_workspace",
        "description": "Open a workspace view in the canvas panel.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "enum": ["planner","inbox","memory","insights","connections","autonomy","sms","seo","affiliate","retention","cx","seasonal","abtests","team","discounts","mobile"],
                },
            },
            "required": ["target"],
        },
    },
    {
        "name": "show_drafts",
        "description": "Display draft content items in the canvas for review.",
        "input_schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title":   { "type": "string" },
                            "channel": { "type": "string" },
                        },
                        "required": ["title"],
                    },
                },
            },
            "required": ["items"],
        },
    },
    {
        "name": "show_metric",
        "description": "Display a key metric in the canvas.",
        "input_schema": {
            "type": "object",
            "properties": {
                "label": { "type": "string" },
                "value": { "type": "string" },
                "delta": { "type": "string" },
                "note":  { "type": "string" },
            },
            "required": ["label", "value"],
        },
    },
]


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), FlowOSHandler)
    has_key = bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())
    print(f"FlowOS server → http://127.0.0.1:{PORT}/index.html")
    print(f"AI mode: {'Claude (live)' if has_key else 'simulation (set ANTHROPIC_API_KEY to go live)'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
