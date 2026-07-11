import dns from "node:dns";
import mongoose from "mongoose";

/**
 * Cached Mongoose connection.
 *
 * In development, Next.js clears the Node module cache on every request which
 * would otherwise create a new database connection on each hot reload and
 * exhaust the connection pool. We cache the connection on the Node global.
 */

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Optional DNS override. Some local/corporate networks (notably certain
 * Windows setups) refuse the SRV lookups that `mongodb+srv://` requires,
 * producing `querySrv ECONNREFUSED`. Setting MONGODB_DNS to a public resolver
 * (e.g. "8.8.8.8,1.1.1.1") fixes it. Not needed on Vercel, so leave it unset
 * in production.
 */
if (process.env.MONGODB_DNS) {
  const servers = process.env.MONGODB_DNS.split(",").map((s) => s.trim()).filter(Boolean);
  if (servers.length) {
    try {
      dns.setServers(servers);
    } catch {
      // Ignore invalid overrides and fall back to the system resolver.
    }
  }
}

const CONNECT_OPTS: mongoose.ConnectOptions = {
  dbName: process.env.MONGODB_DB || undefined,
  bufferCommands: false,
  serverSelectionTimeoutMS: 8000,
  // Serverless-safe pool: cap connections so many concurrent function
  // instances don't exhaust the Atlas connection limit.
  maxPoolSize: 10,
  minPoolSize: 0,
  socketTimeoutMS: 45000,
};

/** True when the error is a DNS/SRV-resolution failure (not auth/timeout). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSrvDnsError(err: any): boolean {
  const s = `${err?.syscall ?? ""} ${err?.code ?? ""} ${err?.message ?? ""}`;
  return /querySrv|queryTxt|ECONNREFUSED|ENOTFOUND|ESERVFAIL|EAI_AGAIN|ETIMEOUT/i.test(s);
}

/**
 * Resolve a `mongodb+srv://` URI to a direct `mongodb://` seed list using
 * DNS-over-HTTPS (port 443). This is the last-resort fallback for networks that
 * block/refuse ordinary SRV DNS (UDP/53) — the app then connects to the Atlas
 * shards directly. The credential stays in-process and is never logged.
 */
async function resolveViaDoH(uri: string): Promise<string> {
  const u = new URL(uri);
  if (u.protocol !== "mongodb+srv:") return uri;
  const host = u.hostname;

  const doh = async (name: string, type: string) => {
    const r = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!r.ok) throw new Error(`DoH ${type} HTTP ${r.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await r.json()) as any).Answer || [];
  };

  const srv = await doh(`_mongodb._tcp.${host}`, "SRV");
  if (!srv.length) throw new Error("DoH returned no SRV records for " + host);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hosts = srv.map((a: any) => {
    const p = String(a.data).trim().replace(/\.$/, "").split(/\s+/);
    return `${p[3]}:${p[2]}`; // "prio weight port target" -> "target:port"
  });

  const opts = new URLSearchParams();
  const txt = await doh(host, "TXT").catch(() => []);
  if (txt[0]?.data) {
    const raw = String(txt[0].data).replace(/^"|"$/g, "").replace(/\\u0026/g, "&");
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

async function connectWithFallback(uri: string): Promise<typeof mongoose> {
  try {
    return await mongoose.connect(uri, CONNECT_OPTS);
  } catch (err) {
    if (uri.startsWith("mongodb+srv://") && isSrvDnsError(err)) {
      // eslint-disable-next-line no-console
      console.warn("[db] SRV DNS failed; retrying via DNS-over-HTTPS direct seed list");
      const direct = await resolveViaDoH(uri);
      return await mongoose.connect(direct, CONNECT_OPTS);
    }
    throw err;
  }
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
if (!global._mongooseCache) global._mongooseCache = cache;

/**
 * Connect to MongoDB, reusing an existing connection when available.
 * Throws a descriptive error when the connection string is missing so API
 * routes can return a clean 500 instead of an opaque crash.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not defined. Add it to .env.local (see .env.local.example).",
    );
  }

  if (!cache.promise) {
    cache.promise = connectWithFallback(MONGODB_URI);
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

/** True when a MongoDB URI is configured (used to short-circuit gracefully). */
export function isDBConfigured(): boolean {
  return Boolean(MONGODB_URI);
}
