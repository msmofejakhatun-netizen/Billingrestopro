import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { QueueController } from "../controllers/queueController";

const router = Router();

// Retrieve all worker health parameters, Redis connection indicators, and queue metrics
router.get("/metrics", authenticateJWT, QueueController.getMetrics);

// Trigger a manual background job (Offline Sync test, print verification, etc.)
router.post("/trigger", authenticateJWT, QueueController.triggerManualJob);

// Operations strictly restricted to high level roles (SUPER_ADMIN, OWNER, MANAGER)
router.post("/dlq/purge", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), QueueController.purgeDLQ);
router.post("/dlq/retry", authenticateJWT, requireRole(["SUPER_ADMIN", "OWNER", "MANAGER"]), QueueController.retryDLQJobs);

export default router;
