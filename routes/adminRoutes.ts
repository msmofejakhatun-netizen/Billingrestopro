import { Router } from "express";
import { AdminController } from "../controllers/adminController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

// Endpoint definitions complying with instructions
router.post("/restaurants/create", authenticateJWT, requireRole(['SUPER_ADMIN']), AdminController.createRestaurant);
router.post("/owners/create", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), AdminController.createOwner);
router.get("/permissions", authenticateJWT, AdminController.getPermissions);

export default router;
