import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { SyncEngineService, CloudBackupService, NotificationService } from "../services/enterpriseServices";
import Table from "../models/Table";
import { Order } from "../models/Order";
import Captain from "../models/Captain";
import { InventoryStock } from "../models/Inventory";
import Branch from "../models/Branch";

export class SyncController {
  // Delta synchronization API for Android clients and POS terminals
  static async deltaSync(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { tables, categories, menuItems, stock } = req.body; // updated timestamps object

    try {
      const payloads = await SyncEngineService.getDeltaSyncPayload(restaurantId, branchId, {
        tables: tables || "",
        categories: categories || "",
        menuItems: menuItems || "",
        stock: stock || ""
      });
      return res.json({ success: true, sync: payloads });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- SAAS CENTRAL OWNER DASHBOARD CAPABILITIES ---
  static async getOwnerDashboard(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;

    try {
      // 1. Get branches under this restaurant
      const branches = await (Branch as any).find({ restaurantId });
      const branchIds = branches.map(b => b._id.toString());

      // 2. Fetch all running orders and calculate live totals
      const liveOrders = await (Order as any).find({
        restaurantId,
        branchId: { $in: branchIds },
        status: { $in: ["PENDING", "KOT_GENERATED", "IN_PROGRESS", "BILLED"] }
      });

      // 3. Branch performance metric comparison
      const branchSummary: any = {};
      for (const br of branches) {
        branchSummary[br._id.toString()] = {
          branchId: br._id,
          name: br.name,
          location: br.location,
          liveTables: 0,
          pendingKOTs: 0,
          todaySalesSummary: 0,
          averageTicketSize: 0,
          totalSettleOrders: 0
        };
      }

      // Count running tables and live orders per branch
      for (const order of liveOrders) {
        const bId = order.branchId.toString();
        if (branchSummary[bId]) {
          branchSummary[bId].liveTables += 1;
          const kots = order.kots || [];
          const pending = kots.filter((k: any) => k.status !== "SERVED" && k.status !== "VOIDED").length;
          branchSummary[bId].pendingKOTs += pending;
        }
      }

      // Fetch completed today orders for sales metrics
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayOrders = await (Order as any).find({
        restaurantId,
        branchId: { $in: branchIds },
        status: "SETTLED",
        createdAt: { $gte: startOfDay }
      });

      for (const od of todayOrders) {
        const bId = od.branchId.toString();
        if (branchSummary[bId]) {
          branchSummary[bId].todaySalesSummary += od.billAmount || od.totalAmount || 0;
          branchSummary[bId].totalSettleOrders += 1;
        }
      }

      // Calculate averages
      for (const bId of Object.keys(branchSummary)) {
        const bs = branchSummary[bId];
        if (bs.totalSettleOrders > 0) {
          bs.averageTicketSize = Number((bs.todaySalesSummary / bs.totalSettleOrders).toFixed(2));
        }
      }

      // 4. Captain productivity matrix
      const captains = await (Captain as any).find({ restaurantId });
      const captainScores = await Promise.all(captains.map(async (cap: any) => {
        const stats = await (Order as any).aggregate([
          { $match: { captainId: cap._id.toString(), status: "SETTLED", createdAt: { $gte: startOfDay } } },
          { $group: { _id: "$captainId", totalSales: { $sum: "$billAmount" }, ordersCount: { $sum: 1 } } }
         ]);
        return {
          id: cap._id,
          name: cap.name,
          code: cap.code,
          phone: cap.phone,
          todayTotalSales: stats[0]?.totalSales || 0,
          todayOrdersCount: stats[0]?.ordersCount || 0
        };
      }));

      // Sort by sales descending
      captainScores.sort((a, b) => b.todayTotalSales - a.todayTotalSales);

      // 5. System Inventory warning alerts
      const stockAlerts = await (InventoryStock as any).find({
        restaurantId,
        branchId: { $in: branchIds }
      }).populate("ingredientId");

      const lowStockList = stockAlerts.filter((rec: any) => {
        if (!rec.ingredientId) return false;
        return rec.currentQuantity <= rec.ingredientId.minStockLevel;
      }).map((al: any) => ({
        branchId: al.branchId,
        name: al.ingredientId.name,
        qty: al.currentQuantity,
        min: al.ingredientId.minStockLevel,
        unit: al.ingredientId.unit
      }));

      return res.json({
        success: true,
        summary: {
          totalBranchesCount: branches.length,
          activeTablesCount: liveOrders.length,
          totalSalesToday: todayOrders.reduce((sum, o) => sum + (o.billAmount || o.totalAmount || 0), 0)
        },
        branchesComparison: Object.values(branchSummary),
        captainProductivity: captainScores,
        lowStockWarnings: lowStockList
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- PRINTER BRIDGE UTILITIES ---
  private static registeredPrinters: any = {}; // in memory routing simulation

  static async registerPrinter(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    const { printerId, name, ipAddress, type, status } = req.body; // type: 'BILL' | 'KITCHEN' | 'BAR' | 'BEVERAGE' | 'DESSERT'

    if (!printerId || !name || !ipAddress || !type) {
      return res.status(400).json({ success: false, error: "printerId, name, ipAddress, and type are required." });
    }

    SyncController.registeredPrinters[printerId] = {
      printerId,
      branchId,
      name,
      ipAddress,
      type,
      status: status || "ONLINE",
      lastCheckSeen: new Date()
    };

    return res.json({
      success: true,
      message: "Printer registered inside the POS router system.",
      printer: SyncController.registeredPrinters[printerId]
    });
  }

  static async reportPrinterOffline(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { printerId, errorDetail } = req.body;

    if (!printerId) {
      return res.status(400).json({ success: false, error: "printerId is required" });
    }

    if (SyncController.registeredPrinters[printerId]) {
      SyncController.registeredPrinters[printerId].status = "OFFLINE";
    }

    try {
      // Trigger critical event alerts
      await NotificationService.triggerAlert(restaurantId, branchId, {
        type: "PRINTER_OFFLINE",
        title: "Printer Hardware Disconnected!",
        message: `Printer ${SyncController.registeredPrinters[printerId]?.name || printerId} fell offline: ${errorDetail || "No Connection"}`,
        severity: "CRITICAL"
      });
      return res.json({ success: true, message: "Critical printer offline warnings dispatched to active terminals." });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getPrinters(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    const list = Object.values(SyncController.registeredPrinters).filter((p: any) => p.branchId === branchId);
    return res.json({ success: true, printers: list });
  }

  static async printTestReceipt(req: AuthenticatedRequest, res: Response) {
    const { printerId } = req.params;
    const printer = SyncController.registeredPrinters[printerId];
    if (!printer) {
      return res.status(404).json({ success: false, error: "Printer router not registered matching this ID" });
    }

    // Build raw ESC/POS payload format
    const testPayload = `
========================================
           RESTOPRO ENTERPRISE          
        PRINTER SERVICE BRIDGE TEST     
========================================
Printer Name: ${printer.name}
Assign Type:  ${printer.type}
IP Address:   ${printer.ipAddress}
Seen Status:  ${printer.status}
Tested Date:  ${new Date().toLocaleString()}
----------------------------------------
       PRINTER DRIVER COMPILED GREEN    
========================================
\n\n\n\n
`;
    return res.json({
      success: true,
      testPayload,
      message: `Test packet generated. Deliver to ${printer.ipAddress}`
    });
  }

  // --- CLOUD BACKUP & RESTORE SYSTEMS ---
  static async createBackupSnapshot(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const snapObj = await CloudBackupService.backupBranchData(restaurantId, branchId);
      return res.json({ success: true, backup: snapObj });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async restoreBackupSnapshot(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { payload } = req.body;

    if (!payload) {
      return res.status(400).json({ success: false, error: "Decrypted base64 snapshot payload is required" });
    }

    try {
      const resVal = await CloudBackupService.restoreBranchSnapshot(restaurantId, branchId, payload);
      return res.json(resVal);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
