// FlowOS — Reddit posting via Zernio
// Actions: search_subreddits (stub), publish_now (subreddit + title + text)
import { createPlatformHandler } from "./lib/platformPublisher.js";
import { jsonResponse } from "./lib/cors.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("reddit", {
  extraActions: {
    // Subreddit search is now handled via Zernio's community discovery API.
    // The UI renders a free-text input so this stub keeps things working while
    // a future iteration wires the Zernio endpoint.
    search_subreddits: () => jsonResponse({ ok: true, subreddits: [] }),
  },
});
