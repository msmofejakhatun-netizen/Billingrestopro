import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { DeviceController } from "../controllers/deviceController";

const router = Router();

// Device registrations
router.post("/register", authenticateJWT, DeviceController.register);
router.post("/heartbeat", authenticateJWT, DeviceController.heartbeat);

// Administrative device settings
router.get("/", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), DeviceController.list);
router.delete("/:deviceId", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), DeviceController.logout);
router.patch("/:deviceId/printer-mapping", authenticateJWT, DeviceController.updatePrinterMapping);

export default router;
