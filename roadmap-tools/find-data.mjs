// READ-ONLY: locate where the question data actually lives on the cluster.
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

try {
  await connect();
  const admin = mongoose.connection.db.admin();
  const { databases } = await admin.listDatabases();
  const report = [];
  for (const d of databases) {
    if (["admin", "local", "config"].includes(d.name)) continue;
    const db = mongoose.connection.client.db(d.name);
    const cols = await db.listCollections().toArray();
    const colInfo = [];
    for (const c of cols) {
      const n = await db.collection(c.name).estimatedDocumentCount();
      colInfo.push([c.name, n]);
    }
    report.push({ db: d.name, sizeOnDiskMB: Math.round((d.sizeOnDisk || 0) / 1e6), collections: colInfo });
  }
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.error("FIND_ERROR:", e.name, "-", e.message);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect().catch(() => {});
}
