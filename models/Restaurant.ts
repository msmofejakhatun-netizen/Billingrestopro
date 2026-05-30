import mongoose, { Schema, Document } from "mongoose";

export interface IRestaurant extends Document {
  code: string;
  name: string;
  address: string;
  phone: string;
  gstNumber?: string;
  active: boolean;
  status: 'ACTIVE' | 'DISABLED' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  gstNumber: { type: String },
  active: { type: Boolean, default: true },
  status: { type: String, enum: ['ACTIVE', 'DISABLED', 'DELETED'], default: 'ACTIVE' }
}, { timestamps: true });

export default mongoose.models.Restaurant || mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);
