import { create } from 'zustand';
import { db, auth } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { toast } from 'sonner';

export interface Restaurant {
  id: string;
  restaurantName: string;
  restaurantCode: string;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  gstNumber?: string;
  gstEnabled?: boolean;
  gstPercentage?: number;
  serviceChargePercentage?: number;
  logo?: string;
  active: boolean;
  createdAt: any;
  
  // Enterprise & Subscription
  subscriptionPlan: 'basic' | 'pro' | 'enterprise';
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended';
  expiryDate?: any;
  licenseKey?: string;
  deviceLimit?: number;
  captainLimit?: number;
  
  // Stats added for UI
  totalOrders?: number;
  earnings?: number;
  tablesCount?: number;
}

interface RestaurantState {
  restaurants: Restaurant[];
  currentRestaurant: Restaurant | null;
  loading: boolean;
  setCurrentRestaurant: (restaurant: Restaurant | null) => void;
  subscribe: () => () => void;
  subscribeToRestaurant: (id: string) => () => void;
  createRestaurant: (data: Partial<Restaurant>, adminData: any) => Promise<void>;
  updateRestaurant: (id: string, data: Partial<Restaurant>) => Promise<void>;
  archiveRestaurant: (id: string) => Promise<void>;
  deleteRestaurant: (id: string) => Promise<void>;
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurants: [],
  currentRestaurant: null,
  loading: true,

  setCurrentRestaurant: (restaurant) => set({ currentRestaurant: restaurant }),

  subscribeToRestaurant: (id) => {
    set({ loading: true });
    return onSnapshot(doc(db, 'restaurants', id), (snapshot) => {
      if (snapshot.exists()) {
        set({ currentRestaurant: { id: snapshot.id, ...snapshot.data() } as Restaurant, loading: false });
      } else {
        console.warn(`Restaurant Record [${id}] does not exist in the database.`);
        set({ currentRestaurant: null, loading: false });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `restaurants/${id}`);
      set({ loading: false });
    });
  },

  subscribe: () => {
    const user = auth.currentUser;
    if (!user) {
      set({ loading: false });
      return () => {};
    }

    const q = query(
      collection(db, 'restaurants'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const restaurants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
      set({ restaurants, loading: false });
      
      // If none selected, and we have restaurants, select first one by default
      if (!get().currentRestaurant && restaurants.length > 0) {
        set({ currentRestaurant: restaurants[0] });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'restaurants');
      set({ loading: false });
    });
  },

  createRestaurant: async (data, adminData) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const { setDoc, doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const resId = `RESTO-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Create Admin Auth Account
      const adminCreds = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
      
      // 2. Create Restaurant
      await setDoc(doc(db, 'restaurants', resId), {
        ...data,
        restaurantCode: resId,
        ownerId: user.uid,
        ownerEmail: user.email,
        adminId: adminCreds.user.uid,
        adminEmail: adminData.email.toLowerCase(),
        active: true,
        createdAt: serverTimestamp(),
      });

      // 3. Create Admin User document
      await setDoc(doc(db, 'users', adminCreds.user.uid), {
        uid: adminCreds.user.uid,
        name: adminData.name,
        email: adminData.email.toLowerCase(),
        role: 'admin',
        restaurantId: resId,
        active: true,
        createdAt: serverTimestamp(),
      });

      // 4. Link owner to this restaurant if not already linked
      await updateDoc(doc(db, 'users', user.uid), {
        restaurantId: resId
      });
      
      console.log(`Created restaurant ${resId} and linked admin ${adminData.email}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'restaurants');
      throw error; // Re-throw to propagate to the form
    }
  },

  updateRestaurant: async (id, data) => {
    try {
      await updateDoc(doc(db, 'restaurants', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success('Restaurant updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `restaurants/${id}`);
      throw error;
    }
  },

  deleteRestaurant: async (id) => {
    try {
      const { getDocs, writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // Cascading deletions for associated collections
      const collectionsToCleanup = [
        'menuItems', 
        'categories', 
        'tables', 
        'orders', 
        'settings', 
        'users',
        'captains',
        'admins'
      ];
      
      for (const colName of collectionsToCleanup) {
        const q = query(collection(db, colName), where('restaurantId', '==', id));
        const snapshot = await getDocs(q);
        snapshot.forEach((d) => {
          batch.delete(d.ref);
        });
      }

      // Finally delete the restaurant document themselves
      batch.delete(doc(db, 'restaurants', id));

      await batch.commit();
      toast.success('Restaurant and all associated data purged successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `restaurants/${id}`);
      throw error;
    }
  },

  archiveRestaurant: async (id) => {
    try {
      await updateDoc(doc(db, 'restaurants', id), {
        active: false,
        archivedAt: serverTimestamp()
      });
      toast.success('Restaurant archived successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `restaurants/${id}`);
      throw error;
    }
  },
}));
