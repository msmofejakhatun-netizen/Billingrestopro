import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { InventoryController } from "../controllers/inventoryController";

const router = Router();

// Vendors Management
router.post("/vendors", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), InventoryController.createVendor);
router.get("/vendors", authenticateJWT, InventoryController.getVendors);

// Purchase Orders (POs)
router.post("/po", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), InventoryController.createPO);
router.get("/po", authenticateJWT, InventoryController.getPOs);

// Goods Receipt Note (GRN)
router.post("/grn", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER']), InventoryController.receiveGoods);
router.get("/grn", authenticateJWT, InventoryController.getGRNs);

// Material Wastage Tracking
router.post("/wastage", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER']), InventoryController.logWastage);
router.get("/wastage", authenticateJWT, InventoryController.getWastageLogs);

// Stock Transfers
router.post("/transfers", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), InventoryController.dispatchTransfer);
router.post("/transfers/:id/receive", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER']), InventoryController.receiveTransfer);
router.get("/transfers", authenticateJWT, InventoryController.getTransfers);

// Low Stock Alert warnings query
router.get("/alerts", authenticateJWT, InventoryController.getLowStockAlerts);

export default router;
