import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;
  private connected = false;

  connect(restaurantId: string) {
    if (this.socket) return;

    // In a real local setup, this would be the billing PC's IP.
    // Here, we use the current host.
    this.socket = io(window.location.origin);

    this.socket.on("connect", () => {
      this.connected = true;
      console.log("Connected to Realtime Server");
      this.socket?.emit("join-restaurant", restaurantId);
    });

    this.socket.on("disconnect", () => {
      this.connected = false;
      console.log("Disconnected from Realtime Server");
    });
  }

  emitOrder(restaurantId: string, order: any) {
    this.socket?.emit("new-order", { restaurantId, order });
  }

  emitKOT(restaurantId: string, kot: any) {
    this.socket?.emit("print-kot", { restaurantId, kot });
  }

  emitPrintRequest(restaurantId: string, data: any) {
    this.socket?.emit("print-request", { restaurantId, ...data });
  }

  onOrderReceived(callback: (order: any) => void) {
    this.socket?.on("order-received", callback);
  }

  onOrderUpdated(callback: (data: any) => void) {
    this.socket?.on("order-updated", callback);
  }

  onPrintKOT(callback: (data: any) => void) {
    this.socket?.on("print-kot", callback);
  }

  onProcessPrint(callback: (data: any) => void) {
    this.socket?.on("process-print", callback);
  }

  isConnected() {
    return this.connected;
  }
}

export const socketService = new SocketService();
