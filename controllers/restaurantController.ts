import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { RestaurantService } from "../services/restaurantService";

export class RestaurantController {
  // CREATE restaurant
  static async createRestaurant(req: AuthenticatedRequest, res: Response) {
    const { name, code, address, phone, gstNumber } = req.body;
    if (!name || !code || !address || !phone) {
      return res.status(400).json({ success: false, error: "name, code, address, and phone are required fields." });
    }

    try {
      const rest = await RestaurantService.createRestaurant({ name, code, address, phone, gstNumber });
      return res.status(201).json({ success: true, message: "Restaurant configured successfully.", restaurant: rest });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // UPDATE RESTAURANT ACTIVE STATUS (Enable/Disable/Soft-delete)
  static async setStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status } = req.body; // 'ACTIVE', 'DISABLED', 'DELETED'

    if (!status || !['ACTIVE', 'DISABLED', 'DELETED'].includes(status)) {
      return res.status(400).json({ success: false, error: "Valid status ('ACTIVE' | 'DISABLED' | 'DELETED') is required." });
    }

    try {
      const updated = await RestaurantService.setStatus(id, status);
      return res.json({ success: true, message: `Restaurant status updated to ${status}.`, restaurant: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // CREATE branch supporting multipic network
  static async createBranch(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    const { name, location } = req.body;

    if (!name || !location) {
      return res.status(400).json({ success: false, error: "name and location are required branch parameters." });
    }

    try {
      const branch = await RestaurantService.createBranch(restaurantId, { name, location });
      return res.status(201).json({ success: true, branch });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Branch activation toggle
  static async toggleBranch(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { active } = req.body;

    if (active === undefined) {
      return res.status(400).json({ success: false, error: "active state is required." });
    }

    try {
      const branch = await RestaurantService.setBranchStatus(id, active);
      return res.json({ success: true, message: "Branch state updated.", branch });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getBranches(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    try {
      const branches = await RestaurantService.getBranches(restaurantId);
      return res.json({ success: true, branches });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // CREATE table
  static async createTable(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { tableNumber, capacity } = req.body;

    if (!tableNumber) {
      return res.status(400).json({ success: false, error: "tableNumber is required." });
    }

    try {
      const tbl = await RestaurantService.createTable(restaurantId, branchId, tableNumber, capacity);
      return res.status(201).json({ success: true, table: tbl });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET tables
  static async getTables(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    try {
      const tables = await RestaurantService.getTables(restaurantId, branchId);
      return res.json({ success: true, tables });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PATCH table status
  static async updateTableStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, currentOrderId } = req.body;

    if (!status || !['AVAILABLE', 'RUNNING', 'READY', 'BILLED', 'RESERVED'].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status state." });
    }

    try {
      const updated = await RestaurantService.updateTableStatus(id, status, currentOrderId || null);
      return res.json({ success: true, table: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async mergeTables(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { primaryTableId, secondaryTableIds } = req.body;

    if (!primaryTableId || !secondaryTableIds || !Array.isArray(secondaryTableIds)) {
      return res.status(400).json({ success: false, error: "primaryTableId and non-empty secondaryTableIds list are required." });
    }

    try {
      const table = await RestaurantService.mergeTables(restaurantId, branchId, primaryTableId, secondaryTableIds, uid, username);
      return res.json({ success: true, table });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async splitTable(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { primaryTableId } = req.body;

    if (!primaryTableId) {
      return res.status(400).json({ success: false, error: "primaryTableId parameter is required." });
    }

    try {
      const table = await RestaurantService.splitTable(restaurantId, branchId, primaryTableId, uid, username);
      return res.json({ success: true, table });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async transferTable(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId, uid, username } = req.user!;
    const { activeOrderId, sourceTableId, targetTableId } = req.body;

    if (!activeOrderId || !sourceTableId || !targetTableId) {
      return res.status(400).json({ success: false, error: "activeOrderId, sourceTableId, and targetTableId are required." });
    }

    try {
      await RestaurantService.transferTable(restaurantId, branchId, activeOrderId, sourceTableId, targetTableId, uid, username);
      return res.json({ success: true, message: "Table transferred successfully." });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async reserveTable(req: AuthenticatedRequest, res: Response) {
    const { uid, username } = req.user!;
    const { tableId, guestName, contactNo, reservedFor, numberOfGuests } = req.body;

    if (!tableId || !guestName || !reservedFor) {
      return res.status(400).json({ success: false, error: "tableId, guestName, and reservedFor are required." });
    }

    try {
      const tbl = await RestaurantService.setReservation(tableId, { guestName, contactNo, reservedFor: new Date(reservedFor), numberOfGuests }, uid, username);
      return res.json({ success: true, table: tbl });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async suspendCaptain(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { active } = req.body; // true/false

    if (active === undefined) {
      return res.status(400).json({ success: false, error: "active selection state is required." });
    }

    try {
      const cap = await RestaurantService.setCaptainStatus(id, active);
      return res.json({ success: true, message: "Captain suspended/unsuspended successfully.", captain: cap });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getOwnerDashboard(req: AuthenticatedRequest, res: Response) {
    const { restaurantId } = req.user!;
    try {
      const data = await RestaurantService.getCentralDashboard(restaurantId);
      return res.json({ success: true, dashboard: data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
