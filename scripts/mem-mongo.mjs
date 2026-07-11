/**
 * Zero-install local MongoDB for development.
 *
 * Starts an in-memory MongoDB on a fixed port (27017) so the app's default
 * `MONGODB_URI` (mongodb://127.0.0.1:27017/dsa-tracker) connects with no setup.
 * The first run downloads a small MongoDB binary into a local cache.
 *
 * Usage:  npm run db:mem     (leave running, then `npm run dev` in another shell)
 *
 * NOTE: data is stored in-memory and is cleared when this process exits.
 * For persistent data, use a real MongoDB (local install or MongoDB Atlas).
 */
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 27017;

const server = await MongoMemoryServer.create({
  instance: { port: PORT, dbName: "dsa-tracker" },
});

console.log("\n✔ In-memory MongoDB ready:");
console.log(`  ${server.getUri()}`);
console.log("  Leave this running, then start the app with `npm run dev`.\n");

async function shutdown() {
  await server.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process alive.
setInterval(() => {}, 1 << 30);
