import { Server, Socket } from "socket.io";

let io: Server | null = null;

export const getSocketInstance = (): Server | null => {
  return io;
};

export const initSocketService = (socketIoInstance: Server) => {
  io = socketIoInstance;

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Devices Connected to Sockets: ${socket.id}`);

    // Standard Room system per Restaurant for isolation
    socket.on("join-restaurant", (restaurantId: string) => {
      socket.join(restaurantId);
      console.log(`📡 Socket ${socket.id} joined restaurant room: ${restaurantId}`);
    });

    // Sub-Room system per Branch for deep enterprise isolation
    socket.on("join-branch", (branchId: string) => {
      socket.join(`branch:${branchId}`);
      console.log(`📡 Socket ${socket.id} joined branch room: branch:${branchId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Device disconnected from Sockets: ${socket.id}`);
    });
  });
};

export const emitToRestaurant = (restaurantId: string, event: string, payload: any) => {
  if (io) {
    io.to(restaurantId).emit(event, payload);
    console.log(`✨ Socket broadcast to ${restaurantId}: ${event}`);
  } else {
    console.warn("⚠️ Socket server not initialized yet");
  }
};

export const emitToBranch = (branchId: string, event: string, payload: any) => {
  if (io) {
    const room = `branch:${branchId}`;
    io.to(room).emit(event, payload);
    console.log(`✨ Socket broadcast to branch room ${room}: ${event}`);
  } else {
    console.warn("⚠️ Socket server not initialized yet");
  }
};
