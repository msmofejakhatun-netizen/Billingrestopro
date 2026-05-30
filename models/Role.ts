import mongoose, { Schema, Document } from "mongoose";

export interface IRole extends Document {
  name: string;
  permissions: string[];
  displayName: string;
}

const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true },
  permissions: [{ type: String }],
  displayName: { type: String, required: true }
});

export default mongoose.models.Role || mongoose.model<IRole>("Role", RoleSchema);
