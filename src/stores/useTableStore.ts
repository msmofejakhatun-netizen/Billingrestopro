import { create } from 'zustand';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, where, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

import { useAuthStore } from './useAuthStore';

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  status: 'available' | 'occupied' | 'running' | 'billed';
  currentOrderId?: string;
  restaurantId: string;
  section: string;
  guestCount?: number;
  lastOrderAt?: any;
  createdAt?: any;
}

interface TableState {
  tables: RestaurantTable[];
  loading: boolean;
  subscribe: () => () => void;
  updateStatus: (tableId: string, status: RestaurantTable['status'], orderId?: string) => Promise<void>;
  addTable: (section?: string) => Promise<void>;
  updateTable: (id: string, data: Partial<RestaurantTable>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
}

export const useTableStore = create<TableState>((set, get) => ({
  tables: [],
  loading: true,
  subscribe: () => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) {
      set({ loading: false });
      return () => {};
    }
    
    const q = query(
      collection(db, 'tables'), 
      where('restaurantId', '==', profile.restaurantId),
      orderBy('tableNumber')
    );
    return onSnapshot(q, (snapshot) => {
      const tables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RestaurantTable));
      set({ tables, loading: false });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tables');
      set({ loading: false });
    });
  },
  updateStatus: async (tableId, status, orderId = '') => {
    const tableRef = doc(db, 'tables', tableId);
    await updateDoc(tableRef, {
      status,
      currentOrderId: orderId || null,
      lastOrderAt: status === 'available' ? null : serverTimestamp()
    }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `tables/${tableId}`));
  },
  updateTable: async (id, data) => {
    const tableRef = doc(db, 'tables', id);
    await updateDoc(tableRef, data).catch(e => handleFirestoreError(e, OperationType.UPDATE, `tables/${id}`));
  },
  addTable: async (section = 'Hall') => {
    const { tables } = get();
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return;

    // Filter tables in the same section to calculate next number
    const sectionTables = tables.filter(t => t.section === section);
    
    const lastTableNum = sectionTables.reduce((max, t) => {
      const numMatch = t.tableNumber.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    
    // Prefix logic can be simplified or dynamic
    const prefix = section.substring(0, 2).toUpperCase();
    const nextTableNum = `${prefix}${lastTableNum + 1}`;
    
    await addDoc(collection(db, 'tables'), {
      tableNumber: nextTableNum,
      status: 'available',
      currentOrderId: '',
      section,
      restaurantId: profile.restaurantId,
      createdAt: serverTimestamp()
    }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'tables'));
  },
  deleteTable: async (id) => {
    try {
      await deleteDoc(doc(db, 'tables', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tables/${id}`);
    }
  },
}));
