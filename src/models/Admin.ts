import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Single-admin credential store. Exactly one document is ever created.
 * The 8-digit key is stored ONLY as a bcrypt hash — never in plaintext,
 * never in environment variables.
 */
const AdminSchema = new Schema(
  {
    key: { type: String, default: "primary", unique: true },
    passwordHash: { type: String, required: true },
    // Secret used to sign admin session cookies. Rotating it (e.g. on password
    // change) invalidates all existing sessions. Never sent to the client.
    sessionSecret: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "admin" },
);

export type AdminDoc = InferSchemaType<typeof AdminSchema>;

export const Admin: Model<AdminDoc> =
  (models.Admin as Model<AdminDoc>) || model<AdminDoc>("Admin", AdminSchema);

export default Admin;
