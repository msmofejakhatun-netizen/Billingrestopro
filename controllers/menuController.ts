import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { MenuService } from "../services/menuService";

export class MenuController {
  // CREATE category
  static async createCategory(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    const { name, description, sortOrder } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "category name is required." });
    }

    try {
      const cat = await MenuService.createCategory(restaurantId, name, description, sortOrder);
      return res.status(201).json({ success: true, category: cat });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // CREATE menu item (associated with branchId)
  static async createMenuItem(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { categoryId, name, price, description, isVeg, variants, addons, taxes } = req.body;

    if (!categoryId || !name || price === undefined) {
      return res.status(400).json({ success: false, error: "categoryId, name, and price are required." });
    }

    try {
      const item = await MenuService.createMenuItem(restaurantId, branchId, { categoryId, name, price, description, isVeg, variants, addons, taxes });
      return res.status(201).json({ success: true, item });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET categories
  static async getCategories(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    try {
      const categories = await MenuService.getCategories(restaurantId);
      return res.json({ success: true, categories });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET items
  static async getMenuItems(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const items = await MenuService.getMenuItems(restaurantId, branchId);
      return res.json({ success: true, items });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SYNC menu incremental
  static async syncMenu(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { last_sync } = req.query; // optional ISO String

    try {
      const result = await MenuService.syncMenu(restaurantId, branchId, last_sync as string | undefined);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
