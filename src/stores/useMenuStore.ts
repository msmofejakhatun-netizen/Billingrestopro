import { create } from 'zustand';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

import { useAuthStore } from './useAuthStore';

export interface Category {
  id: string;
  name: string;
  image: string;
  restaurantId: string;
  active: boolean;
  displayOrder: number;
  createdAt?: any;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  itemName: string;
  price: number;
  image: string;
  available: boolean;
  restaurantId: string;
  createdAt?: any;
}

interface MenuState {
  categories: Category[];
  items: MenuItem[];
  loading: boolean;
  subscribe: () => () => void;
  toggleItemAvailability: (itemId: string, available: boolean) => Promise<void>;
  addMenuItem: (item: Omit<MenuItem, 'id' | 'restaurantId' | 'available'>) => Promise<void>;
  updateMenuItem: (itemId: string, item: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'restaurantId'>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  updateCategory: (categoryId: string, category: Partial<Category>) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  categories: [],
  items: [],
  loading: true,
  subscribe: () => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) {
      set({ loading: false });
      return () => {};
    }

    const qCats = query(
      collection(db, 'categories'), 
      where('restaurantId', '==', profile.restaurantId),
      orderBy('displayOrder', 'asc'),
      orderBy('createdAt', 'desc')
    );
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      set({ categories });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const qItems = query(collection(db, 'menuItems'), where('restaurantId', '==', profile.restaurantId));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))
        .sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
      set({ items, loading: false });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'menuItems');
      set({ loading: false });
    });

    return () => {
      unsubCats();
      unsubItems();
    };
  },
  toggleItemAvailability: async (itemId, available) => {
    await updateDoc(doc(db, 'menuItems', itemId), { available }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `menuItems/${itemId}`));
  },
  addMenuItem: async (item) => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return;

    await addDoc(collection(db, 'menuItems'), { 
      ...item, 
      available: true, 
      restaurantId: profile.restaurantId,
      createdAt: serverTimestamp() 
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'menuItems'));
  },
  updateMenuItem: async (itemId, item) => {
    await updateDoc(doc(db, 'menuItems', itemId), item).catch(e => handleFirestoreError(e, OperationType.UPDATE, `menuItems/${itemId}`));
  },
  deleteMenuItem: async (itemId) => {
    await deleteDoc(doc(db, 'menuItems', itemId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `menuItems/${itemId}`));
  },
  addCategory: async (category) => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return;

    await addDoc(collection(db, 'categories'), { 
      ...category, 
      restaurantId: profile.restaurantId,
      createdAt: serverTimestamp() 
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'categories'));
  },
  deleteCategory: async (categoryId) => {
    await deleteDoc(doc(db, 'categories', categoryId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `categories/${categoryId}`));
  },
  updateCategory: async (categoryId, category) => {
    await updateDoc(doc(db, 'categories', categoryId), category).catch(e => handleFirestoreError(e, OperationType.UPDATE, `categories/${categoryId}`));
  }
}));
