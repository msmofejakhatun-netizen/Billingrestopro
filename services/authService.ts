import bcryptjs from "bcryptjs";
import { captainRepo, restaurantRepo, branchRepo, tableRepo, menuCategoryRepo, menuItemRepo } from "../repositories";
import { generateToken, generateRefreshToken } from "../utils/jwt";

export class AuthService {
  static async seedDemoData() {
    console.log("🌱 Checking and seeding Demo RestoPro Restaurant Configuration...");
    let rest = await restaurantRepo.findOne({ code: "DEMO100" });
    if (!rest) {
      console.log("🌱 DEMO100 restaurant not found, creating it...");
      rest = await restaurantRepo.create({
        code: "DEMO100",
        name: "RestoPro Bistro & Lounge",
        address: "123 Gourmet Blvd, Tech District",
        phone: "+91 98765 43210",
        gstNumber: "27AAAAA1111A1Z1",
        active: true,
        status: "ACTIVE"
      });
    }

    let branch = await branchRepo.findOne({ restaurantId: rest._id });
    if (!branch) {
      console.log("🌱 Tech Hub Branch not found, creating it...");
      branch = await branchRepo.create({
        restaurantId: rest._id,
        name: "Tech Hub Branch",
        location: "Phase II, Silicon Valley",
        active: true
      });
    }

    // Seed Captains with Enterprise Roles and Permissions
    const initialRoles = [
      {
        role: "SUPER_OWNER" as const,
        email: "superowner@restopro.com",
        username: "superowner",
        password: "SuperOwner@123",
        permissions: ["all"]
      },
      {
        role: "OWNER" as const,
        email: "owner@restopro.com",
        username: "owner",
        password: "Owner@123",
        permissions: [
          "CAN_CREATE_ORDER", "CAN_EDIT_ORDER", "CAN_CANCEL_ORDER", "CAN_GENERATE_BILL",
          "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY",
          "CAN_VIEW_REPORTS", "CAN_MANAGE_MENU", "CAN_MANAGE_TABLES", "CAN_MANAGE_CAPTAINS"
        ]
      },
      {
        role: "ADMIN" as const,
        email: "admin@restopro.com",
        username: "admin",
        password: "Admin@123",
        permissions: [
          "CAN_CREATE_ORDER", "CAN_EDIT_ORDER", "CAN_CANCEL_ORDER", "CAN_GENERATE_BILL",
          "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY",
          "CAN_VIEW_REPORTS", "CAN_MANAGE_MENU", "CAN_MANAGE_TABLES"
        ]
      },
      {
        role: "MANAGER" as const,
        email: "manager@restopro.com",
        username: "manager",
        password: "Manager@123",
        permissions: [
          "CAN_CREATE_ORDER", "CAN_EDIT_ORDER", "CAN_CANCEL_ORDER", "CAN_GENERATE_BILL",
          "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY",
          "CAN_VIEW_REPORTS", "CAN_MANAGE_MENU", "CAN_MANAGE_TABLES"
        ]
      },
      {
        role: "CAPTAIN" as const,
        email: "captain@restopro.com",
        username: "captain",
        password: "Captain@123",
        permissions: ["CAN_CREATE_ORDER", "CAN_EDIT_ORDER"]
      },
      {
        role: "CASHIER" as const,
        email: "cashier@restopro.com",
        username: "cashier",
        password: "Cashier@123",
        permissions: ["CAN_GENERATE_BILL", "CAN_SETTLE_BILL", "CAN_REPRINT_BILL", "CAN_OPEN_DAY", "CAN_CLOSE_DAY"]
      },
      {
        role: "KITCHEN" as const,
        email: "kitchen@restopro.com",
        username: "kitchen",
        password: "Kitchen@123",
        permissions: ["CAN_VIEW_REPORTS"]
      }
    ];

    for (const item of initialRoles) {
      let existingUser = await captainRepo.findOne({
        restaurantId: rest._id,
        username: item.username
      });
      if (!existingUser) {
        existingUser = await captainRepo.findOne({
          restaurantId: rest._id,
          email: item.email
        });
      }

      if (!existingUser) {
        const passHash = bcryptjs.hashSync(item.password, 10);
        await captainRepo.create({
          restaurantId: rest._id,
          branchId: branch._id,
          username: item.username,
          email: item.email,
          passwordHash: passHash,
          name: `RestoPro ${item.role.replace('_', ' ')}`,
          role: item.role,
          permissions: item.permissions,
          active: true,
          phone: "+91 99999 88888"
        });
      }
    }

    // Seed Tables with branchId
    const existingTables = await tableRepo.find({ restaurantId: rest._id });
    if (existingTables.length === 0) {
      const tblNumbers = ["T1", "T2", "T3", "T4", "T5", "VIP-1", "VIP-2"];
      for (const no of tblNumbers) {
        await tableRepo.create({
          restaurantId: rest._id,
          branchId: branch._id,
          tableNumber: no,
          capacity: no.startsWith("VIP") ? 8 : 4,
          status: "AVAILABLE",
          occupiedSince: null,
          active: true
        });
      }
    }

    // Seed Menu Categories & Menu Items
    const existingCats = await menuCategoryRepo.find({ restaurantId: rest._id });
    if (existingCats.length === 0) {
      const categories = [
        { name: "Appetizers", desc: "Sensational soup & starters", sort: 1 },
        { name: "Main Course", desc: "Chef's gourmet signatures", sort: 2 },
        { name: "Desserts", desc: "Sweet artisan creations", sort: 3 },
        { name: "Beverages", desc: "Ice cold and brewed specials", sort: 4 },
      ];

      const categoryDocs = [];
      for (const cat of categories) {
        const catDoc = await menuCategoryRepo.create({
          restaurantId: rest._id,
          name: cat.name,
          description: cat.desc,
          active: true,
          sortOrder: cat.sort
        });
        categoryDocs.push(catDoc);
      }

      // Seed Menu Items with explicit recipe-capable specs and taxes
      const menuItemsList = [
        {
          catIndex: 0,
          name: "Crispy Spring Rolls",
          price: 180,
          isVeg: true,
          desc: "Golden crispy pastries stuffed with sautéed veggie assortment"
        },
        {
          catIndex: 0,
          name: "Garlic Parmesan Wings",
          price: 240,
          isVeg: false,
          desc: "Jumbo chicken wings coated with aged garlic and parmesan cheese crumble"
        },
        {
          catIndex: 1,
          name: "Butter Chicken Supreme",
          price: 360,
          isVeg: false,
          desc: "Tender chicken chunks slow-simmered in creamy tomato gravy with rich butter"
        },
        {
          catIndex: 1,
          name: "Artisan Paneer Tikka Masala",
          price: 320,
          isVeg: true,
          desc: "Handmade grilled cottage cheese cubes tossed with spiced bell peppers"
        },
        {
          catIndex: 2,
          name: "Molten Choco Lava Cake",
          price: 150,
          isVeg: true,
          desc: "Gooey chocolate center inside baked cake cushion, served warm"
        },
        {
          catIndex: 3,
          name: "Mint Mojito Fizz",
          price: 120,
          isVeg: true,
          desc: "Refreshing garden mint leaves, lime juice splash, and crisp club soda"
        }
      ];

      for (const item of menuItemsList) {
        const catDoc = categoryDocs[item.catIndex];
        await menuItemRepo.create({
          restaurantId: rest._id,
          branchId: branch._id,
          categoryId: catDoc._id,
          name: item.name,
          description: item.desc,
          price: item.price,
          isVeg: item.isVeg,
          active: true,
          variants: [
            { name: "Regular", price: item.price },
            { name: "Large / Double", price: Math.round(item.price * 1.5) }
          ],
          addons: [
            { name: "Extra Cheese", price: 40, available: true },
            { name: "Gourmet Dip", price: 20, available: true }
          ],
          taxes: [
            { name: "CGST", rate: 2.5, type: "CGST" },
            { name: "SGST", rate: 2.5, type: "SGST" }
          ]
        });
      }
    }

    console.log("🟢 Successfully Seeded RestoPro Demo Data Environment!");
  }

  static async login(restaurantCode: string, username: string, passwordPlain: string) {
    await this.seedDemoData(); // Ensure seeded environment

    const rest = await restaurantRepo.findOne({ code: restaurantCode.toUpperCase() });
    if (!rest) {
      throw new Error("Invalid restaurant code");
    }

    if (!rest.active || rest.status !== "ACTIVE") {
      throw new Error("Restaurant inactive");
    }

    let capt = await captainRepo.findOne({
      restaurantId: rest._id,
      username: username.toLowerCase()
    });

    if (!capt) {
      capt = await captainRepo.findOne({
        restaurantId: rest._id,
        email: username.toLowerCase()
      });
    }

    if (!capt) {
      throw new Error("Permission denied");
    }

    if (!capt.active) {
      throw new Error("User disabled");
    }

    const matched = bcryptjs.compareSync(passwordPlain, capt.passwordHash);
    if (!matched) {
      throw new Error("Invalid password");
    }

    const branchIdStr = capt.branchId ? capt.branchId.toString() : "";

    const tokenPayload = {
      uid: capt._id.toString(),
      username: capt.username,
      role: capt.role,
      restaurantId: rest._id.toString(),
      branchId: branchIdStr,
      permissions: capt.permissions || []
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken({ uid: capt._id.toString() });

    return {
      token,
      accessToken: token, // Align with both standards
      refreshToken,
      role: capt.role,
      permissions: capt.permissions || [],
      restaurantId: rest._id.toString(),
      branchId: branchIdStr,
      userId: capt._id.toString(),
      captain: {
        id: capt._id.toString(),
        name: capt.name,
        username: capt.username,
        role: capt.role,
        permissions: capt.permissions,
        branchId: capt.branchId
      },
      restaurant: {
        id: rest._id.toString(),
        code: rest.code,
        name: rest.name,
        address: rest.address,
        gstNumber: rest.gstNumber
      }
    };
  }
}
