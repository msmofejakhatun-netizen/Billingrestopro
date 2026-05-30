import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { AdvancedInventoryService } from "../services/enterpriseServices";
import { Vendor, PurchaseOrder, GoodsReceiptNote, WastageLog, StockTransfer } from "../models/AdvancedInventory";
import { InventoryStock } from "../models/Inventory";

export class InventoryController {
  // --- VENDORS ---
  static async createVendor(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    try {
      const vendor = await AdvancedInventoryService.createVendor(restaurantId, req.body);
      return res.status(201).json({ success: true, vendor });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getVendors(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    try {
      const vendors = await (Vendor as any).find({ restaurantId, active: true });
      return res.json({ success: true, vendors });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- PURCHASE ORDERS ---
  static async createPO(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { vendorId, items, expectedDeliveryDate, notes } = req.body;

    if (!vendorId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "vendorId and items (array) are required" });
    }

    try {
      const po = await AdvancedInventoryService.createPO(restaurantId, branchId, {
        vendorId,
        items,
        expectedDeliveryDate,
        notes
      });
      return res.status(201).json({ success: true, purchaseOrder: po });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getPOs(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    try {
      const pos = await (PurchaseOrder as any).find({ branchId })
        .populate("vendorId")
        .populate("items.ingredientId");
      return res.json({ success: true, purchaseOrders: pos });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- GOODS RECEIPTS (GRN) ---
  static async receiveGoods(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, username } = req.user!;
    const { purchaseOrderId, vendorId, items, invoiceNumber, invoiceAmount, notes } = req.body;

    if (!vendorId || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "vendorId and items array are required" });
    }

    try {
      const grn = await AdvancedInventoryService.receiveGoodsNote(restaurantId, branchId, {
        purchaseOrderId,
        vendorId,
        items,
        invoiceNumber,
        invoiceAmount,
        receivedBy: username || "Staff",
        notes
      });
      return res.status(201).json({ success: true, grn });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getGRNs(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    try {
      const grns = await (GoodsReceiptNote as any).find({ branchId })
        .populate("vendorId")
        .populate("items.ingredientId");
      return res.json({ success: true, grns });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- WASTAGE LOGGING ---
  static async logWastage(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, username } = req.user!;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "items array with ingredient wastage logs is required" });
    }

    try {
      const log = await AdvancedInventoryService.logWastage(restaurantId, branchId, {
        items,
        discardedBy: username || "Staff"
      });
      return res.status(201).json({ success: true, wastageLog: log });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getWastageLogs(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    try {
      const logs = await (WastageLog as any).find({ branchId }).populate("items.ingredientId");
      return res.json({ success: true, wastageLogs: logs });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- STOCK TRANSFERS ---
  static async dispatchTransfer(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, username } = req.user!;
    const { targetBranchId, items, notes } = req.body;

    if (!targetBranchId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "targetBranchId and items array are required" });
    }

    try {
      const trf = await AdvancedInventoryService.dispatchTransfer(restaurantId, {
        sourceBranchId: branchId,
        targetBranchId,
        items,
        shippedBy: username || "Exporter Officer",
        notes
      });
      return res.status(201).json({ success: true, transfer: trf });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async receiveTransfer(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, username } = req.user!;
    const { id } = req.params; // transfer ID

    try {
      const trf = await AdvancedInventoryService.receiveTransfer(restaurantId, id, username || "Receiver Staff");
      return res.json({ success: true, message: "Stock transfer unpacked and added to target branch inventory", transfer: trf });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getTransfers(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    try {
      // Return transfers where this branch is either the source or the target
      const list = await (StockTransfer as any).find({
        $or: [{ sourceBranchId: branchId }, { targetBranchId: branchId }]
      }).populate("items.ingredientId");
      return res.json({ success: true, transfers: list });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- LOW STOCK ALERT PAYLOAD ---
  static async getLowStockAlerts(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const stockRecords = await (InventoryStock as any).find({ restaurantId, branchId }).populate("ingredientId");
      const alerts = stockRecords.filter((rec: any) => {
        if (!rec.ingredientId) return false;
        return rec.currentQuantity <= rec.ingredientId.minStockLevel;
      });

      return res.json({
        success: true,
        alerts: alerts.map((al: any) => ({
          _id: al._id,
          ingredientId: al.ingredientId._id,
          name: al.ingredientId.name,
          sku: al.ingredientId.sku,
          currentQty: al.currentQuantity,
          minRequiredLevel: al.ingredientId.minStockLevel,
          unit: al.ingredientId.unit
        }))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
