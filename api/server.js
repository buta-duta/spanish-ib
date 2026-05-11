import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const maxDuration = 120;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, "../artifacts/api-server/dist/vercel-app.js");
const { default: app } = await import(pathToFileURL(bundlePath).href);

export default app;
