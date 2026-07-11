// READ-ONLY: real tag vocabulary + current pattern state, to design the classifier.
import mongoose from "mongoose";
import { connect } from "./connect.mjs";
try {
  await connect();
  const col = mongoose.connection.db.collection("questions");
  const total = await col.countDocuments({});
  const withPattern = await col.countDocuments({ pattern: { $nin: ["", null] } });
  const withPatternsArr = await col.countDocuments({ "patterns.0": { $exists: true } });
  const topTags = await col.aggregate([
    { $unwind: "$tags" },
    { $group: { _id: "$tags", n: { $sum: 1 } } },
    { $sort: { n: -1 } }, { $limit: 90 },
  ]).toArray();
  console.log(JSON.stringify({
    total, withPattern, withPatternsArr,
    topTags: topTags.map((t) => [t._id, t.n]),
  }, null, 1));
} catch (e) { console.error("ERR", e.message); process.exitCode = 2; }
finally { await mongoose.disconnect().catch(() => {}); }
