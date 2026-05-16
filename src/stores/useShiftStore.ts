import { create } from 'zustand';
import { db, auth } from '../lib/firebase';
import { 
  collection, addDoc, updateDoc, doc, getDocs,
  query, where, serverTimestamp, Timestamp, limit
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { toast } from 'sonner';
import { useAuthStore } from './useAuthStore';

export interface AdminShift {
  id: string;
  restaurantId: string;
  shiftId: string; // Display ID or same as doc ID
  status: 'active' | 'closed';
  active: boolean;
  startedBy: string;
  startedByName: string;
  startedAt: any;
  closedAt: any | null;
  totalSales: number;
  totalOrders: number;
  pendingBills: number;
}

interface ShiftState {
  activeSession: AdminShift | null;
  loading: boolean;
  checkActiveSession: () => Promise<void>;
  startShift: () => Promise<void>;
  closeShift: () => Promise<void>;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  activeSession: null,
  loading: true,

  checkActiveSession: async () => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) {
      set({ loading: false });
      return;
    }

    if (!auth.currentUser) {
      console.warn("checkActiveSession: No auth.currentUser found, waiting...");
      set({ loading: false });
      return;
    }

    try {
      console.log("DEBUG: Checking active shift for restaurant:", profile.restaurantId);
      const q = query(
        collection(db, 'adminShifts'),
        where('restaurantId', '==', profile.restaurantId),
        where('status', '==', 'active'),
        where('active', '==', true),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log("DEBUG: Active shift found:", snap.docs[0].id);
        set({ activeSession: { id: snap.docs[0].id, ...snap.docs[0].data() } as AdminShift });
      } else {
        console.log("DEBUG: No active shift found");
        set({ activeSession: null });
      }
    } catch (e) {
      console.error("Shift check fail. Auth UID:", auth.currentUser?.uid, "Error:", e);
    } finally {
      set({ loading: false });
    }
  },

  startShift: async () => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) {
      toast.error('No restaurant information found');
      return;
    }

    set({ loading: true });
    try {
      // 1. Double check for active shift
      const q = query(
        collection(db, 'adminShifts'),
        where('restaurantId', '==', profile.restaurantId),
        where('status', '==', 'active'),
        where('active', '==', true),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        set({ activeSession: { id: snap.docs[0].id, ...snap.docs[0].data() } as AdminShift });
        toast.info('Shift already active');
        return;
      }

      // 2. Create new admin shift
      const shiftDocData = {
        restaurantId: profile.restaurantId,
        shiftId: `SHIFT-${Date.now()}`,
        status: 'active',
        active: true,
        startedBy: auth.currentUser?.uid || 'unknown',
        startedByName: profile.name || 'Unknown',
        startedAt: serverTimestamp(),
        closedAt: null,
        totalSales: 0,
        totalOrders: 0,
        pendingBills: 0
      };

      const docRef = await addDoc(collection(db, 'adminShifts'), shiftDocData);
      
      set({ 
        activeSession: { ...shiftDocData, id: docRef.id, startedAt: { seconds: Math.floor(Date.now()/1000) } } as AdminShift 
      });
      toast.success('Shift STARTED Successfully');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'adminShifts');
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  closeShift: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    try {
      const profile = useAuthStore.getState().profile;
      if (!profile?.restaurantId) return;

      // 1. Calculate stats since startedAt
      const startedAt = activeSession.startedAt;
      const startTimestamp = startedAt.seconds ? Timestamp.fromMillis(startedAt.seconds * 1000) : Timestamp.now();
      
      const billQ = query(
        collection(db, 'bills'),
        where('restaurantId', '==', profile.restaurantId),
        where('createdAt', '>=', startTimestamp)
      );
      const billSnap = await getDocs(billQ);
      
      let stats = {
        totalSales: 0,
        totalOrders: 0,
        pendingBills: 0,
        totalGst: 0,
        totalDiscount: 0,
        expenses: 0
      };

      billSnap.forEach(d => {
        const data = d.data();
        if (data.status === 'cancelled') return;
        if (data.paymentStatus === 'unpaid') {
          stats.pendingBills += 1;
        } else {
          stats.totalSales += data.finalAmount || 0;
          stats.totalOrders += 1;
          stats.totalGst += data.gstAmount || 0;
          stats.totalDiscount += data.discountAmount || 0;
        }
      });

      // Fetch expenses
      const expenseQ = query(
        collection(db, 'expenses'),
        where('restaurantId', '==', profile.restaurantId),
        where('date', '>=', startTimestamp)
      );
      const expenseSnap = await getDocs(expenseQ);
      expenseSnap.forEach(d => stats.expenses += d.data().amount || 0);

      // 2. Create Day Report
      const reportData = {
        restaurantId: profile.restaurantId,
        shiftId: activeSession.shiftId,
        startedAt: activeSession.startedAt,
        closedAt: serverTimestamp(),
        ...stats,
        closedBy: auth.currentUser?.uid || 'unknown',
        closedByName: profile.name || 'Unknown'
      };
      await addDoc(collection(db, 'dayReports'), reportData);

      // 3. Update active session
      await updateDoc(doc(db, 'adminShifts', activeSession.id), {
        closedAt: serverTimestamp(),
        status: 'closed',
        active: false,
        ...stats
      });

      set({ activeSession: null });
      toast.success('Shift CLOSED successfully and report generated');
    } catch (e) {
      console.error("Close shift error", e);
      handleFirestoreError(e, OperationType.UPDATE, `adminShifts/${activeSession.id}`);
      throw e;
    }
  }
}));
