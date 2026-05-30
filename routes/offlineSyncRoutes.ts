import { Router, Response } from "express";
import { authenticateJWT, AuthenticatedRequest } from "../middleware/auth";
import { orderRepo } from "../repositories";
import { OrderService } from "../services/orderService";

const router = Router();

router.post("/upload-orders", authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { restaurantId, branchId, uid, username } = req.user!;
  const { orders } = req.body; // Array of orders containing offlineId

  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ success: false, error: "An array of offline orders is required." });
  }

  const syncedOrders: any[] = [];
  const conflicts: any[] = [];

  for (const offOrder of orders) {
    try {
      if (!offOrder.offlineId) {
        conflicts.push({ order: offOrder, reason: "Missing offlineId" });
        continue;
      }

      // 1. Check if order with this offlineId was already synced to avoid duplicate syncing
      const existing = await orderRepo.findOne({ restaurantId, branchId, offlineId: offOrder.offlineId });
      if (existing) {
        syncedOrders.push({
          offlineId: offOrder.offlineId,
          onlineId: existing._id,
          status: "ALREADY_SYNCED",
          message: "Conflict resolved: Order was already synced previously."
        });
        continue;
      }

      // 2. Safely create order in our main system
      const synced = await OrderService.createOrder(restaurantId, branchId, {
        tableId: offOrder.tableId,
        captainId: uid,
        captainName: username,
        items: offOrder.items || [],
        notes: offOrder.notes || "",
        offlineId: offOrder.offlineId
      });

      syncedOrders.push({
        offlineId: offOrder.offlineId,
        onlineId: synced._id,
        status: "SUCCESS"
      });
    } catch (err: any) {
      conflicts.push({
        offlineId: offOrder.offlineId,
        reason: err.message || "Failed to create order during synchronization."
      });
    }
  }

  return res.json({
    success: true,
    syncedCount: syncedOrders.length,
    conflictsCount: conflicts.length,
    synced: syncedOrders,
    conflicts,
    lastSyncTimestamp: new Date().toISOString()
  });
});

export default router;
