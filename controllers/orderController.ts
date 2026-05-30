import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { OrderService } from "../services/orderService";
import { orderRepo } from "../repositories";

export class OrderController {
  // CREATE ORDER
  static async createOrder(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { tableId, items, notes, offlineId } = req.body;

    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "tableId and non-empty items array are required." });
    }

    try {
      const order = await OrderService.createOrder(restaurantId, branchId, {
        tableId,
        captainId: uid,
        captainName: username,
        items,
        notes,
        offlineId
      });
      return res.status(201).json({ success: true, order });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PATCH order
  static async updateOrder(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const updated = await OrderService.updateOrder(id, req.body);
      return res.json({ success: true, order: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET running orders
  static async getRunningOrders(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const orders = await OrderService.getRunningOrders(restaurantId, branchId);
      return res.json({ success: true, orders });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET pending orders
  static async getPendingOrders(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const orders = await orderRepo.find({ restaurantId, branchId, status: "RUNNING" });
      return res.json({ success: true, orders });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SEND ADDITIONAL KOT (POST /orders/:id/kot)
  static async submitKOT(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params; // order ID
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Non-empty items array required for KOT." });
    }

    try {
      const kot = await OrderService.submitKOT(id, items);
      return res.status(201).json({ success: true, kot });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // VOID / CANCEL KOT PARTIAL ITEMS (POST /orders/:id/kot/void)
  static async voidKotItem(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { id } = req.params; // order id
    const { kotId, menuItemId, quantity, reason } = req.body;

    if (!kotId || !menuItemId || !quantity || !reason) {
      return res.status(400).json({ success: false, error: "kotId, menuItemId, quantity, and reason are required parameters." });
    }

    try {
      const result = await OrderService.cancelKotItem(restaurantId, branchId, id, kotId, menuItemId, quantity, reason, uid, username);
      return res.json({ success: true, message: "KOT menu item quantity voided successfully.", ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // RESEND KOT
  static async resendKOT(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params; // KOT ID/no
    try {
      const kot = await OrderService.resendKOT(id);
      return res.json({ success: true, message: "KOT marked for printer retry.", kot });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // INVOICE GEN (POST /orders/:id/bill)
  static async generateBill(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params; // order id
    const { discountAmount, discountReason, approvedBy, serviceChargePercent } = req.body;

    try {
      const bill = await OrderService.generateBill(id, { discountAmount, discountReason, approvedBy, serviceChargePercent });
      return res.json({ success: true, bill });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // COMPLIMENTARY BILL INITIATOR
  static async applyComplimentary(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { id } = req.params; // order id
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: "Exemption reason is required to process complimentary bills." });
    }

    try {
      const bill = await OrderService.applyComplimentaryBill(restaurantId, branchId, id, reason, uid, username);
      return res.json({ success: true, message: "Complimentary invoice generated.", bill });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SPLIT BILL
  static async splitBill(req: AuthenticatedRequest, res: Response) {
    const { billId, splitsCount } = req.body;
    if (!billId || !splitsCount) {
      return res.status(400).json({ success: false, error: "billId and splitsCount are required." });
    }

    try {
      const bill = await OrderService.splitBill(billId, splitsCount);
      return res.json({ success: true, bill });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SETTLE BILL (POST /orders/:id/settle)
  static async settleBill(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params; // order id
    const { paymentMode, amount, referenceId, splitPayments } = req.body;

    if (!paymentMode || amount === undefined) {
      return res.status(400).json({ success: false, error: "paymentMode and amount are required settlement fields." });
    }

    try {
      const settlement = await OrderService.settleBill(id, { paymentMode, amount, referenceId, splitPayments });
      return res.json({ success: true, settlement });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // REVERSE SETTLEMENT API
  static async reverseSettlement(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { id } = req.params; // settlement ID
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: "Reversal reason must be specified." });
    }

    try {
      await OrderService.reverseSettlement(restaurantId, branchId, id, reason, uid, username);
      return res.json({ success: true, message: "Settlement reversed and bill reopened." });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // KITCHEN QUEUE API (GET /kds/queue)
  static async getKdsQueue(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const queue = await OrderService.getKdsQueue(restaurantId, branchId);
      return res.json({ success: true, queue });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // UPDATE KOT STATUS FROM KDS (PATCH /kds/:kotId/status)
  static async updateKdsStatus(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { id } = req.params; // kotId
    const { status } = req.body; // e.g. "PREPARING", "READY", etc.

    if (!status) {
      return res.status(400).json({ success: false, error: "status parameter is required." });
    }

    try {
      const kot = await OrderService.updateKdsStatus(restaurantId, branchId, id, status, uid, username);
      return res.json({ success: true, kot });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ESC/POS PRINTABLE PAYLOADS
  static async getPrintPayload(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params; // billId or kotId
    const { type, isDuplicate } = req.query; // 'KOT' or 'BILL'

    if (!type || !['KOT', 'BILL'].includes(type as string)) {
      return res.status(400).json({ success: false, error: "Type must be either 'KOT' or 'BILL'." });
    }

    try {
      const payload = await OrderService.getPrinterPayload(id, type as 'KOT' | 'BILL', isDuplicate === "true");
      return res.json({ success: true, ...payload });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ENTERPRISE REPORT CONTROLLERS
  static async getSalesReport(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    const { branchId, startDate, endDate } = req.query;

    try {
      const summary = await OrderService.getSalesReport(restaurantId, branchId as string, startDate as string, endDate as string);
      return res.json({ success: true, report: summary });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getCaptainPerformance(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    const { branchId } = req.query;

    try {
      const perf = await OrderService.getCaptainPerformance(restaurantId, branchId as string);
      return res.json({ success: true, report: perf });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getItemSalesReport(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    const { branchId } = req.query;

    try {
      const items = await OrderService.getItemSalesReport(restaurantId, branchId as string);
      return res.json({ success: true, report: items });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
