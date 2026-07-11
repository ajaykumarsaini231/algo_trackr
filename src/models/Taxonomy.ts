import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Custom taxonomy stores. The built-in topics/companies/patterns live in
 * `lib/constants.ts`; these collections hold any EXTRA entries an admin adds,
 * which the API merges with the constants. Keeping them separate means the
 * curated defaults can never be accidentally overwritten.
 */

const TopicSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "Boxes" },
    subtopics: { type: [String], default: [] },
    custom: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "topics" },
);

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, index: true },
    custom: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "companies" },
);

const PatternSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, index: true },
    icon: { type: String, default: "Sparkles" },
    custom: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "patterns" },
);

/** Optional snapshot cache of computed statistics (collection: statistics). */
const StatisticsSchema = new Schema(
  {
    key: { type: String, default: "snapshot", unique: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "statistics" },
);

export type TopicDoc = InferSchemaType<typeof TopicSchema>;
export type CompanyDoc = InferSchemaType<typeof CompanySchema>;
export type PatternDoc = InferSchemaType<typeof PatternSchema>;
export type StatisticsDoc = InferSchemaType<typeof StatisticsSchema>;

export const TopicModel: Model<TopicDoc> =
  (models.Topic as Model<TopicDoc>) || model<TopicDoc>("Topic", TopicSchema);
export const CompanyModel: Model<CompanyDoc> =
  (models.Company as Model<CompanyDoc>) || model<CompanyDoc>("Company", CompanySchema);
export const PatternModel: Model<PatternDoc> =
  (models.Pattern as Model<PatternDoc>) || model<PatternDoc>("Pattern", PatternSchema);
export const StatisticsModel: Model<StatisticsDoc> =
  (models.Statistics as Model<StatisticsDoc>) ||
  model<StatisticsDoc>("Statistics", StatisticsSchema);
