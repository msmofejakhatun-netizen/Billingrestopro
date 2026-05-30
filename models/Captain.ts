import mongoose, { Schema, Document } from "mongoose";

export type CaptainRole = 'SUPER_OWNER' | 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CAPTAIN' | 'CASHIER' | 'KITCHEN';

export interface ICaptain extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  branchId?: mongoose.Types.ObjectId | string;
  username: string;
  email?: string;
  passwordHash: string;
  name: string;
  role: CaptainRole;
  permissions: string[];
  active: boolean;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CaptainSchema = new Schema<ICaptain>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
  username: { type: String, required: true },
  email: { type: String },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['SUPER_OWNER', 'SUPER_ADMIN', 'OWNER', 'MANAGER', 'CAPTAIN', 'CASHIER', 'KITCHEN'], default: 'CAPTAIN' },
  permissions: [{ type: String }],
  active: { type: Boolean, default: true },
  phone: { type: String }
}, { timestamps: true });

// Multi-tenant safe compound unique indexing
CaptainSchema.index({ restaurantId: 1, username: 1 }, { unique: true });
CaptainSchema.index({ email: 1 });
CaptainSchema.index({ role: 1 });
CaptainSchema.index({ branchId: 1 });


export default mongoose.models.Captain || mongoose.model<ICaptain>("Captain", CaptainSchema);
