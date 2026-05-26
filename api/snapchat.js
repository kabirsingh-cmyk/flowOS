// FlowOS — Snapchat posting via Zernio
import { createPlatformHandler } from "./lib/platformPublisher.js";
export const config = { runtime: "edge" };
export default createPlatformHandler("snapchat");
