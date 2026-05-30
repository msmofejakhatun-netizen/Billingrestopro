import mongoose, { Schema, Document } from "mongoose";

export interface IOTAUpdate extends Document {
  versionCode: number;
  versionName: string;
  changelog: string[];
  forceUpdate: boolean;
  apkUrl: string;
  releaseActive: boolean;
  minSupportedOS: string;
  targetDeviceType: 'CAPTAIN_APP' | 'BILLING_STATION' | 'KDS_STATION';
  releasedAt: Date;
}

const OTAUpdateSchema = new Schema<IOTAUpdate>({
  versionCode: { type: Number, required: true, unique: true },
  versionName: { type: String, required: true },
  changelog: [{ type: String }],
  forceUpdate: { type: Boolean, default: false },
  apkUrl: { type: String, required: true },
  releaseActive: { type: Boolean, default: true },
  minSupportedOS: { type: String, default: "Android 8.0" },
  targetDeviceType: { type: String, enum: ['CAPTAIN_APP', 'BILLING_STATION', 'KDS_STATION'], default: 'CAPTAIN_APP' },
  releasedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.models.OTAUpdate || mongoose.model<IOTAUpdate>("OTAUpdate", OTAUpdateSchema);
