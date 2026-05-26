// FlowOS — Facebook posting via Zernio
// Actions: resolve_pages (→ resolve_authors), publish_now
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("facebook", { resolveAction: "resolve_pages" });
