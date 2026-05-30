import mongoose, { Schema, Document } from "mongoose";

// VENDOR
export interface IVendor extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  active: boolean;
}

const VendorSchema = new Schema<IVendor>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  name: { type: String, required: true },
  contactPerson: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  gstNumber: { type: String },
  active: { type: Boolean, default: true }
}, { timestamps: true });


// PURCHASE ORDER (PO)
export interface IPurchaseOrder extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  poNumber: string;
  vendorId: mongoose.Types.ObjectId | string;
  items: {
    ingredientId: mongoose.Types.ObjectId | string;
    quantity: number;
    unitPrice: number;
    totalCost: number;
  }[];
  grandTotal: number;
  status: 'DRAFT' | 'SENT' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  expectedDeliveryDate?: Date;
  notes?: string;
}

const PurchaseOrderSchema = new Schema<IPurchaseOrder>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  poNumber: { type: String, required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
  items: [{
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 }
  }],
  grandTotal: { type: Number, required: true },
  status: { type: String, enum: ['DRAFT', 'SENT', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED'], default: 'DRAFT' },
  expectedDeliveryDate: { type: Date },
  notes: { type: String }
}, { timestamps: true });


// GRN (GOODS RECEIPT NOTE)
export interface IGoodsReceiptNote extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  grnNumber: string;
  purchaseOrderId?: mongoose.Types.ObjectId | string;
  vendorId: mongoose.Types.ObjectId | string;
  receivedDate: Date;
  items: {
    ingredientId: mongoose.Types.ObjectId | string;
    orderedQty: number;
    receivedQty: number;
    damageQty: number;
  }[];
  invoiceNumber?: string;
  invoiceAmount?: number;
  receivedBy: string;
  notes?: string;
}

const GoodsReceiptNoteSchema = new Schema<IGoodsReceiptNote>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  grnNumber: { type: String, required: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder" },
  vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
  receivedDate: { type: Date, default: Date.now },
  items: [{
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    orderedQty: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, required: true, min: 0 },
    damageQty: { type: Number, default: 0, min: 0 }
  }],
  invoiceNumber: { type: String },
  invoiceAmount: { type: Number },
  receivedBy: { type: String, required: true },
  notes: { type: String }
}, { timestamps: true });


// WASTAGE LOG
export interface IWastageLog extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  branchId: mongoose.Types.ObjectId | string;
  wastageNumber: string;
  items: {
    ingredientId: mongoose.Types.ObjectId | string;
    quantity: number;
    unitValue: number;
    reason: string;
  }[];
  totalLossValue: number;
  discardedBy: string;
  loggedAt: Date;
}

const WastageLogSchema = new Schema<IWastageLog>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  wastageNumber: { type: String, required: true },
  items: [{
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitValue: { type: Number, required: true },
    reason: { type: String, required: true }
  }],
  totalLossValue: { type: Number, required: true },
  discardedBy: { type: String, required: true },
  loggedAt: { type: Date, default: Date.now }
}, { timestamps: true });


// STOCK TRANSFER
export interface IStockTransfer extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  sourceBranchId: mongoose.Types.ObjectId | string;
  targetBranchId: mongoose.Types.ObjectId | string;
  transferNumber: string;
  items: {
    ingredientId: mongoose.Types.ObjectId | string;
    quantity: number;
  }[];
  status: 'PENDING' | 'DISPATCHED' | 'RECEIVED' | 'REJECTED';
  shippedAt?: Date;
  receivedAt?: Date;
  shippedBy?: string;
  receivedBy?: string;
  notes?: string;
}

const StockTransferSchema = new Schema<IStockTransfer>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  sourceBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  targetBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  transferNumber: { type: String, required: true },
  items: [{
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantity: { type: Number, required: true, min: 0.001 }
  }],
  status: { type: String, enum: ['PENDING', 'DISPATCHED', 'RECEIVED', 'REJECTED'], default: 'PENDING' },
  shippedAt: { type: Date },
  receivedAt: { type: Date },
  shippedBy: { type: String },
  receivedBy: { type: String },
  notes: { type: String }
}, { timestamps: true });

export const Vendor = mongoose.models.Vendor || mongoose.model<IVendor>("Vendor", VendorSchema);
export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);
export const GoodsReceiptNote = mongoose.models.GoodsReceiptNote || mongoose.model<IGoodsReceiptNote>("GoodsReceiptNote", GoodsReceiptNoteSchema);
export const WastageLog = mongoose.models.WastageLog || mongoose.model<IWastageLog>("WastageLog", WastageLogSchema);
export const StockTransfer = mongoose.models.StockTransfer || mongoose.model<IStockTransfer>("StockTransfer", StockTransferSchema);
