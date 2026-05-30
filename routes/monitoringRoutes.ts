import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { MonitoringController } from "../controllers/monitoringController";

const router = Router();

// 1. Core Service Monitor Endpoints
router.get("/overview", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.getOverview);
router.get("/queues", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.getQueues);
router.get("/redis", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.getRedis);
router.get("/sockets", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.getSockets);

// 2. Alert & Webhook Observability Controls
router.get("/alerts", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.getAlerts);
router.get("/webhooks", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.getWebhooks);
router.post("/webhooks", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.addWebhook);
router.patch("/webhooks/:id/toggle", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.toggleWebhook);
router.post("/alerts/test", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), MonitoringController.triggerTestAlert);

export default router;
