import { create } from 'zustand';
import { db, auth } from '../lib/firebase';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { toast } from 'sonner';
import { useAuthStore } from './useAuthStore';
import { useShiftStore } from './useShiftStore';

export interface CashDrop {
  id: string;
  restaurantId: string;
  amount: number;
  reason: string;
  date: any;
  createdBy: string;
  createdByName: string;
  shiftId: string;
}

interface CashDropState {
  cashDrops: CashDrop[];
  loading: boolean;
  addCashDrop: (data: Omit<CashDrop, 'id' | 'restaurantId' | 'createdBy' | 'createdByName' | 'shiftId' | 'date'>) => Promise<void>;
  subscribeCashDrops: () => () => void;
}

export const useCashDropStore = create<CashDropState>((set, get) => ({
  cashDrops: [],
  loading: true,

  addCashDrop: async (data) => {
    const profile = useAuthStore.getState().profile;
    const shift = useShiftStore.getState().activeSession;
    if (!profile?.restaurantId || !shift) return;

    try {
      await addDoc(collection(db, 'cashDrops'), {
        ...data,
        restaurantId: profile.restaurantId,
        createdBy: profile.uid,
        createdByName: profile.name,
        shiftId: shift.id,
        date: serverTimestamp()
      });
      toast.success('Cash drop recorded');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'cashDrops');
    }
  },

  subscribeCashDrops: () => {
    const profile = useAuthStore.getState().profile;
    const shift = useShiftStore.getState().activeSession;
    if (!profile?.restaurantId || !shift) return () => {};

    const q = query(
      collection(db, 'cashDrops'),
      where('restaurantId', '==', profile.restaurantId),
      where('shiftId', '==', shift.id),
      orderBy('date', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const cashDrops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashDrop));
      set({ cashDrops, loading: false });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashDrops');
    });
  }
}));
