// READ-ONLY inspection of the live MongoDB. No writes of any kind.
// Run: node --env-file=.env roadmap-tools/inspect.mjs
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

const DASHBOARD_TOPICS = ["Arrays","Strings","Linked List","Stack","Queue","Trees","Graph",
  "Dynamic Programming","Greedy","Binary Search","Recursion","Heap","Bit Manipulation",
  "Mathematics","Number Theory","Geometry","Miscellaneous"];

const out = {};
try {
  await connect();
  const db = mongoose.connection.db;
  out.connectedTo = db.databaseName;
  out.collections = (await db.listCollections().toArray()).map((c) => c.name);
  const col = db.collection("questions");

  out.total = await col.countDocuments({});
  const grp = async (field) =>
    (await col.aggregate([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray())
      .map((r) => [r._id, r.n]);

  out.byPlatform = await grp("platform");
  out.byDifficulty = await grp("difficulty");
  out.byStatus = await grp("status");
  out.byTopic = await grp("topic");
  out.byPattern = await grp("pattern");

  out.flags = {
    favoriteTrue: await col.countDocuments({ favorite: true }),
    revisionNeededTrue: await col.countDocuments({ revisionNeeded: true }),
    archivedTrue: await col.countDocuments({ archived: true }),
    solvedAtSet: await col.countDocuments({ solvedAt: { $ne: null } }),
    companiesNonEmpty: await col.countDocuments({ "companies.0": { $exists: true } }),
    tagsNonEmpty: await col.countDocuments({ "tags.0": { $exists: true } }),
    ratingSet: await col.countDocuments({ rating: { $gt: 0 } }),
    interviewLevelSet: await col.countDocuments({ interviewLevel: { $nin: ["", null] } }),
  };

  out.companiesPresent = (await col.aggregate([
    { $unwind: "$companies" },
    { $group: { _id: "$companies", n: { $sum: 1 } } },
    { $sort: { n: -1 } }, { $limit: 30 },
  ]).toArray()).map((r) => [r._id, r.n]);

  out.topicsInDashboardList = await col.countDocuments({ topic: { $in: DASHBOARD_TOPICS } });
  out.topicsNotInList = out.total - out.topicsInDashboardList;
  out.distinctTopicCount = (await col.distinct("topic")).length;

  // One sample doc, with any free-text fields trimmed so nothing sensitive/large prints.
  const s = await col.findOne({});
  out.sampleKeys = s ? Object.keys(s) : [];
  out.sample = s ? {
    _id: String(s._id), title: s.title, platform: s.platform, difficulty: s.difficulty,
    topic: s.topic, subtopic: s.subtopic, pattern: s.pattern, status: s.status,
    companies: s.companies, tags: s.tags, rating: s.rating, favorite: s.favorite,
    isStriverQuestion: s.isStriverQuestion, striverStep: s.striverStep,
  } : null;

  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error("INSPECT_ERROR:", e.name, "-", e.message);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect().catch(() => {});
}
