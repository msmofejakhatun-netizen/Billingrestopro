import { Router } from "express";
import { OrderController } from "../controllers/orderController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

// CORE ORDERS
router.post("/", authenticateJWT, OrderController.createOrder);
router.patch("/:id", authenticateJWT, OrderController.updateOrder);
router.get("/running", authenticateJWT, OrderController.getRunningOrders);
router.get("/pending", authenticateJWT, OrderController.getPendingOrders);

// KOT APIS
router.post("/:id/kot", authenticateJWT, OrderController.submitKOT);
router.post("/:id/kot/void", authenticateJWT, OrderController.voidKotItem);
router.patch("/kot/:id/resend", authenticateJWT, OrderController.resendKOT);

// KITCHEN DISPLAY SYSTEM Queue (No role lock since kitchen assistants also view it)
router.get("/kds/queue", authenticateJWT, OrderController.getKdsQueue);
router.patch("/kds/:id/status", authenticateJWT, OrderController.updateKdsStatus);

// BILLING & SETTLEMENT
router.post("/:id/bill", authenticateJWT, OrderController.generateBill);
router.post("/:id/complimentary", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), OrderController.applyComplimentary);
router.post("/bill/split", authenticateJWT, OrderController.splitBill);
router.post("/:id/settle", authenticateJWT, OrderController.settleBill);
router.post("/settlement/:id/reverse", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), OrderController.reverseSettlement);

// ENTERPRISE REPORTS
router.get("/reports/sales", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), OrderController.getSalesReport);
router.get("/reports/captains", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), OrderController.getCaptainPerformance);
router.get("/reports/items", authenticateJWT, requireRole(['SUPER_ADMIN', 'OWNER', 'MANAGER']), OrderController.getItemSalesReport);

// PRINTERS
router.get("/print-payload/:id", authenticateJWT, OrderController.getPrintPayload);

export default router;
