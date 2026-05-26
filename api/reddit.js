// FlowOS — Reddit posting via Zernio
// Actions: search_subreddits (Reddit public API proxy), publish_now
import { createPlatformHandler } from "./lib/platformPublisher.js";
import { jsonResponse } from "./lib/cors.js";
export const config = { runtime: "edge" };

export default createPlatformHandler("reddit", {
  extraActions: {
    search_subreddits: async (body) => {
      const q = (body.query || "").trim();
      if (!q) return jsonResponse({ ok: true, subreddits: [] });
      try {
        const res = await fetch(
          `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(q)}&limit=8&include_over_18=false`,
          { headers: { "User-Agent": "FlowOS/1.0 (+https://flowos.ai)" } }
        );
        if (!res.ok) return jsonResponse({ ok: true, subreddits: [] });
        const data = await res.json();
        const subreddits = (data?.data?.children || []).map(c => ({
          name: c.data.display_name,
          title: c.data.title,
          subscribers: c.data.subscribers,
        }));
        return jsonResponse({ ok: true, subreddits });
      } catch {
        return jsonResponse({ ok: true, subreddits: [] });
      }
    },
  },
});
