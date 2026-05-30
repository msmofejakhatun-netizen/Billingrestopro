import { Router } from "express";
import { RestaurantController } from "../controllers/restaurantController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

// RESTAURANT ROUTING
router.post("/config", authenticateJWT, requireRole(['SUPER_ADMIN']), RestaurantController.createRestaurant);
router.patch("/:id/status", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), RestaurantController.setStatus);

// BRANCH NETWORKS
router.post("/branches", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), RestaurantController.createBranch);
router.patch("/branches/:id/toggle", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER']), RestaurantController.toggleBranch);
router.get("/branches", authenticateJWT, RestaurantController.getBranches);

// TABLES ROUTING
router.get("/tables", authenticateJWT, RestaurantController.getTables);
router.post("/tables", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), RestaurantController.createTable);
router.patch("/tables/:id/status", authenticateJWT, RestaurantController.updateTableStatus);

router.post("/tables/merge", authenticateJWT, RestaurantController.mergeTables);
router.post("/tables/split", authenticateJWT, RestaurantController.splitTable);
router.post("/tables/transfer", authenticateJWT, RestaurantController.transferTable);
router.post("/tables/reserve", authenticateJWT, RestaurantController.reserveTable);

// CAPTAIN OPERATIONS
router.patch("/captains/:id/suspend", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), RestaurantController.suspendCaptain);

// CENTRAL DASHBOARD
router.get("/dashboard", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), RestaurantController.getOwnerDashboard);

export default router;
