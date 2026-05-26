// FlowOS — Instagram posting via Zernio
// Actions: resolve_accounts (→ resolve_authors), publish_now
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("instagram", { resolveAction: "resolve_accounts" });
