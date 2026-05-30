import { Router } from "express";
import { MenuController } from "../controllers/menuController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

router.get("/categories", authenticateJWT, MenuController.getCategories);
router.post("/categories", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), MenuController.createCategory);

router.get("/items", authenticateJWT, MenuController.getMenuItems);
router.post("/items", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), MenuController.createMenuItem);

// Incremental sync
router.get("/sync", authenticateJWT, MenuController.syncMenu);

export default router;
