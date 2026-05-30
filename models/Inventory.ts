import mongoose, { Schema, Document } from "mongoose";

// INGREDIENTS MODEL definition
export interface IIngredient extends Document {
  restaurantId: string;
  branchId: string;
  name: string;
  sku: string;
  unit: string; // e.g. kg, grams, liters, units
  minStockLevel: number; // For low stock alerts
  costPerUnit: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const IngredientSchema = new Schema<IIngredient>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  unit: { type: String, default: "units" },
  minStockLevel: { type: Number, default: 0 },
  costPerUnit: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

IngredientSchema.index({ restaurantId: 1, branchId: 1, sku: 1 }, { unique: true });

// STOCK MODEL definition for tracking branch-level inventory
export interface IInventoryStock extends Document {
  restaurantId: string;
  branchId: string;
  ingredientId: mongoose.Types.ObjectId | string;
  currentQuantity: number;
  lastStockCheck?: Date;
  updatedAt: Date;
}

const InventoryStockSchema = new Schema<IInventoryStock>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
  currentQuantity: { type: Number, default: 0, min: 0 },
  lastStockCheck: { type: Date }
}, { timestamps: true });

InventoryStockSchema.index({ restaurantId: 1, branchId: 1, ingredientId: 1 }, { unique: true });

// PURCHASE MODEL for recording stock purchases
export interface IPurchase extends Document {
  restaurantId: string;
  branchId: string;
  supplierName: string;
  invoiceNumber?: string;
  items: {
    ingredientId: mongoose.Types.ObjectId | string;
    quantity: number;
    unitPrice: number;
    totalCost: number;
  }[];
  grandTotal: number;
  purchaseDate: Date;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
}

const PurchaseSchema = new Schema<IPurchase>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  supplierName: { type: String, required: true },
  invoiceNumber: { type: String },
  items: [{
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true },
    totalCost: { type: Number, required: true }
  }],
  grandTotal: { type: Number, required: true },
  purchaseDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['PENDING', 'RECEIVED', 'CANCELLED'], default: 'RECEIVED' },
  notes: { type: String }
}, { timestamps: true });

// STOCK DEDUCTION / LOG MODEL for inventory transactions
export interface IStockTransaction extends Document {
  restaurantId: string;
  branchId: string;
  ingredientId: mongoose.Types.ObjectId | string;
  type: 'ADDITION' | 'DEDUCTION_SALE' | 'DEDUCTION_WASTAGE' | 'MANUAL_ADJUST';
  quantity: number; // absolute value
  referenceId?: string; // OrderId or PurchaseId if applicable
  notes?: string;
  timestamp: Date;
}

const StockTransactionSchema = new Schema<IStockTransaction>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
  type: { type: String, enum: ['ADDITION', 'DEDUCTION_SALE', 'DEDUCTION_WASTAGE', 'MANUAL_ADJUST'], required: true },
  quantity: { type: Number, required: true },
  referenceId: { type: String },
  notes: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// RECIPE MAPPING models a MenuItem to raw Ingredients
export interface IRecipe extends Document {
  restaurantId: string;
  branchId: string;
  menuItemId: string; // references MenuItem model
  ingredients: {
    ingredientId: mongoose.Types.ObjectId | string;
    quantity: number; // quantity of ingredient used for 1 unit of menu item
  }[];
  active: boolean;
}

const RecipeSchema = new Schema<IRecipe>({
  restaurantId: { type: String, required: true },
  branchId: { type: String, required: true },
  menuItemId: { type: String, required: true },
  ingredients: [{
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantity: { type: Number, required: true, min: 0.0001 }
  }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

RecipeSchema.index({ restaurantId: 1, branchId: 1, menuItemId: 1 }, { unique: true });

export const Ingredient = mongoose.models.Ingredient || mongoose.model<IIngredient>("Ingredient", IngredientSchema);
export const InventoryStock = mongoose.models.InventoryStock || mongoose.model<IInventoryStock>("InventoryStock", InventoryStockSchema);
export const Purchase = mongoose.models.Purchase || mongoose.model<IPurchase>("Purchase", PurchaseSchema);
export const StockTransaction = mongoose.models.StockTransaction || mongoose.model<IStockTransaction>("StockTransaction", StockTransactionSchema);
export const Recipe = mongoose.models.Recipe || mongoose.model<IRecipe>("Recipe", RecipeSchema);
