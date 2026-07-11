import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Application settings singleton (key: "app"). Holds admin-configurable
 * preferences that persist across sessions and devices. Theme is handled
 * client-side by next-themes; this stores server-side defaults.
 */
const SettingsSchema = new Schema(
  {
    key: { type: String, default: "app", unique: true },
    siteName: { type: String, default: "DSAspire" },
    accentColor: { type: String, default: "indigo" },
    defaultPageSize: { type: Number, default: 20 },
    defaultTheme: { type: String, default: "system" },
    // Spaced-repetition intervals (in days) offered when scheduling revision.
    revisionIntervals: { type: [Number], default: [1, 3, 7, 14, 30] },
    showConfetti: { type: Boolean, default: true },
    compactMode: { type: Boolean, default: false },
    preferences: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "settings" },
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema>;

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) ||
  model<SettingsDoc>("Settings", SettingsSchema);

export default Settings;
