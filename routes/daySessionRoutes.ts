import { Router, Response, NextFunction } from "express";
import { DaySessionController } from "../controllers/daySessionController";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const restrictToSessionOperators = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role?.toUpperCase();
  if (role !== "CASHIER" && role !== "ADMIN") {
    console.log(`[DAY_SESSION_BYPASS] Bypassing day session API for role: ${role}`);
    return res.json({ success: true, bypassed: true, session: null });
  }
  next();
};

router.post("/open", authenticateJWT, restrictToSessionOperators, DaySessionController.openSession);
router.post("/cash-drop", authenticateJWT, restrictToSessionOperators, DaySessionController.registerCashDrop);
router.post("/close", authenticateJWT, restrictToSessionOperators, DaySessionController.closeSession);
router.get("/status", authenticateJWT, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role?.toUpperCase();
  if (role !== "CASHIER" && role !== "ADMIN") {
    console.log(`[DAY_SESSION_BYPASS] Bypassing getActiveSession status check for role: ${role}`);
    return res.json({ 
      success: true, 
      bypassed: true, 
      session: { 
        id: "bypassed-session", 
        shiftId: "BYPASS-SHIFT", 
        status: "OPEN", 
        openedBy: "Enterprise Mode", 
        openedAt: { seconds: Math.floor(Date.now() / 1000) },
        openingCash: 0,
        closingCash: 0,
        terminal: "Enterprise Console",
        restaurantId: req.user?.restaurantId || "",
        closedAt: null,
        closedBy: null
      } 
    });
  }
  next();
}, DaySessionController.getActiveSession);
router.get("/reconcile", authenticateJWT, restrictToSessionOperators, DaySessionController.getReconciliation);

export default router;
