import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { NotificationService } from "../services/enterpriseServices";
import Notification from "../models/Notification";

export class NotificationController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    try {
      const list = await NotificationService.getActiveAlerts(branchId, limit);
      return res.json({ success: true, notifications: list });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async markRead(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { uid } = req.user!;

    try {
      const updated = await NotificationService.markAsRead(id, uid);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Notification target not found" });
      }
      return res.json({ success: true, notification: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async markAllAsRead(req: AuthenticatedRequest, res: Response) {
    const { branchId, uid } = req.user!;
    try {
      await (Notification as any).updateMany(
        { branchId, readBy: { $ne: uid } },
        { $addToSet: { readBy: uid } }
      );
      return res.json({ success: true, message: "All branch alerts marked as read." });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Debug/Test Trigger Endpoint for Captain/POS simulator
  static async triggerTestNotification(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { type, title, message, severity } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ success: false, error: "type, title, and message are required." });
    }

    try {
      const alert = await NotificationService.triggerAlert(restaurantId, branchId, {
        type,
        title,
        message,
        severity
      });
      return res.status(201).json({ success: true, message: "Alert logged and broadcast via sockets.", notification: alert });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
