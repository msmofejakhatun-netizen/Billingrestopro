import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { SyncController } from "../controllers/syncController";

const router = Router();

// Delta synchronizer channel
router.post("/delta", authenticateJWT, SyncController.deltaSync);

// SaaS centralized multi-branch dashboard metrics
router.get("/dashboard", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), SyncController.getOwnerDashboard);

// Backup operations
router.post("/backup", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), SyncController.createBackupSnapshot);
router.post("/restore", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), SyncController.restoreBackupSnapshot);

// Printer Bridge
router.post("/printer/register", authenticateJWT, SyncController.registerPrinter);
router.post("/printer/report-offline", authenticateJWT, SyncController.reportPrinterOffline);
router.get("/printers", authenticateJWT, SyncController.getPrinters);
router.post("/printer/:printerId/test", authenticateJWT, SyncController.printTestReceipt);

export default router;
