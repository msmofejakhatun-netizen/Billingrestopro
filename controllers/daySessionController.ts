import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { DaySessionService } from "../services/daySessionService";

export class DaySessionController {
  static async openSession(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, username } = req.user!;
    const { openingCash, notes } = req.body;

    if (openingCash === undefined) {
      return res.status(400).json({ success: false, error: "openingCash amount is required to construct drawer base." });
    }

    try {
      const session = await DaySessionService.openSession(restaurantId, branchId, username, openingCash, notes);
      return res.status(201).json({ success: true, session });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async registerCashDrop(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, username } = req.user!;
    const { amount, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, error: "Dropped amount parameter is required." });
    }

    try {
      const session = await DaySessionService.registerCashDrop(restaurantId, branchId, { amount, droppedBy: username, notes });
      return res.json({ success: true, session });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async closeSession(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, username } = req.user!;
    const { closingCash, notes } = req.body;

    if (closingCash === undefined) {
      return res.status(400).json({ success: false, error: "closingCash must be keyed to tally the register." });
    }

    try {
      const session = await DaySessionService.closeSession(restaurantId, branchId, username, closingCash, notes);
      return res.json({ success: true, session });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getActiveSession(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const session = await DaySessionService.getActiveSession(restaurantId, branchId);
      return res.json({ success: true, session });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getReconciliation(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const data = await DaySessionService.getReconciliationSummary(restaurantId, branchId);
      return res.json({ success: true, reconciliation: data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
