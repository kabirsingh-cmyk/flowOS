// FlowOS — LinkedIn posting via Zernio
// Actions: resolve_author (→ resolve_authors), publish_now
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("linkedin", { resolveAction: "resolve_author" });
