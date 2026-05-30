import mongoose, { Schema, Document } from "mongoose";

export interface IDaySession extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  openedBy: string;
  closedBy?: string;
  openingCash: number;
  closingCash?: number;
  cashDrops: {
    amount: number;
    droppedBy: string;
    timestamp: Date;
    notes?: string;
  }[];
  notes?: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DaySessionSchema = new Schema<IDaySession>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  openedBy: { type: String, required: true },
  closedBy: { type: String },
  openingCash: { type: Number, required: true },
  closingCash: { type: Number },
  cashDrops: [{
    amount: { type: Number, required: true },
    droppedBy: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String }
  }],
  notes: { type: String },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date }
}, { timestamps: true });

DaySessionSchema.index({ restaurantId: 1, branchId: 1, status: 1 });

export default mongoose.models.DaySession || mongoose.model<IDaySession>("DaySession", DaySessionSchema);
