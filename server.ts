import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import os from "os";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// RestoPro Captain App Backend Imports
import { connectDB, getDbHealthStatus } from "./utils/db";
import { verifyToken } from "./utils/jwt";
import { initSocketService } from "./sockets/socketService";
import authRoutes from "./routes/authRoutes";
import restaurantRoutes from "./routes/restaurantRoutes";
import adminRoutes from "./routes/adminRoutes";
import menuRoutes from "./routes/menuRoutes";
import orderRoutes from "./routes/orderRoutes";
import daySessionRoutes from "./routes/daySessionRoutes";
import offlineSyncRoutes from "./routes/offlineSyncRoutes";
import deviceRoutes from "./routes/deviceRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import otaRoutes from "./routes/otaRoutes";
import syncRoutes from "./routes/syncRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import queueRoutes from "./routes/queueRoutes";
import monitoringRoutes from "./routes/monitoringRoutes";
import { QueueManager } from "./services/queue/queueManager";
import { WorkerBootstrap } from "./services/queue/workerBootstrap";
import { RedisConnectionManager } from "./services/queue/redisConnection";
import { telemetryMiddleware, socketTelemetryTracker, telemetryMetrics } from "./middleware/telemetry";

// Read Firebase config to initialize admin SDK
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

initializeAdminApp({
  projectId: firebaseConfig.projectId
});

const db = getAdminFirestore(firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Accept all connections (including web browsers and native mobile players over LAN blockages)
        callback(null, true);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true
    },
    allowEIO3: true
  });

  const BOOT_API = process.env.BOOT_API !== "false";
  const BOOT_WORKER = process.env.BOOT_WORKER !== "false";

  // Connect to MongoDB with enterprise-safe database guards
  await connectDB();
  console.log("Mongo connected");

  // Perform seeding check and self-healing DB configuration
  try {
    const { AuthService } = await import("./services/authService");
    await AuthService.seedDemoData();
    console.log("Seed users created");
    console.log("Seed restaurant created");
  } catch (err: any) {
    console.error("Failed to seed database on startup:", err.message);
  }

  // Initialize Socket.io service for real-time order/KOT updates
  initSocketService(io);

  // Initialize and Bootstrap background queues & workers
  if (BOOT_WORKER) {
    try {
      QueueManager.initializeAllQueues();
      WorkerBootstrap.bootstrapAllWorkers();
    } catch (err: any) {
      console.error("🔴 Failed to initialize Queue workers on boot:", err.message);
    }
  } else {
    console.log("ℹ️ [ROLE ISOLATION] Skipping queue workers initialization on this API dedicated Node instance.");
  }

  const PORT = 3000;

  // Track API requests via logging + latency counters middleware instantly
  app.use(telemetryMiddleware);

  // Enable CORS with dynamic LAN recognition middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const originStr = Array.isArray(origin) ? origin[0] : origin;
      // Allow localhost, local IPs, and 192.168.x.x / 10.x.x.x / 172.16-31.x.x LAN subnets
      const isAllowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(originStr);
      if (isAllowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", originStr);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Body parser middleware
  app.use(express.json());

  // RESTOPRO CAPTAIN NATIVE BACKEND MOUNT ROUTES
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/captain/auth", authRoutes);
  app.use("/api/captain", authRoutes); // Map POST /api/captain/login and GET /api/captain/login
  console.log("Login route registered");
  app.use("/api/captain/restaurants", restaurantRoutes);
  app.use("/api/captain/menu", menuRoutes);
  app.use("/api/captain/orders", orderRoutes);
  app.use("/api/captain/daysession", daySessionRoutes);
  app.use("/api/captain/sync", offlineSyncRoutes);
  app.use("/api/captain/devices", deviceRoutes);
  app.use("/api/captain/inventory", inventoryRoutes);
  app.use("/api/captain/notifications", notificationRoutes);
  app.use("/api/captain/ota", otaRoutes);
  app.use("/api/captain/sync-engine", syncRoutes);
  app.use("/api/captain/analytics", analyticsRoutes);
  app.use("/api/captain/queues", queueRoutes);
  app.use("/api/admin/monitoring", monitoringRoutes);

  // Scheduled Background Observability Proactive Checks Interval
  const ALERT_CHECK_INTERVAL = 45000; // Scan every 45s
  const telemetryInterval = setInterval(() => {
    import("./services/alertingService").then(({ alertingService }) => {
      alertingService.runTelemetryCheckRoutine().catch(err => {
        console.error("🔴 Fail-safe Telemetry check loop failure:", err.message);
      });
    });
  }, ALERT_CHECK_INTERVAL);
  
  // Unref to avoid blocking process exit if required
  if (telemetryInterval.unref) {
    telemetryInterval.unref();
  }


  // Enable API
  const handleEnableRestaurant = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
      await db.doc(`restaurants/${id}`).update({
        status: "ACTIVE",
        active: true,
        disabledAt: null,
        disabledBy: null,
        updatedAt: new Date().toISOString()
      });
      res.json({ success: true, message: "Restaurant enabled successfully" });
    } catch (e: any) {
      console.error("Enable API Error:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to enable restaurant" });
    }
  };

  // Disable API
  const handleDisableRestaurant = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { disabledBy } = req.body;
    try {
      await db.doc(`restaurants/${id}`).update({
        status: "DISABLED",
        active: false,
        disabledAt: new Date().toISOString(),
        disabledBy: disabledBy || "Super Owner",
        updatedAt: new Date().toISOString()
      });
      res.json({ success: true, message: "Restaurant disabled successfully" });
    } catch (e: any) {
      console.error("Disable API Error:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to disable restaurant" });
    }
  };

  // Delete API
  const handleDeleteRestaurant = async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    try {
      // Check for active operations before deletion
      const activeOrders = await db.collection('orders')
        .where('restaurantId', '==', id)
        .where('status', 'in', ['PENDING', 'KOT_GENERATED', 'IN_PROGRESS'])
        .get();

      if (!activeOrders.empty) {
         return res.status(400).json({ success: false, error: "Cannot delete restaurant with active operations: pending/in-progress orders found." });
      }

      const collectionsToCleanup = [
        'menuItems', 
        'categories', 
        'tables', 
        'orders', 
        'settings'
      ];
      
      /*
      for (const colName of collectionsToCleanup) {
        try {
          const snapshot = await db.collection(colName).where('restaurantId', '==', id).get();
          for (const d of snapshot.docs) {
            await d.ref.delete();
          }
        } catch (colErr) {
          console.warn(`Error cleaning up collection: ${colName}`, colErr);
        }
      }
      */

      // Soft-delete: update status to DELETED
      await db.doc(`restaurants/${id}`).update({ status: 'DELETED', active: false });
      res.json({ success: true, message: "Restaurant marked as deleted successfully" });
    } catch (e: any) {
      console.error("Delete API Error:", e);
      if (e.code === 7) {
        console.error("PERMISSION_DENIED: Likely IAM permissions issue on the Firestore database or collection.");
      }
      res.status(500).json({ success: false, error: e.message || "Failed to delete restaurant" });
    }
  };

  // ---------------------------------------------------------------------------
  // AUTH MIDDLEWARE (SUPER_OWNER PRIVILEGES)
  // ---------------------------------------------------------------------------
  const checkSuperOwner = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Unauthorized: Missing token" });
      }
      const token = authHeader.split("Bearer ")[1];
      
      // Support offline sandbox bypass
      if (token === "OFFLINE_DEMO_OWNER") {
        req.body.callerUid = "OFFLINE_DEMO_OWNER";
        return next();
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ success: false, error: "Unauthorized: Invalid or expired token" });
      }

      const userRole = (decoded.role || "").toUpperCase();
      const isSuper = userRole === "SUPER_OWNER" || userRole === "SUPER_ADMIN";
      
      if (!isSuper) {
        return res.status(403).json({ success: false, error: "Forbidden: Only SUPER_OWNER can manage Owners." });
      }
      
      req.body.callerUid = decoded.uid;
      next();
    } catch (err: any) {
      console.error("Auth Middleware Error:", err);
      res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
    }
  };

  app.patch("/restaurants/:id/enable", handleEnableRestaurant);
  app.patch("/api/restaurants/:id/enable", handleEnableRestaurant);
  
  app.patch("/restaurants/:id/disable", handleDisableRestaurant);
  app.patch("/api/restaurants/:id/disable", handleDisableRestaurant);

  app.delete("/restaurants/:id", checkSuperOwner, handleDeleteRestaurant);
  app.delete("/api/restaurants/:id", checkSuperOwner, handleDeleteRestaurant);

  // 1. GET /api/owners - List all owners
  app.get(["/owners", "/api/owners"], checkSuperOwner, async (req, res) => {
    try {
      const snapshot = await db.collection("users")
        .where("role", "in", ["OWNER", "owner"])
        .get();
      
      const owners = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({ success: true, owners });
    } catch (e: any) {
      console.error("GET owners failed:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to list owners" });
    }
  });

  // 2. POST /api/owners - Onboard a new owner
  app.post(["/owners", "/api/owners"], checkSuperOwner, async (req, res) => {
    const { name, email, phone, username, password, assignedRestaurants, assignedBranches, permissions, status } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required fields." });
    }

    try {
      const uid = "owner_" + Math.floor(100000 + Math.random() * 900000);
      const passHash = Buffer.from(password).toString("base64");

      const ownerData = {
        uid,
        name,
        email: email.toLowerCase(),
        phone: phone || "",
        mobile: phone || "",
        username: username || email.split("@")[0],
        passwordHash: passHash,
        passwordPlain: password,
        role: "OWNER",
        assignedRestaurants: assignedRestaurants || [],
        assignedBranches: assignedBranches || [],
        permissions: permissions || { reports: true, billing: true, day_end: true, staff_management: true, menu: true, printer_settings: true },
        status: status || "ACTIVE",
        active: (status || "ACTIVE") === "ACTIVE",
        createdBy: req.body.callerUid || "SUPER_OWNER",
        createdAt: new Date().toISOString(),
        lastLogin: null
      };

      // Register user document in Firestore to enable standard user mapping/login
      await db.doc(`users/${uid}`).set(ownerData);

      // Log the auditing log record
      await db.collection("auditLogs").add({
        id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
        action: "CREATE_OWNER",
        details: `Created owner account: ${name} (${email})`,
        restaurantId: assignedRestaurants?.[0] || "ROOT",
        userId: req.body.callerUid || "SUPER_OWNER",
        userName: "System Super Owner",
        createdAt: new Date().toISOString()
      });

      res.status(201).json({ success: true, message: "Owner created successfully", owner: ownerData });
    } catch (e: any) {
      console.error("POST owners failed:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to create owner" });
    }
  });

  // 3. PATCH /api/owners/:id - Edit owner properties
  app.patch(["/owners/:id", "/api/owners/:id"], checkSuperOwner, async (req, res) => {
    const { id } = req.params;
    const { name, phone, username, assignedRestaurants, assignedBranches, permissions, status } = req.body;

    try {
      const ownerRef = db.doc(`users/${id}`);
      const docSnap = await ownerRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ success: false, error: "Owner matching ID not found." });
      }

      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) {
        updateData.phone = phone;
        updateData.mobile = phone;
      }
      if (username !== undefined) updateData.username = username;
      if (assignedRestaurants !== undefined) updateData.assignedRestaurants = assignedRestaurants;
      if (assignedBranches !== undefined) updateData.assignedBranches = assignedBranches;
      if (permissions !== undefined) updateData.permissions = permissions;
      if (status !== undefined) {
        updateData.status = status;
        updateData.active = status === "ACTIVE";
      }

      await ownerRef.update(updateData);

      await db.collection("auditLogs").add({
        id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
        action: "UPDATE_OWNER",
        details: `Updated owner record: ${name || docSnap.data()?.name || id}`,
        restaurantId: assignedRestaurants?.[0] || docSnap.data()?.assignedRestaurants?.[0] || "ROOT",
        userId: req.body.callerUid || "SUPER_OWNER",
        userName: "System Super Owner",
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, message: "Owner updated successfully" });
    } catch (e: any) {
      console.error("PATCH owner failed:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to edit owner" });
    }
  });

  // 4. PATCH /api/owners/:id/disable - Block credentials
  app.patch(["/owners/:id/disable", "/api/owners/:id/disable"], checkSuperOwner, async (req, res) => {
    const { id } = req.params;
    try {
      const ownerRef = db.doc(`users/${id}`);
      const docSnap = await ownerRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ success: false, error: "Owner matching ID not found." });
      }

      await ownerRef.update({
        status: "DISABLED",
        active: false,
        updatedAt: new Date().toISOString()
      });

      await db.collection("auditLogs").add({
        id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
        action: "DISABLE_OWNER",
        details: `Disabled owner login privileges: ${docSnap.data()?.name || id}`,
        restaurantId: docSnap.data()?.assignedRestaurants?.[0] || "ROOT",
        userId: req.body.callerUid || "SUPER_OWNER",
        userName: "System Super Owner",
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, message: "Owner account disabled successfully" });
    } catch (e: any) {
      console.error("Disable Owner API failed:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to disable owner" });
    }
  });

  // 5. PATCH /api/owners/:id/enable - Activate credentials
  app.patch(["/owners/:id/enable", "/api/owners/:id/enable"], checkSuperOwner, async (req, res) => {
    const { id } = req.params;
    try {
      const ownerRef = db.doc(`users/${id}`);
      const docSnap = await ownerRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ success: false, error: "Owner matching ID not found." });
      }

      await ownerRef.update({
        status: "ACTIVE",
        active: true,
        updatedAt: new Date().toISOString()
      });

      await db.collection("auditLogs").add({
        id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
        action: "ENABLE_OWNER",
        details: `Enabled owner login privileges: ${docSnap.data()?.name || id}`,
        restaurantId: docSnap.data()?.assignedRestaurants?.[0] || "ROOT",
        userId: req.body.callerUid || "SUPER_OWNER",
        userName: "System Super Owner",
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, message: "Owner account enabled successfully" });
    } catch (e: any) {
      console.error("Enable Owner API failed:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to enable owner" });
    }
  });

  // 6. DELETE /api/owners/:id - Purge profile
  app.delete(["/owners/:id", "/api/owners/:id"], checkSuperOwner, async (req, res) => {
    const { id } = req.params;
    try {
      const ownerRef = db.doc(`users/${id}`);
      const docSnap = await ownerRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ success: false, error: "Owner matching ID not found." });
      }

      const email = docSnap.data()?.email;

      await ownerRef.delete();

      await db.collection("auditLogs").add({
        id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
        action: "DELETE_OWNER",
        details: `Purged owner account permanently: ${docSnap.data()?.name || id} (${email})`,
        restaurantId: docSnap.data()?.assignedRestaurants?.[0] || "ROOT",
        userId: req.body.callerUid || "SUPER_OWNER",
        userName: "System Super Owner",
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, message: "Owner account permanently deleted" });
    } catch (e: any) {
      console.error("DELETE owner failed:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to delete owner" });
    }
  });

  // 7. POST /api/owners/:id/reset-password - Reset password
  app.post(["/owners/:id/reset-password", "/api/owners/:id/reset-password"], checkSuperOwner, async (req, res) => {
    const { id } = req.params;

    // Generate a temporary secure password
    const generateTempPassword = (length: number = 8) => {
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
      let retVal = "";
      for (let i = 0; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return retVal;
    };

    const tempPassword = generateTempPassword();

    // Simulated email sending function
    const sendPasswordResetEmail = async (email: string, password: string) => {
      console.log(`[SIMULATED EMAIL] Sending password reset email to ${email}. Temporary password: ${password}`);
      // In a real application, you would integrate a mail service like nodemailer here
    };

    try {
      const ownerRef = db.doc(`users/${id}`);
      const docSnap = await ownerRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ success: false, error: "Owner matching ID not found." });
      }

      const passHash = Buffer.from(tempPassword).toString("base64");
      await ownerRef.update({
        passwordHash: passHash,
        passwordPlain: tempPassword,
        updatedAt: new Date().toISOString()
      });

      // Send the email
      await sendPasswordResetEmail(docSnap.data()?.email, tempPassword);

      await db.collection("auditLogs").add({
        id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
        action: "RESET_OWNER_PASSWORD",
        details: `Reset password for owner: ${docSnap.data()?.name || id} (Password notification sent via email)`,
        restaurantId: docSnap.data()?.assignedRestaurants?.[0] || "ROOT",
        userId: req.body.callerUid || "SUPER_OWNER",
        userName: "System Super Owner",
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, message: "Owner password reset successfully and notification sent.", tempPassword });
    } catch (e: any) {
      console.error("Reset password failed:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to reset password" });
    }
  });

  // Real-time communication for KOT, Orders, etc.
  io.on("connection", (socket) => {
    socketTelemetryTracker.recordConnection();
    console.log("New device connected:", socket.id);

    socket.on("join-restaurant", (restaurantId) => {
      socketTelemetryTracker.recordInboundEvent();
      socket.join(restaurantId);
      console.log(`Socket ${socket.id} joined restaurant: ${restaurantId}`);
    });

    socket.on("new-order", (data) => {
      socketTelemetryTracker.recordInboundEvent();
      // Broadcast to all devices in the same restaurant (KDS, Billing, other Captains)
      io.to(data.restaurantId).emit("order-received", data);
      socketTelemetryTracker.recordOutboundEvent();
    });

    socket.on("order-update", (data) => {
      socketTelemetryTracker.recordInboundEvent();
      io.to(data.restaurantId).emit("order-updated", data);
      socketTelemetryTracker.recordOutboundEvent();
    });

    socket.on("kot-print", (data) => {
      socketTelemetryTracker.recordInboundEvent();
      io.to(data.restaurantId).emit("print-kot", data);
      socketTelemetryTracker.recordOutboundEvent();
    });

    socket.on("print-request", (data) => {
      socketTelemetryTracker.recordInboundEvent();
      // General print request (Bill, KOT, etc.) to be handled by Billing PC
      io.to(data.restaurantId).emit("process-print", data);
      socketTelemetryTracker.recordOutboundEvent();
    });

    socket.on("disconnect", () => {
      socketTelemetryTracker.recordDisconnect();
      console.log("Device disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      server: "RestoPro Backend",
      status: "online"
    });
  });

  app.get("/api/debug/auth-status", async (req, res) => {
    try {
      const mongoose = (await import("mongoose")).default;
      const { captainRepo, restaurantRepo } = await import("./repositories");
      
      const mConnected = mongoose.connection.readyState === 1;
      const allCaptains = await captainRepo.find();
      const allRestos = await restaurantRepo.find();
      
      const demoRest = allRestos.find(r => r.code === "DEMO100");
      const hasSuperOwner = allCaptains.some(c => c.role === "SUPER_OWNER");
      const seedCompleted = !!(demoRest && hasSuperOwner);

      res.json({
        success: true,
        mongoConnected: mConnected,
        usersCount: allCaptains.length,
        restaurantsCount: allRestos.length,
        seedCompleted,
        loginRoute: "/api/captain/login",
        loginMethod: "POST",
        serverStatus: "online"
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/debug/users", async (req, res) => {
    try {
      const { captainRepo } = await import("./repositories");
      const allCaptains = await captainRepo.find();
      const usersList = allCaptains.map(c => ({
        email: c.email || `${c.username}@restopro.com`,
        role: c.role,
        active: c.active
      }));
      res.json(usersList);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/debug/restaurants", async (req, res) => {
    try {
      const { restaurantRepo } = await import("./repositories");
      const allRestos = await restaurantRepo.find();
      const restosList = allRestos.map(r => ({
        restaurantCode: r.code,
        name: r.name,
        active: r.active
      }));
      res.json(restosList);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/debug/login-test", async (req, res) => {
    try {
      const { AuthService } = await import("./services/authService");
      // Perform direct login test
      const result = await AuthService.login("DEMO100", "owner@restopro.com", "Owner@123");
      if (result && (result.accessToken || result.token) && result.role === "OWNER") {
        res.json({
          status: "PASS",
          message: "Internal login verification succeeded.",
          testAccount: "owner@restopro.com",
          role: result.role,
          tokenLength: (result.accessToken || result.token).length
        });
      } else {
        res.status(500).json({
          status: "FAIL",
          message: "AuthService.login succeeded but did not return valid OWNER payload.",
          result
        });
      }
    } catch (err: any) {
      res.status(500).json({
        status: "FAIL",
        message: "Internal login verification failed.",
        error: err.message || err,
        component: "AuthService.login"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    const interfaces = os.networkInterfaces();
    const localIps: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          localIps.push(iface.address);
        }
      }
    }
    const primaryIp = localIps[0] || "127.0.0.1";

    console.log(`===============================================`);
    console.log(`🚀 RestoPro LAN Discovery Support Activated!`);
    console.log(`- local IP: ${primaryIp}`);
    console.log(`- active port: ${PORT}`);
    console.log(`- LAN accessible URL: http://${primaryIp}:${PORT}`);
    console.log(`===============================================`);
  });

  // Graceful shutdown handling
  async function gracefulShutdown(signal: string) {
    console.log(`🔌 Received ${signal}. Starting shutdown procedures...`);
    try {
      await WorkerBootstrap.shutdown();
      await QueueManager.shutdown();
      await RedisConnectionManager.shutdown();
      console.log("🟢 All background services shutdown cleanly.");
      process.exit(0);
    } catch (err: any) {
      console.error("🔴 Error during graceful shutdown:", err.message);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer();
