import mongoose, { Schema, Document } from "mongoose";

export interface IDevice extends Document {
  deviceId: string; // unique hardware/app uuid
  restaurantId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  captainId?: mongoose.Types.ObjectId | string;
  assignedCaptainName?: string;
  deviceName: string;
  deviceModel: string;
  osVersion: string;
  printerMapping: {
    billingPrinterId?: string;
    kitchenPrinterId?: string;
    barPrinterId?: string;
    beveragePrinterId?: string;
    dessertPrinterId?: string;
  };
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  authTokenRotationVersion: number;
  lastActiveAt: Date;
  registeredAt: Date;
}

const DeviceSchema = new Schema<IDevice>({
  deviceId: { type: String, required: true, unique: true },
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  captainId: { type: Schema.Types.ObjectId, ref: "Captain" },
  assignedCaptainName: { type: String },
  deviceName: { type: String, required: true },
  deviceModel: { type: String, required: true },
  osVersion: { type: String, required: true },
  printerMapping: {
    billingPrinterId: { type: String, default: "" },
    kitchenPrinterId: { type: String, default: "" },
    barPrinterId: { type: String, default: "" },
    beveragePrinterId: { type: String, default: "" },
    dessertPrinterId: { type: String, default: "" }
  },
  status: { type: String, enum: ['ACTIVE', 'REVOKED', 'EXPIRED'], default: 'ACTIVE' },
  authTokenRotationVersion: { type: Number, default: 1 },
  lastActiveAt: { type: Date, default: Date.now },
  registeredAt: { type: Date, default: Date.now }
}, { timestamps: true });

DeviceSchema.index({ restaurantId: 1, branchId: 1 });
DeviceSchema.index({ deviceId: 1 }, { unique: true });

export default mongoose.models.Device || mongoose.model<IDevice>("Device", DeviceSchema);
