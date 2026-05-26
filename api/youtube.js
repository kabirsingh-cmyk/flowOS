// FlowOS — YouTube posting via Zernio (Shorts + long-form)
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("youtube");
