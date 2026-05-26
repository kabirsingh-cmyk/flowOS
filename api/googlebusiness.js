// FlowOS — Google Business posting via Zernio
// FlowOS id: gbusiness → Zernio slug: googlebusiness (resolved by resolvePlatform() in zernio.js)
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("gbusiness");
