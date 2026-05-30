import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { AnalyticsController } from "../controllers/analyticsController";

const router = Router();

// Demand forecasting & prediction pipelines
router.get("/predict/top-selling", authenticateJWT, AnalyticsController.predictTopSelling);
router.get("/predict/rush-hours", authenticateJWT, AnalyticsController.predictRushHours);
router.get("/predict/low-stock", authenticateJWT, AnalyticsController.predictLowStockRunway);

// Guarded administrative and audit operations (restricted to Super Admins, Owners, and Managers)
router.get("/captain-performance", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), AnalyticsController.getCaptainPerformance);
router.get("/cancellation-anomalies", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), AnalyticsController.getCancellationAnomalies);
router.get("/dashboard-telemetry", authenticateJWT, AnalyticsController.getDashboardTelemetry);

export default router;
