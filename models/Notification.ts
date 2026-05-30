import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  restaurantId: string;
  branchId?: string;
  type: 'KOT_READY' | 'BILL_GENERATED' | 'PAYMENT_COMPLETED' | 'PRINTER_OFFLINE' | 'STOCK_LOW' | 'LOGIN_ALERT' | 'ALERT';
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readBy: string[]; // List of userIds that read it
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  restaurantId: { type: String, required: true },
  branchId: { type: String },
  type: {
    type: String,
    enum: ['KOT_READY', 'BILL_GENERATED', 'PAYMENT_COMPLETED', 'PRINTER_OFFLINE', 'STOCK_LOW', 'LOGIN_ALERT', 'ALERT'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], default: 'INFO' },
  readBy: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

NotificationSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
