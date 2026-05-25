// FlowOS — one-time dev helper to register the Zernio webhook.
//
// Call this endpoint after deploying to a new environment (or after changing
// the webhook URL) to tell Zernio where to deliver events.
//
// Usage:
//   curl http://localhost:8765/api/dev/register-zernio-webhook
//
// Hard-gated on VERCEL_ENV !== "production" — 404s in prod so it cannot be
// used to mutate Zernio configuration on the live stack.

export const config = { runtime: "edge" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req) {
  if (process.env.VERCEL_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }

  const apiKey = process.env.ZERNIO_API_KEY;
  const webhookSecret = process.env.ZERNIO_WEBHOOK_SECRET;
  const origin =
    process.env.APP_ORIGIN ||
    `https://${req.headers.get("host") || "localhost"}`;

  if (!apiKey) {
    return json({ ok: false, error: "ZERNIO_API_KEY not set" }, 400);
  }
  if (!webhookSecret) {
    return json({ ok: false, error: "ZERNIO_WEBHOOK_SECRET not set" }, 400);
  }

  const payload = {
    url: `${origin}/api/webhooks/zernio`,
    events: [
      "message.received",
      "comment.received",
      "reaction.received",
      "review.new",
      "post.published",
      "post.failed",
    ],
    secret: webhookSecret,
  };

  const res = await fetch("https://api.zernio.io/v1/webhooks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    return json(
      {
        ok: false,
        error:
          data?.error ||
          data?.message ||
          `Zernio ${res.status}: ${text.slice(0, 300)}`,
      },
      res.status,
    );
  }

  return json({ ok: true, zernio: data });
}
