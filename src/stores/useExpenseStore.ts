import { create } from 'zustand';
import { db } from '../lib/firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, where, orderBy, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { toast } from 'sonner';
import { useAuthStore } from './useAuthStore';

export interface Expense {
  id: string;
  restaurantId: string;
  title: string;
  category: "Staff Salary" | "Grocery" | "Gas" | "Electricity" | "Maintenance" | "Misc";
  amount: number;
  paymentMethod: string;
  notes?: string;
  date: any;
  createdBy: string;
}

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  addExpense: (expense: Omit<Expense, 'id' | 'restaurantId' | 'createdBy'>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  subscribeExpenses: (startDate?: Date, endDate?: Date) => () => void;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: true,

  addExpense: async (data) => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        ...data,
        restaurantId: profile.restaurantId,
        createdBy: profile.uid,
        date: Timestamp.fromDate(new Date(data.date))
      });
      toast.success('Expense added successfully');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'expenses');
    }
  },

  updateExpense: async (id, data) => {
    if (localStorage.getItem('resto_demo_mode') === 'true') {
      const updated = get().expenses.map(e => e.id === id ? { 
        ...e, 
        ...data, 
        date: data.date ? { seconds: Math.floor(new Date(data.date).getTime() / 1000), nanoseconds: 0 } : e.date 
      } : e);
      localStorage.setItem('demo_expenses', JSON.stringify(updated));
      set({ expenses: updated });
      toast.success('Expense updated');
      return;
    }

    try {
      await updateDoc(doc(db, 'expenses', id), {
        ...data,
        date: data.date ? Timestamp.fromDate(new Date(data.date)) : undefined
      });
      toast.success('Expense updated');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `expenses/${id}`);
    }
  },

  deleteExpense: async (id) => {
    if (localStorage.getItem('resto_demo_mode') === 'true') {
      const updated = get().expenses.filter(e => e.id !== id);
      localStorage.setItem('demo_expenses', JSON.stringify(updated));
      set({ expenses: updated });
      toast.success('Expense deleted');
      return;
    }

    try {
      await deleteDoc(doc(db, 'expenses', id));
      toast.success('Expense deleted');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `expenses/${id}`);
    }
  },

  subscribeExpenses: (startDate, endDate) => {
    if (localStorage.getItem('resto_demo_mode') === 'true') {
      const saved = localStorage.getItem('demo_expenses');
      let demoExpenses: Expense[] = saved ? JSON.parse(saved) : [];
      if (demoExpenses.length === 0) {
        demoExpenses = [
          {
            id: 'EXP1',
            restaurantId: 'RESTO-DEMO',
            title: 'Weekly Grocery Purchase',
            category: 'Grocery',
            amount: 4500,
            paymentMethod: 'CASH',
            createdBy: 'OFFLINE_DEMO_OWNER',
            date: { seconds: Math.floor(Date.now() / 1000) - 86400 * 2, nanoseconds: 0 }
          },
          {
            id: 'EXP2',
            restaurantId: 'RESTO-DEMO',
            title: 'Staff Lunch Allowance',
            category: 'Staff Salary',
            amount: 800,
            paymentMethod: 'UPI',
            createdBy: 'OFFLINE_DEMO_OWNER',
            date: { seconds: Math.floor(Date.now() / 1000) - 86400, nanoseconds: 0 }
          }
        ];
        localStorage.setItem('demo_expenses', JSON.stringify(demoExpenses));
      }
      set({ expenses: demoExpenses, loading: false });
      return () => {};
    }

    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return () => {};

    let q = query(
      collection(db, 'expenses'),
      where('restaurantId', '==', profile.restaurantId),
      orderBy('date', 'desc')
    );

    // Note: Complex queries with multiple where and orderby might need indexes.
    // For now, simple date filtering logic in the component or basic query if possible.

    return onSnapshot(q, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      set({ expenses, loading: false });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });
  }
}));
