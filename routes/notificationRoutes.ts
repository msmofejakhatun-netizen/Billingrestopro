import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { NotificationController } from "../controllers/notificationController";

const router = Router();

router.get("/", authenticateJWT, NotificationController.list);
router.patch("/:id/read", authenticateJWT, NotificationController.markRead);
router.post("/read-all", authenticateJWT, NotificationController.markAllAsRead);

// Debugger/Test router (allows manual triggers of alerts)
router.post("/trigger-test", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), NotificationController.triggerTestNotification);

export default router;
