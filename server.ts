import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Real-time communication for KOT, Orders, etc.
  io.on("connection", (socket) => {
    console.log("New device connected:", socket.id);

    socket.on("join-restaurant", (restaurantId) => {
      socket.join(restaurantId);
      console.log(`Socket ${socket.id} joined restaurant: ${restaurantId}`);
    });

    socket.on("new-order", (data) => {
      // Broadcast to all devices in the same restaurant (KDS, Billing, other Captains)
      io.to(data.restaurantId).emit("order-received", data);
    });

    socket.on("order-update", (data) => {
      io.to(data.restaurantId).emit("order-updated", data);
    });

    socket.on("kot-print", (data) => {
      io.to(data.restaurantId).emit("print-kot", data);
    });

    socket.on("print-request", (data) => {
      // General print request (Bill, KOT, etc.) to be handled by Billing PC
      io.to(data.restaurantId).emit("process-print", data);
    });

    socket.on("disconnect", () => {
      console.log("Device disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "hybrid-server" });
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
    console.log(`Local Hybrid Server running on http://localhost:${PORT}`);
  });
}

startServer();
