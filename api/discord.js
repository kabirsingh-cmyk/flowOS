// FlowOS — Discord posting via Zernio
// Zernio requires platformSpecificData.channelId — passed through via body spread.
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("discord");
