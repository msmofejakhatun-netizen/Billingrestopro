import { restaurantRepo, branchRepo, tableRepo, captainRepo, orderRepo, roleRepo } from "../repositories";
import AuditLog from "../models/AuditLog";
import bcryptjs from "bcryptjs";

export class RestaurantService {
  static async createRestaurant(data: { 
    name: string, 
    code: string, 
    address: string, 
    phone: string, 
    gstNumber?: string,
    ownerName?: string,
    ownerEmail?: string,
    ownerUsername?: string,
    ownerPassword?: string,
    ownerPhone?: string
  }) {
    const codeUpper = data.code.toUpperCase();
    const existing = await restaurantRepo.findOne({ code: codeUpper });
    if (existing) {
      throw new Error(`Conflict: Restaurant with code ${codeUpper} already exists.`);
    }

    const ownerName = data.ownerName || "Default Owner";
    const emailLower = (data.ownerEmail || "owner@example.com").toLowerCase();
    const usernameLower = (data.ownerUsername || "owner").toLowerCase();

    const existingEmail = await captainRepo.findOne({ email: emailLower });
    if (existingEmail && data.ownerEmail) {
      throw new Error(`Conflict: Owner with email '${emailLower}' already exists.`);
    }

    const existingUsername = await captainRepo.findOne({ username: usernameLower });
    if (existingUsername && data.ownerUsername) {
      throw new Error(`Conflict: Owner with username '${usernameLower}' already exists.`);
    }

    const rest = await restaurantRepo.create({
      code: codeUpper,
      name: data.name,
      address: data.address,
      phone: data.phone,
      gstNumber: data.gstNumber,
      active: true,
      status: "ACTIVE"
    });

    // Create default branch
    const branch = await branchRepo.create({
      restaurantId: rest._id,
      name: "Main Branch",
      location: data.address,
      active: true
    });

    // Create default roles if not exists
    const defaultRolesSeed = [
      { name: "SUPER_ADMIN", displayName: "Super Administrator", permissions: ["all"] },
      { name: "OWNER", displayName: "Restaurant Owner", permissions: ["MANAGE_RESTAURANT", "MANAGE_STAFF", "MANAGE_MENU", "MANAGE_INVENTORY", "VIEW_ANALYTICS"] },
      { name: "MANAGER", displayName: "Restaurant Manager", permissions: ["OPERATIONS_MANAGEMENT", "VIEW_REPORTS", "EDIT_MENU", "KDS_ACCESS"] },
      { name: "CAPTAIN", displayName: "Captain / Order Taker", permissions: ["MANAGE_TABLES", "TAKE_ORDER", "MANAGE_KOT", "RUNNING_ORDERS"] },
      { name: "CASHIER", displayName: "Cashier / Billing Agent", permissions: ["BILL_SETTLEMENT", "MANAGE_BILLS", "PROCESS_PAYMENTS", "DAY_CLOSE"] },
      { name: "KITCHEN", displayName: "Kitchen Display Staff", permissions: ["KDS_ONLY", "UPDATE_KOT"] }
    ];

    for (const r of defaultRolesSeed) {
      const existingRole = await roleRepo.findOne({ name: r.name });
      if (!existingRole) {
        await roleRepo.create({
          name: r.name,
          displayName: r.displayName,
          permissions: r.permissions
        });
      }
    }

    // Create default tables
    const defaultTables = ["T1", "T2", "T3", "T4", "T5"];
    for (const no of defaultTables) {
      await tableRepo.create({
        restaurantId: rest._id,
        branchId: branch._id,
        tableNumber: no,
        capacity: 4,
        status: "AVAILABLE",
        active: true
      });
    }

    // Hash password & Create Owner account
    const rawPass = data.ownerPassword || "password123";
    const passwordHash = bcryptjs.hashSync(rawPass, 10);
    const ownerPermissions = [
      "MANAGE_RESTAURANT", "MANAGE_STAFF", "MANAGE_MENU", "MANAGE_INVENTORY", "VIEW_ANALYTICS",
      "CAN_CREATE_ORDER", "CAN_EDIT_ORDER", "CAN_CANCEL_ORDER", "CAN_GENERATE_BILL",
      "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY",
      "CAN_VIEW_REPORTS", "CAN_MANAGE_MENU", "CAN_MANAGE_TABLES", "CAN_MANAGE_CAPTAINS"
    ];

    const owner = await captainRepo.create({
      restaurantId: rest._id,
      branchId: branch._id,
      name: ownerName,
      email: emailLower,
      username: usernameLower,
      passwordHash,
      role: "OWNER",
      permissions: ownerPermissions,
      active: true,
      phone: data.ownerPhone || data.phone
    });

    return {
      restaurant: rest,
      branch: branch,
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        username: owner.username,
        role: owner.role,
        permissions: owner.permissions
      }
    };
  }

  static async setStatus(restaurantId: string, status: 'ACTIVE' | 'DISABLED' | 'DELETED') {
    const rest = await restaurantRepo.findById(restaurantId);
    if (!rest) {
      throw new Error("Restaurant matching ID not found.");
    }

    return await restaurantRepo.updateById(restaurantId, {
      status,
      active: status === 'ACTIVE'
    });
  }

  static async createBranch(restaurantId: string, branchData: { name: string, location: string }) {
    return await branchRepo.create({
      restaurantId,
      name: branchData.name,
      location: branchData.location,
      active: true
    });
  }

  static async setBranchStatus(branchId: string, active: boolean) {
    const branch = await branchRepo.findById(branchId);
    if (!branch) {
      throw new Error("Branch ID matching target does not exist.");
    }
    return await branchRepo.updateById(branchId, { active });
  }

  static async getBranches(restaurantId: string) {
    return await branchRepo.find({ restaurantId });
  }

  // TABLE OPERATIONS (Multi-Branch enabled)
  static async createTable(restaurantId: string, branchId: string, tableNumber: string, capacity: number = 4) {
    const existing = await tableRepo.findOne({ restaurantId, branchId, tableNumber });
    if (existing) {
      throw new Error(`Table ${tableNumber} already exists in this branch.`);
    }

    return await tableRepo.create({
      restaurantId,
      branchId,
      tableNumber,
      capacity,
      status: "AVAILABLE",
      active: true
    });
  }

  static async getTables(restaurantId: string, branchId?: string) {
    const query: any = { restaurantId, active: true };
    if (branchId) {
      query.branchId = branchId;
    }
    return await tableRepo.find(query);
  }

  static async updateTableStatus(tableId: string, status: 'AVAILABLE' | 'RUNNING' | 'READY' | 'BILLED' | 'RESERVED', currentOrderId: string | null = null) {
    const table = await tableRepo.findById(tableId);
    if (!table) {
      throw new Error("Table matching ID not found.");
    }

    const occupiedSince = (status === 'RUNNING') ? new Date() : null;

    return await tableRepo.updateById(tableId, {
      status,
      currentOrderId,
      occupiedSince
    });
  }

  // LIVE TABLE ENGINE
  static async mergeTables(restaurantId: string, branchId: string, primaryTableId: string, secondaryTableIds: string[], userId: string, userName: string) {
    const primary = await tableRepo.findById(primaryTableId);
    if (!primary || primary.status !== "RUNNING") {
      throw new Error("Primary table must be established and running first to initiate merge.");
    }

    const mergedTargets: string[] = [];
    for (const sId of secondaryTableIds) {
      if (sId === primaryTableId) continue;
      const sec = await tableRepo.findById(sId);
      if (sec) {
        await tableRepo.updateById(sId, {
          status: "RUNNING",
          currentOrderId: primary.currentOrderId
        });
        mergedTargets.push(sec.tableNumber);
      }
    }

    const updated = await tableRepo.updateById(primaryTableId, {
      mergedWith: secondaryTableIds
    });

    await AuditLog.create({
      restaurantId,
      branchId,
      action: "TABLE_MERGE",
      details: `Merged primary table ${primary.tableNumber} with secondary tables: ${mergedTargets.join(", ")}`,
      userId,
      userName
    });

    return updated;
  }

  static async splitTable(restaurantId: string, branchId: string, primaryTableId: string, userId: string, userName: string) {
    const primary = await tableRepo.findById(primaryTableId);
    if (!primary) {
      throw new Error("Physical primary table not found.");
    }

    const merged = primary.mergedWith || [];
    for (const mId of merged) {
      await tableRepo.updateById(mId, {
        status: "AVAILABLE",
        currentOrderId: null,
        mergedWith: []
      });
    }

    const updated = await tableRepo.updateById(primaryTableId, {
      mergedWith: []
    });

    await AuditLog.create({
      restaurantId,
      branchId,
      action: "TABLE_SPLIT",
      details: `Split tables associated with primary table ${primary.tableNumber}`,
      userId,
      userName
    });

    return updated;
  }

  static async transferTable(restaurantId: string, branchId: string, activeOrderId: string, sourceTableId: string, targetTableId: string, userId: string, userName: string) {
    const order = await orderRepo.findById(activeOrderId);
    if (!order) {
      throw new Error("Active order matching ID not found.");
    }

    const source = await tableRepo.findById(sourceTableId);
    const target = await tableRepo.findById(targetTableId);

    if (!source || !target) {
      throw new Error("Source or Target table does not exist.");
    }

    if (target.status !== "AVAILABLE") {
      throw new Error("Target table is not currently AVAILABLE for transfer.");
    }

    // Update target table to running
    await tableRepo.updateById(targetTableId, {
      status: "RUNNING",
      currentOrderId: activeOrderId,
      occupiedSince: source.occupiedSince || new Date()
    });

    // Update source table to AVAILABLE
    await tableRepo.updateById(sourceTableId, {
      status: "AVAILABLE",
      currentOrderId: null,
      occupiedSince: null,
      mergedWith: []
    });

    // Update order with new table properties
    await orderRepo.updateById(activeOrderId, {
      tableId: targetTableId,
      tableNumber: target.tableNumber
    });

    await AuditLog.create({
      restaurantId,
      branchId,
      action: "TABLE_TRANSFER",
      details: `Transferred order ${activeOrderId} from Table ${source.tableNumber} to Table ${target.tableNumber}`,
      userId,
      userName
    });

    return { success: true };
  }

  static async setReservation(tableId: string, data: { guestName: string, contactNo: string, reservedFor: Date, numberOfGuests: number }, userId: string, userName: string) {
    const table = await tableRepo.findById(tableId);
    if (!table) {
      throw new Error("Table selection invalid.");
    }

    const updated = await tableRepo.updateById(tableId, {
      status: "RESERVED",
      reservationDetails: data
    });

    await AuditLog.create({
      restaurantId: table.restaurantId,
      branchId: table.branchId,
      action: "TABLE_RESERVATION",
      details: `Reserved Table ${table.tableNumber} for guest ${data.guestName} at ${new Date(data.reservedFor).toLocaleTimeString()}`,
      userId,
      userName
    });

    return updated;
  }

  // SUSPENSTION & CAPTAIN MGMT
  static async setCaptainStatus(captainId: string, active: boolean) {
    return await captainRepo.updateById(captainId, { active });
  }

  // CENTRAL OWNER DASHBOARD UTILITY
  static async getCentralDashboard(restaurantId: string) {
    const branches = await branchRepo.find({ restaurantId });
    const tables = await tableRepo.find({ restaurantId, active: true });
    
    const occupiedTables = tables.filter(t => t.status === "RUNNING");
    const occupancyRate = tables.length > 0 ? (occupiedTables.length / tables.length) * 100 : 0;

    // Get active day end details
    const activeOrders = await orderRepo.find({ restaurantId, status: "RUNNING" });

    return {
      branchesCount: branches.length,
      tablesCount: tables.length,
      occupancyRate: Math.round(occupancyRate),
      occupiedTablesCount: occupiedTables.length,
      activeRunningOrdersCount: activeOrders.length,
      branches: branches.map(b => ({ id: b._id, name: b.name, active: b.active }))
    };
  }
}
