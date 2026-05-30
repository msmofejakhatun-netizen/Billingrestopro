import mongoose, { Schema, Document } from "mongoose";

export type TableStatus = 'AVAILABLE' | 'RUNNING' | 'READY' | 'BILLED' | 'RESERVED';

export interface ITable extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
  currentOrderId?: mongoose.Types.ObjectId | string | null;
  occupiedSince?: Date | null;
  mergedWith?: string[]; // IDs of physical tables merged into this billing group
  reservationDetails?: {
    guestName?: string;
    contactNo?: string;
    reservedFor?: Date;
    numberOfGuests?: number;
  } | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  tableNumber: { type: String, required: true },
  capacity: { type: Number, required: true, default: 4 },
  status: { type: String, enum: ['AVAILABLE', 'RUNNING', 'READY', 'BILLED', 'RESERVED'], default: 'AVAILABLE' },
  currentOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  occupiedSince: { type: Date, default: null },
  mergedWith: [{ type: String }],
  reservationDetails: {
    guestName: { type: String },
    contactNo: { type: String },
    reservedFor: { type: Date },
    numberOfGuests: { type: Number }
  },
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Highly indexed for fast scanning
TableSchema.index({ restaurantId: 1, branchId: 1, tableNumber: 1 }, { unique: true });
TableSchema.index({ status: 1 });

export default mongoose.models.Table || mongoose.model<ITable>("Table", TableSchema);
