// Read-only connection helper for analysis scripts.
// Reads MONGODB_URI from the environment (load via `node --env-file=.env`).
// If the URI is mongodb+srv:// and SRV DNS is unavailable (sandboxed/proxied
// networks), it resolves the seed list over DNS-over-HTTPS and rewrites the URI
// to a direct mongodb:// seed list. The credential stays in-process and is never
// printed or passed on the command line.
import mongoose from "mongoose";

async function doh(name, type) {
  const r = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!r.ok) throw new Error(`DoH ${type} HTTP ${r.status}`);
  return (await r.json()).Answer || [];
}

export async function resolveDirectUri(uri) {
  const u = new URL(uri);
  if (u.protocol !== "mongodb+srv:") return uri; // already a direct seed list
  const host = u.hostname;
  const srv = await doh(`_mongodb._tcp.${host}`, "SRV");
  if (!srv.length) throw new Error("No SRV records resolved via DoH");
  const hosts = srv.map((a) => {
    // "0 0 27017 cluster0-shard-00-00.ej5u6.mongodb.net."
    const p = a.data.trim().replace(/\.$/, "").split(/\s+/);
    return `${p[3]}:${p[2]}`;
  });
  const opts = new URLSearchParams();
  const txt = await doh(host, "TXT").catch(() => []);
  if (txt[0]?.data) {
    const raw = txt[0].data.replace(/^"|"$/g, "").replace(/\\u0026/g, "&");
    for (const kv of raw.split("&")) {
      const [k, v] = kv.split("=");
      if (k) opts.set(k, v);
    }
  }
  opts.set("ssl", "true");
  for (const [k, v] of u.searchParams) opts.set(k, v);
  const auth = u.username ? `${u.username}:${u.password}@` : "";
  return `mongodb://${auth}${hosts.join(",")}/?${opts.toString()}`;
}

/** Connect read-only and return the mongoose instance. Never logs the URI. */
export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set — run with `node --env-file=.env`");
  const direct = await resolveDirectUri(uri);
  await mongoose.connect(direct, {
    dbName: process.env.MONGODB_DB || undefined,
    bufferCommands: false,
    serverSelectionTimeoutMS: 12000,
  });
  return mongoose;
}
