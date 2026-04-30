// MVEDA Chat-OS seed: channels, specialists, briefing, prompts

const SPECIALISTS = [
  { id: "supervisor", name: "Supervisor",  role: "Orchestrates everything",        glyph: "S", color: "var(--ink)" },
  { id: "drafter",    name: "Drafter",     role: "Writes posts, emails, captions", glyph: "D", color: "oklch(50% 0.12 80)" },
  { id: "analyst",    name: "Analyst",     role: "Pulls metrics, explains numbers",glyph: "A", color: "oklch(50% 0.12 240)" },
  { id: "inbox",      name: "Inbox",       role: "Triages comments + DMs",         glyph: "I", color: "oklch(54% 0.14 160)" },
  { id: "brandguard", name: "Brand Guard", role: "Checks tone, claims, policy",    glyph: "B", color: "oklch(48% 0.16 25)" },
];

const CHANNELS = [
  { kind: "personal", id: "ch_you",      name: "You + Supervisor", sub: "Your private thread",      icon: "dot",     unread: 0 },
  { kind: "personal", id: "ch_morning",  name: "Morning briefing", sub: "Daily standup",            icon: "spark",   unread: 1 },
  { kind: "team",     id: "ch_team",     name: "#marketing-team",  sub: "Greg, Ana, Priya, Sam",    icon: "grid",    unread: 3 },
  { kind: "team",     id: "ch_launches", name: "#launches",        sub: "Stride 03 · ongoing",      icon: "flash",   unread: 0 },
  { kind: "team",     id: "ch_creative", name: "#creative",        sub: "Drafter outputs, reviews", icon: "edit",    unread: 2 },
  { kind: "team",     id: "ch_paid",     name: "#paid-channels",   sub: "Google + Meta Ads",        icon: "target",  unread: 0 },
  { kind: "team",     id: "ch_alerts",   name: "#alerts",          sub: "Anomalies, escalations",   icon: "bell",    unread: 1 },
];

// Briefing — a structured "morning standup" message
const BRIEFING = {
  date: "Friday · Apr 25",
  greeting: "Good morning, Greg.",
  overnight: [
    { kind: "ok",   text: "Tuesday's Hair Mist carousel published 8:00 BST. 14.2k reach, +38% vs your IG median." },
    { kind: "ok",   text: "Klaviyo · MV Tribe weekly drop sent to 24,108. 41.2% open, 6.7% click — both above last 4-week average." },
    { kind: "warn", text: "1 anomaly: TikTok 'morning serum unboxing' is pacing -22% vs UGC norm. Not yet boostable; Analyst is pulling comparison." },
    { kind: "ok",   text: "Brand Guard auto-rejected 1 caption (claimed 'clinically proven'). Drafter rewrote in your voice; awaiting your review." },
  ],
  needsYou: [
    { id: "n1", title: "3 approvals pending", sub: "Night Serum email · Pmax keywords · Body Oil ad creative", action: "Review queue" },
    { id: "n2", title: "Pre-launch decision: Hair Ritual",  sub: "Should I move the IG hero from Wed → Thu? CTR forecast +14%", action: "Decide" },
    { id: "n3", title: "Inbox: 1 escalation",  sub: "DM from @ananyaverma — refund request, day 32",       action: "Open" },
  ],
  suggestedMoves: [
    "Recommend a channel mix for the next quarter",
    "Plan next week's content (Apr 27 → May 3) — I have a draft ready",
    "Draft Mother's Day email for MV Tribe",
    "Pull last 30d ROAS by channel and explain the dip on Meta",
  ],
};

// Pre-loaded conversation in #marketing-team — shows team using the AI together
const TEAM_THREAD = [
  { kind: "user",   author: "Ana",     time: "08:42", text: "Anyone heard back from the saffron supplier on the May restock?" },
  { kind: "user",   author: "Priya",   time: "08:43", text: "Not yet. Supervisor — can you draft a follow-up that doesn't sound pushy?" },
  { kind: "agent",  author: "Drafter", time: "08:44", text: "On it — pulling your last 3 supplier emails for tone match. Back in a moment." },
  { kind: "agent",  author: "Drafter", time: "08:46", artifact: { type: "email", title: "Follow-up · Kashmir saffron May restock", subject: "Following up · May restock", body: "Hi Imran,\n\nHope the season's been kind. Just circling back on the May restock — are we still on track for the 14kg I noted in our last call? No rush; just want to align our launch window with your harvest.\n\nWith care,\nPriya · MVEDA" } },
  { kind: "user",   author: "Priya",   time: "08:47", text: "Perfect. Send it." },
  { kind: "system", author: "Supervisor", time: "08:47", text: "Held for confirmation — sending email requires explicit approval (autonomy: assisted). Confirm to send.", confirm: { yes: "Send to Imran", no: "Keep as draft" } },
];

// Pre-loaded thread in You + Supervisor — earlier today
const PERSONAL_HISTORY = [
  { kind: "user",   author: "Greg", time: "07:58", text: "Morning. What's the status on Stride 03 — wait, that's not us. Hair Ritual launch." },
  { kind: "agent",  author: "Supervisor", time: "07:58", text: "Hair Ritual launches Tue Apr 29. Currently 6 of 9 assets approved, 2 in policy review, 1 in drafting. Want me to walk through the queue?" },
  { kind: "user",   author: "Greg", time: "07:59", text: "Just the policy ones." },
  { kind: "agent",  author: "Brand Guard", time: "07:59", text: "Two items flagged:", artifact: { type: "policy-review", items: [
    { title: "Pmax · Hair Oil set keywords", flag: "Disallowed term: 'clinically proven'", suggestion: "Replace with 'tested in our atelier' (matches approved claims)" },
    { title: "Klaviyo Night Serum flow #3",  flag: "Discount language ('exclusive offer')", suggestion: "Reframe as 'first access for the tribe'" },
  ]}},
  { kind: "user",   author: "Greg", time: "08:01", text: "Fix both, send back for review." },
  { kind: "agent",  author: "Supervisor", time: "08:01", text: "Done. Drafter is rewriting now; Brand Guard will re-check. ETA 4 minutes." },
];

// Suggested prompts for empty input
const SUGGESTIONS = [
  { icon: "target",   label: "Recommend a channel mix",        payload: "Recommend a channel mix and budget split" },
  { icon: "calendar", label: "Plan next week's content",       payload: "Plan content for Apr 27 → May 3" },
  { icon: "edit",     label: "Draft a post for the Hair Mist", payload: "Draft 3 IG captions for Hair Mist, ritual tone" },
  { icon: "chart",    label: "Why is Meta Ads ROAS down?",     payload: "Pull last 30d ROAS by channel and explain the Meta dip" },
  { icon: "inbox",    label: "Triage today's inbox",           payload: "Show me the inbox queue ranked by urgency" },
  { icon: "target",   label: "Set up a Google Ads campaign",   payload: "Set up a Pmax campaign for Body Oil, $200/day" },
  { icon: "shield",   label: "Update brand voice rules",       payload: "Add 'never use the word effortless' to Brand Memory" },
  { icon: "send",     label: "Schedule an SMS to VIPs",        payload: "Schedule an SMS for the MV Tribe drop reminder" },
  { icon: "search",   label: "Show SEO opportunities",         payload: "Show SEO keyword opportunities and waiting briefs" },
  { icon: "target",   label: "Affiliate · who's converting?",  payload: "Show affiliate partners and MTD payouts" },
  { icon: "spark",    label: "Retention dashboard",            payload: "Show retention dashboard — RPR, replenishment, churn" },
  { icon: "bell",     label: "CX signals · returns spike",     payload: "Any CX signals or returns spikes I should know about?" },
  { icon: "calendar", label: "BFCM playbook readiness",        payload: "Walk me through BFCM playbook and capacity plan" },
  { icon: "sliders",  label: "Split-test the Hair Mist email", payload: "Set up an A/B test on the Hair Mist email subject" },
  { icon: "shield",   label: "Invite the agency · comment-only",payload: "Invite our agency as a guest with comment-only on paid channels" },
  { icon: "chart",    label: "Should I run 15% off?",          payload: "Should I run 15% off on Body Oil this weekend? Simulate margin." },
  { icon: "list",     label: "Open the mobile preview",        payload: "Open the mobile inbox + approval view" },
  { icon: "calendar", label: "Schedule this week's IG posts",   payload: "Schedule this week's Instagram posts and Reels" },
  { icon: "spark",    label: "Generate a TikTok caption",       payload: "Write 3 TikTok captions for the Hair Mist launch" },
  { icon: "send",     label: "Plan Pinterest for the month",    payload: "Plan a month of Pinterest pins for the Body Oil collection" },
  { icon: "edit",     label: "Draft a YouTube Short script",    payload: "Draft a 60s YouTube Shorts script for the Hair Ritual routine" },
  { icon: "chart",    label: "Best time to post this week",     payload: "What are the best posting times this week by platform?" },
  { icon: "target",   label: "Generate image with Runware",     payload: "Generate a product image for the Hair Mist using Runware" },
];

// Canvas presets — what artifacts can render in the right pane
// Each chat message can carry artifact: { type, ... } → opens canvas

Object.assign(window, { SPECIALISTS, CHANNELS, BRIEFING, TEAM_THREAD, PERSONAL_HISTORY, SUGGESTIONS });
