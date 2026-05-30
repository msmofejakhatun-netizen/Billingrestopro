import mongoose, { Schema, Document } from "mongoose";

export interface ITax extends Document {
  name: string;
  rate: number; // percentage, e.g., 5 for 5%
  type: 'CGST' | 'SGST' | 'VAT' | 'SERVICE_TAX' | 'OTHER';
}

export interface IVariant extends Document {
  name: string;
  price: number;
}

export interface IAddon extends Document {
  name: string;
  price: number;
  available: boolean;
}

export interface IMenuCategory extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  name: string;
  description?: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMenuItem extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  categoryId: mongoose.Types.ObjectId | string;
  name: string;
  description?: string;
  price: number; // base price
  image?: string;
  isVeg: boolean;
  active: boolean;
  variants: IVariant[];
  addons: IAddon[];
  taxes: ITax[];
  createdAt: Date;
  updatedAt: Date;
}

const TaxSchema = new Schema<ITax>({
  name: { type: String, required: true },
  rate: { type: Number, required: true },
  type: { type: String, enum: ['CGST', 'SGST', 'VAT', 'SERVICE_TAX', 'OTHER'], required: true }
});

const VariantSchema = new Schema<IVariant>({
  name: { type: String, required: true },
  price: { type: Number, required: true }
});

const AddonSchema = new Schema<IAddon>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  available: { type: Boolean, default: true }
});

const MenuCategorySchema = new Schema<IMenuCategory>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  name: { type: String, required: true },
  description: { type: String },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const MenuItemSchema = new Schema<IMenuItem>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: "MenuCategory", required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  image: { type: String },
  isVeg: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  variants: [VariantSchema],
  addons: [AddonSchema],
  taxes: [TaxSchema]
}, { timestamps: true });

export const MenuCategory = mongoose.models.MenuCategory || mongoose.model<IMenuCategory>("MenuCategory", MenuCategorySchema);
export const MenuItem = mongoose.models.MenuItem || mongoose.model<IMenuItem>("MenuItem", MenuItemSchema);
