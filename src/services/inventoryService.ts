import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export interface InventoryItem {
  id?: string;
  restaurantId: string;
  branchId?: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  costPrice: number;
}

class InventoryService {
  async deductStockFromOrder(restaurantId: string, items: any[]) {
    const batch = writeBatch(db);
    
    for (const item of items) {
      // 1. Get Recipe for menu item
      const recipeSnap = await getDocs(query(
        collection(db, 'recipes'),
        where('menuItemId', '==', item.itemId)
      ));

      if (!recipeSnap.empty) {
        const recipe = recipeSnap.docs[0].data();
        for (const ingredient of recipe.ingredients) {
          const invRef = doc(db, 'inventory', ingredient.inventoryItemId);
          batch.update(invRef, {
            currentStock: increment(-(ingredient.quantity * item.quantity))
          });
        }
      }
    }

    try {
      await batch.commit();
    } catch (e) {
      console.error("Stock Deduction Failed:", e);
    }
  }

  async addStock(restaurantId: string, inventoryItemId: string, quantity: number, price: number) {
    try {
      const invRef = doc(db, 'inventory', inventoryItemId);
      await updateDoc(invRef, {
        currentStock: increment(quantity),
        costPrice: price,
        lastPurchasedAt: serverTimestamp()
      });
      toast.success("Stock updated successfully");
    } catch (e) {
      toast.error("Failed to update stock");
    }
  }

  async recordPurchase(restaurantId: string, vendorId: string, items: any[]) {
    try {
      const totalAmount = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
      const poRef = await addDoc(collection(db, 'purchaseOrders'), {
        restaurantId,
        vendorId,
        items,
        totalAmount,
        status: 'received',
        createdAt: serverTimestamp(),
        receivedAt: serverTimestamp()
      });

      // Also update inventory for each item
      const batch = writeBatch(db);
      for (const item of items) {
        const invRef = doc(db, 'inventory', item.inventoryItemId);
        batch.update(invRef, {
          currentStock: increment(item.quantity),
          costPrice: item.unitPrice,
          lastPurchasedAt: serverTimestamp()
        });
      }
      await batch.commit();
      
      toast.success("Purchase recorded and stock updated");
    } catch (e) {
      toast.error("Failed to record purchase");
    }
  }
}

export const inventoryService = new InventoryService();
