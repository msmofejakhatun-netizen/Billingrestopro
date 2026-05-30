import { menuCategoryRepo, menuItemRepo } from "../repositories";

export class MenuService {
  static async createCategory(restaurantId: string, name: string, description?: string, sortOrder: number = 0) {
    return await menuCategoryRepo.create({
      restaurantId,
      name,
      description,
      sortOrder,
      active: true
    });
  }

  static async createMenuItem(restaurantId: string, branchId: string, itemData: {
    categoryId: string;
    name: string;
    price: number;
    description?: string;
    isVeg?: boolean;
    variants?: { name: string, price: number }[];
    addons?: { name: string, price: number, available?: boolean }[];
    taxes?: { name: string, rate: number, type: string }[];
  }) {
    return await menuItemRepo.create({
      restaurantId,
      branchId,
      categoryId: itemData.categoryId,
      name: itemData.name,
      price: itemData.price,
      description: itemData.description,
      isVeg: itemData.isVeg !== false,
      active: true,
      variants: itemData.variants || [],
      addons: itemData.addons || [],
      taxes: itemData.taxes || [
        { name: "CGST", rate: 2.5, type: "CGST" },
        { name: "SGST", rate: 2.5, type: "SGST" }
      ]
    });
  }

  static async getCategories(restaurantId: string) {
    return await menuCategoryRepo.find({ restaurantId, active: true });
  }

  static async getMenuItems(restaurantId: string, branchId?: string) {
    const query: any = { restaurantId, active: true };
    if (branchId) {
      query.branchId = branchId;
    }
    return await menuItemRepo.find(query);
  }

  // Support Incremental Menu Sync using last_sync timestamp (branch-aware)
  static async syncMenu(restaurantId: string, branchId: string, lastSyncStr?: string) {
    const categories = await menuCategoryRepo.find({ restaurantId });
    const items = await menuItemRepo.find({ restaurantId, branchId });

    if (!lastSyncStr) {
      return {
        fullSync: true,
        categories: categories.filter(c => c.active),
        items: items.filter(i => i.active),
        timestamp: new Date().toISOString()
      };
    }

    const lastSync = new Date(lastSyncStr).getTime();

    const updatedCategories = categories.filter(c => {
      const updatedAt = new Date(c.updatedAt || c.createdAt).getTime();
      return updatedAt > lastSync;
    });

    const updatedItems = items.filter(i => {
      const updatedAt = new Date(i.updatedAt || i.createdAt).getTime();
      return updatedAt > lastSync;
    });

    return {
      fullSync: false,
      categories: updatedCategories,
      items: updatedItems,
      timestamp: new Date().toISOString()
    };
  }
}
