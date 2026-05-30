import { create } from 'zustand';
import { db, auth } from '../lib/firebase';
import { 
  collection, addDoc, updateDoc, doc, getDocs,
  query, where, serverTimestamp, Timestamp, limit, orderBy
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { toast } from 'sonner';
import { useAuthStore } from './useAuthStore';

export interface DailyShift {
  id: string; // Document ID
  shiftId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: any;
  closedAt: any | null;
  openedBy: string; // Cashier Name
  closedBy: string | null;
  openingCash: number;
  closingCash: number;
  terminal: string;
  restaurantId: string;
  notes?: string;
}

interface ShiftState {
  activeSession: DailyShift | null;
  loading: boolean;
  checkActiveSession: () => Promise<void>;
  startShift: (params: { openingCash: number; cashierName: string; terminalName: string; notes?: string }) => Promise<void>;
  closeShift: (closingCash?: number) => Promise<void>;
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

    const normalizedRole = (profile.role || "").toUpperCase();
    if (normalizedRole !== 'CASHIER' && normalizedRole !== 'ADMIN') {
      console.log(`[SHIFT_STORE_BYPASS] Bypassing active session check for role: ${normalizedRole}`);
      const bypassedSession: DailyShift = {
        id: "bypassed-session",
        shiftId: "BYPASS-SHIFT",
        status: "OPEN",
        openedAt: { seconds: Math.floor(Date.now() / 1000) },
        closedAt: null,
        openedBy: "Enterprise Mode",
        closedBy: null,
        openingCash: 0,
        closingCash: 0,
        terminal: "Enterprise Console",
        restaurantId: profile.restaurantId,
      };
      set({ activeSession: bypassedSession, loading: false });
      return;
    }

    const cacheKey = `restopro_active_shift_${profile.restaurantId}`;

    // First, attempt to load from local storage cache for immediate offline support
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        console.log("DEBUG: Restored active shift from local cache:", parsed);
        set({ activeSession: parsed, loading: false });
      }
    } catch (e) {
      console.warn("Failed to check shift inside localStorage cache:", e);
    }

    if (!auth.currentUser) {
      console.warn("checkActiveSession: No auth.currentUser found, waiting...");
      set({ loading: false });
      return;
    }

    try {
      console.log("DEBUG: Fetching active dailyShifts for restaurant:", profile.restaurantId);
      const q = query(
        collection(db, 'dailyShifts'),
        where('restaurantId', '==', profile.restaurantId),
        where('status', '==', 'OPEN'),
        limit(1)
      );
      const snap = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'dailyShifts');
        throw e;
      });

      if (!snap.empty) {
        const docData = snap.docs[0].data();
        const openedAtData = docData.openedAt;
        
        // Convert firestore timestamp to serialized object if needed
        let openedAtVal = null;
        if (openedAtData) {
          if (typeof openedAtData.toDate === 'function') {
            openedAtVal = { seconds: Math.floor(openedAtData.toDate().getTime() / 1000) };
          } else if (openedAtData.seconds) {
            openedAtVal = { seconds: openedAtData.seconds };
          }
        }

        const activeObj: DailyShift = {
          id: snap.docs[0].id,
          shiftId: docData.shiftId || '',
          status: docData.status as 'OPEN' | 'CLOSED',
          openedAt: openedAtVal || { seconds: Math.floor(Date.now() / 1000) },
          closedAt: docData.closedAt || null,
          openedBy: docData.openedBy || '',
          closedBy: docData.closedBy || null,
          openingCash: Number(docData.openingCash) || 0,
          closingCash: Number(docData.closingCash) || 0,
          terminal: docData.terminal || '',
          restaurantId: docData.restaurantId || '',
          notes: docData.notes || '',
        };

        console.log("DEBUG: Active dailyShift found in Firestore:", activeObj);
        set({ activeSession: activeObj });
        localStorage.setItem(cacheKey, JSON.stringify(activeObj));
      } else {
        console.log("DEBUG: No active dailyShift found in Firestore");
        set({ activeSession: null });
        localStorage.removeItem(cacheKey);
      }
    } catch (e) {
      console.error("Firestore shift check failed, using cache status or marking null:", e);
    } finally {
      set({ loading: false });
    }
  },

  startShift: async ({ openingCash, cashierName, terminalName, notes }) => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) {
      toast.error('No restaurant information found');
      return;
    }

    set({ loading: true });
    try {
      // Create local timestamp representation for offline usage
      const shiftId = `SHIFT-${Date.now()}`;
      const nowSeconds = Math.floor(Date.now() / 1000);

      const shiftDocData = {
        restaurantId: profile.restaurantId,
        shiftId: shiftId,
        status: 'OPEN',
        openedBy: cashierName || profile.name || 'Unknown',
        openedAt: serverTimestamp(),
        closedAt: null,
        closedBy: null,
        openingCash: Number(openingCash) || 0,
        closingCash: 0,
        terminal: terminalName || 'POS Terminal',
        notes: notes || '',
      };

      // Add to Firestore (will auto-sync if offline)
      const docRef = await addDoc(collection(db, 'dailyShifts'), shiftDocData).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, 'dailyShifts');
        throw e;
      });

      // Update restaurant day status to open
      await updateDoc(doc(db, 'restaurants', profile.restaurantId), { isDayOpen: true });

      const sessionObj: DailyShift = {
        id: docRef.id,
        shiftId: shiftId,
        status: 'OPEN',
        openedAt: { seconds: nowSeconds },
        closedAt: null,
        openedBy: cashierName,
        closedBy: null,
        openingCash: Number(openingCash) || 0,
        closingCash: 0,
        terminal: terminalName,
        restaurantId: profile.restaurantId,
        notes: notes || '',
      };

      // Set state and cache locally for offline access
      set({ activeSession: sessionObj });
      localStorage.setItem(`restopro_active_shift_${profile.restaurantId}`, JSON.stringify(sessionObj));

      toast.success('Day has been OPENED successfully.');
    } catch (e) {
      console.error("Failed to start shift:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  closeShift: async (closingCash = 0) => {
    const { activeSession } = get();
    if (!activeSession) return;

    try {
      const profile = useAuthStore.getState().profile;
      if (!profile?.restaurantId) return;

      // Update in Firestore
      await updateDoc(doc(db, 'dailyShifts', activeSession.id), {
        closedAt: serverTimestamp(),
        status: 'CLOSED',
        closedBy: profile.name || auth.currentUser?.email || 'Unknown',
        closingCash: Number(closingCash) || 0
      }).catch(e => {
        handleFirestoreError(e, OperationType.UPDATE, `dailyShifts/${activeSession.id}`);
        throw e;
      });

      // Update restaurant day status to closed
      await updateDoc(doc(db, 'restaurants', profile.restaurantId), { isDayOpen: false });

      // Clear the local state cache entirely
      localStorage.removeItem(`restopro_active_shift_${profile.restaurantId}`);
      set({ activeSession: null });
      toast.success('Shift closed successfully');
    } catch (e) {
      console.error("Close shift error:", e);
      throw e;
    }
  }
}));
