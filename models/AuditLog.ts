import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  restaurantId?: string;
  branchId?: string;
  action: string; // e.g. "VOID_ITEM", "COMPLIMENTARY_BILL", "USER_SUSPENSION", "PRICE_OVERRIDE", "SPLIT_BILL", "REVERSAL"
  details: string;
  userId: string;
  userName: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  restaurantId: { type: String },
  branchId: { type: String },
  action: { type: String, required: true },
  details: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  ipAddress: { type: String },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: { createdAt: true, updatedAt: false } });

// Indexed for powerful aggregated audit trailing
AuditLogSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ userId: 1 });

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
