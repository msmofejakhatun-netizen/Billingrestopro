import mongoose, { Model, Document } from "mongoose";
import { MemoryCollection } from "../utils/db";

export class GenericRepository<T extends Document, M = any> {
  model: Model<T>;
  memColl: MemoryCollection<any>;

  constructor(model: Model<T>, collectionName: string) {
    this.model = model;
    this.memColl = new MemoryCollection(collectionName);
  }

  isMongoConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async find(filter: any = {}): Promise<any[]> {
    if (this.isMongoConnected()) {
      try {
        return await this.model.find(filter).lean();
      } catch (err) {
        console.warn("Mongoose query error, falling back to local memory store:", err);
      }
    }
    // Transform query filter to check key-values roughly
    return await this.memColl.find((item) => {
      for (const key of Object.keys(filter)) {
        let expected = filter[key];
        let actual = item[key];
        
        // Handle potential mongoose ObjectId matching
        if (expected && typeof expected === 'object' && expected.toString) {
          expected = expected.toString();
        }
        if (actual && typeof actual === 'object' && actual.toString) {
          actual = actual.toString();
        }

        if (actual !== expected) return false;
      }
      return true;
    });
  }

  async findOne(filter: any): Promise<any | null> {
    if (this.isMongoConnected()) {
      try {
        return await this.model.findOne(filter).lean();
      } catch (err) {
        console.warn("Mongoose query error, falling back to local memory store:", err);
      }
    }
    return await this.memColl.findOne((item) => {
      for (const key of Object.keys(filter)) {
        let expected = filter[key];
        let actual = item[key];

        if (expected && typeof expected === 'object' && expected.toString) {
          expected = expected.toString();
        }
        if (actual && typeof actual === 'object' && actual.toString) {
          actual = actual.toString();
        }

        if (actual !== expected) return false;
      }
      return true;
    });
  }

  async create(data: any): Promise<any> {
    if (this.isMongoConnected()) {
      try {
        const item = new this.model(data);
        const saved = await item.save();
        return saved.toObject();
      } catch (err) {
        console.warn("Mongoose create error, falling back to local memory store:", err);
      }
    }
    return await this.memColl.create(data);
  }

  async updateOne(filter: any, update: any): Promise<any | null> {
    if (this.isMongoConnected()) {
      try {
        // Handle Mongoose update object (like $set)
        const parsedUpdate = update.$set || update;
        const updated = await this.model.findOneAndUpdate(filter, parsedUpdate, { new: true }).lean();
        if (updated) return updated;
      } catch (err) {
        console.warn("Mongoose update error, falling back to local memory store:", err);
      }
    }
    // Local update
    const item = await this.findOne(filter);
    if (!item) return null;
    const parsedUpdate = update.$set || update;
    return await this.memColl.updateOne((x: any) => x._id === item._id, parsedUpdate);
  }

  async findById(id: string): Promise<any | null> {
    if (this.isMongoConnected() && mongoose.Types.ObjectId.isValid(id)) {
      try {
        return await this.model.findById(id).lean();
      } catch (err) {
        console.warn("Mongoose findById error, falling back to local memory store:", err);
      }
    }
    return await this.findOne({ _id: id });
  }

  async updateById(id: string, update: any): Promise<any | null> {
    return await this.updateOne({ _id: id }, update);
  }

  async deleteById(id: string): Promise<boolean> {
    if (this.isMongoConnected() && mongoose.Types.ObjectId.isValid(id)) {
      try {
        const result = await this.model.findByIdAndDelete(id);
        if (result) return true;
      } catch (err) {
        console.warn("Mongoose deleteById error, falling back to local memory store:", err);
      }
    }
    return await this.memColl.deleteOne((x: any) => x._id === id);
  }

  async deleteMany(filter: any = {}): Promise<boolean> {
    if (this.isMongoConnected()) {
      try {
        await this.model.deleteMany(filter);
        return true;
      } catch (err) {
        console.warn("Mongoose deleteMany error, falling back locally:", err);
      }
    }
    const items = await this.find(filter);
    for (const item of items) {
      await this.memColl.deleteOne((x: any) => x._id === item._id);
    }
    return true;
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    if (this.isMongoConnected()) {
      try {
        return await this.model.aggregate(pipeline);
      } catch (err) {
        console.warn("Mongoose aggregate utility error:", err);
      }
    }
    return [];
  }
}
