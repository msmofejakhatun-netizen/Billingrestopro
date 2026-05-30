import { Request, Response } from "express";
import { RestaurantService } from "../services/restaurantService";
import { captainRepo, restaurantRepo, branchRepo } from "../repositories";
import bcryptjs from "bcryptjs";
import { generateToken } from "../utils/jwt";

export class AdminController {
  // POST /api/admin/restaurants/create
  static async createRestaurant(req: Request, res: Response) {
    const { 
      name, 
      code, 
      address, 
      phone, 
      gstNumber, 
      ownerName, 
      ownerEmail, 
      ownerUsername, 
      ownerPassword,
      ownerPhone
    } = req.body;

    // Validate required fields
    if (!name || !code || !address || !phone || !ownerName || !ownerEmail || !ownerUsername) {
      console.log("BOOT_ERROR [REST_CREATE_FAIL] Missing required parameters in body:", req.body);
      return res.status(400).json({ 
        success: false, 
        error: "name, code, address, phone, ownerName, ownerEmail, and ownerUsername are all required fields." 
      });
    }

    try {
      console.log("BOOT_START [REST_CREATE] Initiating restaurant and owner configuration for:", code);
      const result = await RestaurantService.createRestaurant({
        name,
        code,
        address,
        phone,
        gstNumber,
        ownerName,
        ownerEmail,
        ownerUsername,
        ownerPassword,
        ownerPhone
      });

      console.log("BOOT_COMPLETE [REST_CREATE_SUCCESS] Successfully configured restaurant:", code);
      return res.status(201).json({
        success: true,
        message: "Restaurant and Owner configured successfully.",
        data: result
      });
    } catch (err: any) {
      console.error("BOOT_ERROR [REST_CREATE_FAIL] Onboarding transaction failed:", err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // POST /api/admin/owners/create
  static async createOwner(req: Request, res: Response) {
    const { restaurantId, branchId, name, email, username, password, phone } = req.body;
    
    if (!restaurantId || !name || !email || !username || !password) {
      console.log("BOOT_ERROR [OWNER_CREATE_FAIL] Missing required owner parameters in body:", req.body);
      return res.status(400).json({ 
        success: false, 
        error: "restaurantId, name, email, username, and password are required fields." 
      });
    }

    try {
      console.log("BOOT_START [OWNER_CREATE] Registering owner user account for email:", email);
      
      const existingEmail = await captainRepo.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        throw new Error(`Conflict: Email '${email}' is already registered in the RBAC system.`);
      }

      const existingUsername = await captainRepo.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        throw new Error(`Conflict: Username '${username}' is already registered in the RBAC system.`);
      }

      const rest = await restaurantRepo.findById(restaurantId);
      if (!rest) {
        throw new Error("Target Restaurant not found in database registry.");
      }

      let activeBranchId = branchId;
      if (!activeBranchId) {
        const branches = await branchRepo.find({ restaurantId });
        if (branches.length > 0) {
          activeBranchId = branches[0]._id;
        }
      }

      const passwordHash = bcryptjs.hashSync(password, 10);
      const ownerPermissions = [
        "MANAGE_RESTAURANT", "MANAGE_STAFF", "MANAGE_MENU", "MANAGE_INVENTORY", "VIEW_ANALYTICS",
        "CAN_CREATE_ORDER", "CAN_EDIT_ORDER", "CAN_CANCEL_ORDER", "CAN_GENERATE_BILL",
        "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY",
        "CAN_VIEW_REPORTS", "CAN_MANAGE_MENU", "CAN_MANAGE_TABLES", "CAN_MANAGE_CAPTAINS"
      ];

      const owner = await captainRepo.create({
        restaurantId,
        branchId: activeBranchId,
        name,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        passwordHash,
        role: "OWNER",
        permissions: ownerPermissions,
        active: true,
        phone
      });

      console.log("[OWNER_CREATE_SUCCESS] Successfully registered Owner record:", owner._id);

      const tokenPayload = {
        uid: owner._id.toString(),
        username: owner.username,
        role: owner.role,
        restaurantId: restaurantId.toString(),
        branchId: activeBranchId ? activeBranchId.toString() : "",
        permissions: owner.permissions || []
      };

      const token = generateToken(tokenPayload);

      console.log("BOOT_COMPLETE [OWNER_CREATE_SUCCESS] Generation of immediate login JWT completed.");
      return res.status(201).json({
        success: true,
        message: "Owner account created successfully and is ready to enter RestoPro.",
        owner: {
          id: owner._id,
          name: owner.name,
          email: owner.email,
          username: owner.username,
          role: owner.role
        },
        token
      });
    } catch (err: any) {
      console.error("BOOT_ERROR [OWNER_CREATE_FAIL] Registration failure:", err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // GET /api/admin/permissions
  static async getPermissions(req: Request, res: Response) {
    try {
      const defaultPermissions = {
        SUPER_ADMIN: ["all"],
        OWNER: [
          "MANAGE_RESTAURANT", "MANAGE_STAFF", "MANAGE_MENU", "MANAGE_INVENTORY", "VIEW_ANALYTICS",
          "CAN_CREATE_ORDER", "CAN_EDIT_ORDER", "CAN_CANCEL_ORDER", "CAN_GENERATE_BILL",
          "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY",
          "CAN_VIEW_REPORTS", "CAN_MANAGE_MENU", "CAN_MANAGE_TABLES", "CAN_MANAGE_CAPTAINS"
        ],
        MANAGER: ["OPERATIONS_MANAGEMENT", "VIEW_REPORTS", "EDIT_MENU", "KDS_ACCESS", "CAN_CREATE_ORDER", "CAN_EDIT_ORDER", "CAN_CANCEL_ORDER", "CAN_GENERATE_BILL", "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY", "CAN_VIEW_REPORTS", "CAN_MANAGE_MENU", "CAN_MANAGE_TABLES"],
        CAPTAIN: ["MANAGE_TABLES", "TAKE_ORDER", "MANAGE_KOT", "RUNNING_ORDERS", "CAN_CREATE_ORDER", "CAN_EDIT_ORDER"],
        CASHIER: ["BILL_SETTLEMENT", "MANAGE_BILLS", "PROCESS_PAYMENTS", "DAY_CLOSE", "CAN_GENERATE_BILL", "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY"],
        KITCHEN: ["KDS_ONLY", "UPDATE_KOT", "CAN_VIEW_REPORTS"]
      };

      return res.json({
        success: true,
        permissions: defaultPermissions
      });
    } catch (err: any) {
      console.error("BOOT_ERROR [PERMISSIONS_LOAD_FAIL]", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
