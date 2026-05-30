import mongoose, { Schema, Document } from "mongoose";

export type OrderStatus = 'PENDING' | 'RUNNING' | 'CLOSED' | 'CANCELLED';
export type KOTStatus = 'PENDING' | 'PRINTED' | 'PREPARING' | 'READY' | 'SERVED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMode = 'CASH' | 'CARD' | 'UPI' | 'ROOM' | 'CREDIT' | 'SPLIT' | 'COMPLIMENTARY';

export interface IOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number; // calculated at order time
  variantName?: string;
  addons: {
    name: string;
    price: number;
  }[];
  notes?: string;
  voidedQuantity?: number; // keeps track of cancelled quantity
  voidNotes?: string;
  isKitchenDone?: boolean;
}

export interface IKOT extends Document {
  restaurantId: string;
  branchId: string;
  kotId: string; // KOT number, e.g. KOT-1001
  orderId: string;
  items: IOrderItem[];
  kotType: 'NEW' | 'ADDON' | 'CANCELKOT';
  status: KOTStatus;
  resendCount: number;
  printerIp?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaxBreakup {
  name: string;
  rate: number;
  amount: number;
}

export interface IBill extends Document {
  restaurantId: string;
  branchId: string;
  billId: string; // e.g. BILL-4912
  orderId: string;
  subTotal: number;
  serviceChargePercent?: number;
  serviceChargeAmount?: number;
  taxBreakup: ITaxBreakup[];
  taxAmount: number;
  discountAmount: number;
  discountReason?: string;
  discountApprovedBy?: string;
  isComplimentary: boolean;
  complimentaryReason?: string;
  grandTotal: number;
  duplicateCount: number;
  isSettled: boolean;
  splitDetails?: {
    isSplit: boolean;
    splitsCount: number;
    amountPerSplit: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettlement extends Document {
  restaurantId: string;
  branchId: string;
  billId: string;
  orderId: string;
  paymentMode: PaymentMode;
  amount: number;
  referenceId?: string;
  splitPayments?: {
    mode: PaymentMode;
    amount: number;
    referenceId?: string;
  }[];
  status: 'SETTLED' | 'REVERSED';
  reversedAt?: Date;
  reversalReason?: string;
  refundAmount?: number;
  createdUser?: string;
  createdAt: Date;
}

export interface IOrderAuditLog {
  action: string;
  userId: string;
  userName: string;
  timestamp: Date;
  notes?: string;
}

export interface IOrder extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  tableId: mongoose.Types.ObjectId | string;
  tableNumber: string;
  captainId: mongoose.Types.ObjectId | string;
  captainName: string;
  items: IOrderItem[];
  status: OrderStatus;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  offlineId?: string; // used for guest / captain app offline synchronization
  isSynced: boolean;
  notes?: string;
  auditTrail: IOrderAuditLog[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  menuItemId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  variantName: { type: String },
  addons: [{
    name: { type: String, required: true },
    price: { type: Number, required: true }
  }],
  notes: { type: String },
  voidedQuantity: { type: Number, default: 0 },
  voidNotes: { type: String },
  isKitchenDone: { type: Boolean, default: false }
});

const KOTSchema = new Schema<IKOT>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  kotId: { type: String, required: true },
  orderId: { type: String, required: true },
  items: [OrderItemSchema],
  kotType: { type: String, enum: ['NEW', 'ADDON', 'CANCELKOT'], default: 'NEW' },
  status: { type: String, enum: ['PENDING', 'PRINTED', 'PREPARING', 'READY', 'SERVED', 'DELIVERED', 'CANCELLED'], default: 'PENDING' },
  resendCount: { type: Number, default: 0 },
  printerIp: { type: String }
}, { timestamps: true });

KOTSchema.index({ restaurantId: 1, branchId: 1, kotId: 1 }, { unique: true });

const TaxBreakupSchema = new Schema<ITaxBreakup>({
  name: { type: String, required: true },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true }
});

const BillSchema = new Schema<IBill>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  billId: { type: String, required: true },
  orderId: { type: String, required: true },
  subTotal: { type: Number, required: true },
  serviceChargePercent: { type: Number, default: 0 },
  serviceChargeAmount: { type: Number, default: 0 },
  taxBreakup: [TaxBreakupSchema],
  taxAmount: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  discountReason: { type: String },
  discountApprovedBy: { type: String },
  isComplimentary: { type: Boolean, default: false },
  complimentaryReason: { type: String },
  grandTotal: { type: Number, required: true },
  duplicateCount: { type: Number, default: 0 },
  isSettled: { type: Boolean, default: false },
  splitDetails: {
    isSplit: { type: Boolean, default: false },
    splitsCount: { type: Number, default: 1 },
    amountPerSplit: { type: Number, default: 0 }
  }
}, { timestamps: true });

BillSchema.index({ restaurantId: 1, branchId: 1, billId: 1 }, { unique: true });

const SettlementSchema = new Schema<ISettlement>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  billId: { type: String, required: true },
  orderId: { type: String, required: true },
  paymentMode: { type: String, enum: ['CASH', 'CARD', 'UPI', 'ROOM', 'CREDIT', 'SPLIT', 'COMPLIMENTARY'], required: true },
  amount: { type: Number, required: true },
  referenceId: { type: String },
  splitPayments: [{
    mode: { type: String, enum: ['CASH', 'CARD', 'UPI', 'ROOM', 'CREDIT', 'SPLIT', 'COMPLIMENTARY'] },
    amount: { type: Number },
    referenceId: { type: String }
  }],
  status: { type: String, enum: ['SETTLED', 'REVERSED'], default: 'SETTLED' },
  reversedAt: { type: Date },
  reversalReason: { type: String },
  refundAmount: { type: Number, default: 0 },
  createdUser: { type: String }
}, { timestamps: true });

SettlementSchema.index({ restaurantId: 1, branchId: 1, billId: 1 });

const OrderAuditLogSchema = new Schema<IOrderAuditLog>({
  action: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  notes: { type: String }
});

const OrderSchema = new Schema<IOrder>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },
  tableNumber: { type: String, required: true },
  captainId: { type: Schema.Types.ObjectId, ref: "Captain", required: true },
  captainName: { type: String, required: true },
  items: [OrderItemSchema],
  status: { type: String, enum: ['PENDING', 'RUNNING', 'CLOSED', 'CANCELLED'], default: 'RUNNING' },
  subTotal: { type: Number, required: true, default: 0 },
  taxAmount: { type: Number, required: true, default: 0 },
  discountAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  offlineId: { type: String },
  isSynced: { type: Boolean, default: true },
  notes: { type: String },
  auditTrail: [OrderAuditLogSchema]
}, { timestamps: true });

OrderSchema.index({ restaurantId: 1, branchId: 1 });
OrderSchema.index({ tableId: 1 });
OrderSchema.index({ status: 1 });

export const Order = mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
export const KOT = mongoose.models.KOT || mongoose.model<IKOT>("KOT", KOTSchema);
export const Bill = mongoose.models.Bill || mongoose.model<IBill>("Bill", BillSchema);
export const Settlement = mongoose.models.Settlement || mongoose.model<ISettlement>("Settlement", SettlementSchema);
