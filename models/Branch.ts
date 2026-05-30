import mongoose, { Schema, Document } from "mongoose";

export interface IBranch extends Document {
  restaurantId: mongoose.Types.ObjectId | string;
  name: string;
  location: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure unique branch name per restaurant
BranchSchema.index({ restaurantId: 1, name: 1 }, { unique: true });


export default mongoose.models.Branch || mongoose.model<IBranch>("Branch", BranchSchema);
