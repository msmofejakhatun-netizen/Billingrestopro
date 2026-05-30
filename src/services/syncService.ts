import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db as dbCloud } from "../lib/firebase";
import { dbLocal, LocalOrder } from "../lib/db";
import { useAuthStore } from "../stores/useAuthStore";

class SyncService {
  private isSyncing = false;
  private syncInterval: any = null;

  startSync() {
    if (this.syncInterval) return;
    
    // Check for pending syncs every 10 seconds
    this.syncInterval = setInterval(() => this.syncPendingItems(), 10000);
    console.log("Sync Engine started");
    
    // Also sync immediately
    this.syncPendingItems();
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncPendingItems() {
    if (this.isSyncing) return;
    if (!navigator.onLine) {
       console.log("Sync Engine: Offline. Skipping sync.");
       return;
    }

    try {
      this.isSyncing = true;
      
      // 1. Sync Orders
      const pendingOrders = await dbLocal.orders.where('synced').equals(0).toArray();
      
      for (const localOrder of pendingOrders) {
        await this.syncOrder(localOrder);
      }

      // 2. Sync Transactions (if any)
      // Similar logic for transactions...

    } catch (error) {
      console.error("Sync Engine major failure:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncOrder(localOrder: LocalOrder) {
    try {
      // Use localOrder.id (temp uuid) as document ID in Firestore
      const orderRef = doc(dbCloud, 'orders', localOrder.id);
      
      const profile = useAuthStore.getState().profile;
      
      // Prepare clean data for Firestore that satisfies isValidOrder
      const cleanOrderData: any = {
        tableNumber: String((localOrder as any).tableNumber || localOrder.tableName || "Unknown"),
        tableId: String(localOrder.tableId || "unknown-table-id"),
        items: localOrder.items || [],
        subtotal: Number(localOrder.subtotal || 0),
        totalAmount: Number((localOrder as any).totalAmount || localOrder.total || localOrder.subtotal || 0),
        orderStatus: String(localOrder.orderStatus || 'running'),
        paymentStatus: String(localOrder.paymentStatus || 'unpaid'),
        restaurantId: String(localOrder.restaurantId || profile?.restaurantId || ""),
        captainId: String((localOrder as any).captainId || profile?.uid || "unknown-captain-id"),
        captainName: String((localOrder as any).captainName || profile?.name || "Captain"),
        timestamp: (localOrder as any).timestamp ? ((localOrder as any).timestamp instanceof Date ? (localOrder as any).timestamp : new Date((localOrder as any).timestamp)) : (localOrder.createdAt ? new Date(localOrder.createdAt) : new Date()),
        updatedAt: serverTimestamp() // Ensure server clock is master
      };

      // Keep only optional allowed fields if present
      const optionalKeys = [
        'kotHistory',
        'gstAmount',
        'discountAmount',
        'serviceChargeAmount',
        'finalAmount',
        'paymentMethod',
        'payments',
        'kotStatus',
        'paidAmount',
        'balanceAmount',
        'billed',
        'lastBillId',
        'orderNotes',
        'cancellationReason',
        'billedAt',
        'completedAt'
      ];
      
      for (const key of optionalKeys) {
        if ((localOrder as any)[key] !== undefined) {
          cleanOrderData[key] = (localOrder as any)[key];
        }
      }
      
      await setDoc(orderRef, cleanOrderData, { merge: true });

      // Update local status to synced
      await dbLocal.orders.update(localOrder.localId!, { synced: 1, syncError: undefined });
      console.log(`Synced Order: ${localOrder.id}`);
      
    } catch (error: any) {
      console.error(`Failed to sync order ${localOrder.id}:`, error);
      await dbLocal.orders.update(localOrder.localId!, { syncError: error.message });
    }
  }
  
  // Method to manually trigger a sync for an order
  async pushOrder(id: string) {
     const order = await dbLocal.orders.get({ id });
     if (order) await this.syncOrder(order);
  }
}

export const syncService = new SyncService();
