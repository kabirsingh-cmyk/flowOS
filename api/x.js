// FlowOS — X (Twitter) posting via Zernio
// Actions: publish_now (text ≤ 280 chars enforced)
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("x", {
  validate: (action, body) =>
    action === "publish_now" && body.text && body.text.length > 280
      ? "text exceeds 280 chars"
      : null,
});
