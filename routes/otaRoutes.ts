import { Router } from "express";
import { authenticateJWT, requireRole } from "../middleware/auth";
import { OtaController } from "../controllers/otaController";

const router = Router();

// Captain apps call this query directly without tight role checks to verify updates
router.get("/check", authenticateJWT, OtaController.checkUpdate);

// Publish configurations are restricted to Administrators/Super owners
router.post("/publish", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), OtaController.publishBuild);
router.get("/builds", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), OtaController.listBuilds);

export default router;
