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
  status?: 'ACTIVE' | 'DISABLED' | 'DELETED';
  disabledAt?: any;
  disabledBy?: string;
  
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
  enableRestaurant: (id: string) => Promise<void>;
  disableRestaurant: (id: string, disabledBy?: string) => Promise<void>;
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
      const restaurants = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Restaurant))
        .filter(r => r.status !== 'DELETED');
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
      const resId = `RESTO-${Math.floor(1000 + Math.random() * 9000)}`;
      const adminId = "admin_" + Math.floor(100000 + Math.random() * 900000);
      const passHash = btoa(adminData.password);

      // 1. Create Restaurant
      await setDoc(doc(db, 'restaurants', resId), {
        ...data,
        restaurantCode: resId,
        ownerId: user.uid,
        ownerEmail: user.email,
        adminId: adminId,
        adminEmail: adminData.email.toLowerCase(),
        active: true,
        status: 'ACTIVE',
        disabledAt: null,
        disabledBy: '',
        createdAt: serverTimestamp(),
      });

      // 2. Create Admin User document
      await setDoc(doc(db, 'users', adminId), {
        uid: adminId,
        name: adminData.name,
        email: adminData.email.toLowerCase(),
        username: adminData.email.split("@")[0],
        passwordHash: passHash,
        passwordPlain: adminData.password,
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
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      const token = await user.getIdToken(true);
      
      const response = await fetch(`/api/restaurants/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete restaurant');
      }
      
      toast.success('Restaurant deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete restaurant');
      throw error;
    }
  },

  enableRestaurant: async (id) => {
    try {
      await updateDoc(doc(db, 'restaurants', id), {
        status: 'ACTIVE',
        active: true,
        disabledAt: null,
        disabledBy: null,
        updatedAt: serverTimestamp()
      });
      toast.success('Restaurant enabled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `restaurants/${id}`);
      throw error;
    }
  },

  disableRestaurant: async (id, disabledBy = "Super Owner") => {
    try {
      await updateDoc(doc(db, 'restaurants', id), {
        status: 'DISABLED',
        active: false,
        disabledAt: serverTimestamp(),
        disabledBy,
        updatedAt: serverTimestamp()
      });
      toast.success('Restaurant disabled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `restaurants/${id}`);
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
