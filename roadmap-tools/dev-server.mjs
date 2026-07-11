// Dev launcher that lets the Next app reach Atlas in sandboxes where mongodb+srv
// SRV DNS is blocked: it resolves MONGODB_URI to a direct seed list in-process
// (credential never printed) and hands it to `next dev` via the child env.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import { resolveDirectUri } from "./connect.mjs";

function readEnvFile(file) {
  const out = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = readEnvFile(".env");
const uri = process.env.MONGODB_URI || env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || env.MONGODB_DB || "dsa-tracker";
if (!uri) { console.error("dev-server: no MONGODB_URI in env or .env"); process.exit(1); }

const direct = await resolveDirectUri(uri);
console.log(`dev-server: resolved DB connection (${direct.split("@")[1]?.split("/")[0]?.split(",").length || 0} hosts), db="${dbName}"`);

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
// No -p flag: Next reads the PORT env var the preview harness assigns.
const child = spawn(process.execPath, [nextBin, "dev"], {
  env: { ...process.env, MONGODB_URI: direct, MONGODB_DB: dbName },
  stdio: "inherit",
});
child.on("exit", (c) => process.exit(c ?? 0));
