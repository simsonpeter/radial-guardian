import path from "path";
import { fileURLToPath } from "url";
import { TwaGenerator, TwaManifest, ConsoleLog } from "@bubblewrap/core";

console.log("loading twa-manifest");
const dir = path.dirname(fileURLToPath(import.meta.url));
const manifest = await TwaManifest.fromFile(path.join(dir, "twa-manifest.json"));
console.log("loaded", manifest.packageId, manifest.iconUrl);
const error = manifest.validate();
if (error) {
  throw new Error(error);
}
console.log("generating project");
const generator = new TwaGenerator();
await generator.createTwaProject(dir, manifest, new ConsoleLog("twa"));
console.log("TWA project generated in", dir);
