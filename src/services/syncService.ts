import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db as dbCloud } from "../lib/firebase";
import { dbLocal, LocalOrder } from "../lib/db";

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
      
      const { localId, synced, syncError, ...firestoreData } = localOrder;
      
      // Convert any local dates to server timestamps if needed
      // For simplicity, we trust the local timestamp if it's already a Date
      
      await setDoc(orderRef, {
        ...firestoreData,
        updatedAt: serverTimestamp(), // Ensure server clock is master
        isSynced: true
      }, { merge: true });

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
