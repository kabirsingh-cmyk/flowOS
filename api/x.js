// FlowOS — X (Twitter) posting via Zernio
// Actions: publish_now (text ≤ 280 chars; video posts may omit text)
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("x", {
  validate: (action, body) => {
    if (action !== "publish_now") return null;
    // Video posts don't require text; skip the length check when videoUrl is set.
    if (body.videoUrl) return null;
    if (body.text && body.text.length > 280) return "text exceeds 280 chars";
    return null;
  },
});
