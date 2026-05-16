import { create } from 'zustand';
import { db } from '../lib/firebase';
import { 
  collection, addDoc, updateDoc, doc, getDocs, getDoc,
  query, where, orderBy, serverTimestamp, Timestamp, limit
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { toast } from 'sonner';
import { useAuthStore } from './useAuthStore';

export interface DayReport {
  id: string;
  restaurantId: string;
  date: string; // YYYY-MM-DD
  openingTime: any;
  closingTime?: any;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
  totalExpenses: number;
  totalDiscounts: number;
  totalGst: number;
  pendingBills: number;
  cancelledBills: number;
  netProfit: number;
  totalOrders: number;
  captainSales: Record<string, number>;
  status: 'open' | 'closed';
  closedBy?: string;
}

interface ReportState {
  currentReport: DayReport | null;
  loading: boolean;
  checkOpenReport: () => Promise<void>;
  openDay: () => Promise<void>;
  closeDay: () => Promise<void>;
  getDailyStats: (date: Date) => Promise<any>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  currentReport: null,
  loading: true,

  checkOpenReport: async () => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return;

    try {
      const q = query(
        collection(db, 'dayReports'),
        where('restaurantId', '==', profile.restaurantId),
        where('status', '==', 'open'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        set({ currentReport: { id: snap.docs[0].id, ...snap.docs[0].data() } as DayReport });
      } else {
        set({ currentReport: null });
      }
      set({ loading: false });
    } catch (e) {
      console.error("Shift check fail", e);
    }
  },

  openDay: async () => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return;

    const today = new Date().toISOString().split('T')[0];
    const reportData = {
      restaurantId: profile.restaurantId,
      date: today,
      openingTime: serverTimestamp(),
      totalSales: 0,
      cashSales: 0,
      cardSales: 0,
      upiSales: 0,
      totalExpenses: 0,
      totalDiscounts: 0,
      totalGst: 0,
      pendingBills: 0,
      cancelledBills: 0,
      netProfit: 0,
      totalOrders: 0,
      captainSales: {},
      status: 'open'
    };

    try {
      const docRef = await addDoc(collection(db, 'dayReports'), reportData);
      set({ currentReport: { id: docRef.id, ...reportData } as DayReport });
      toast.success('Shift opened');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'dayReports');
    }
  },

  closeDay: async () => {
    const { currentReport } = get();
    if (!currentReport) return;

    try {
      const stats = await get().getDailyStats(new Date(currentReport.openingTime.seconds * 1000));
      
      await updateDoc(doc(db, 'dayReports', currentReport.id), {
        ...stats,
        closingTime: serverTimestamp(),
        status: 'closed',
        closedBy: useAuthStore.getState().profile?.uid
      });
      set({ currentReport: null });
      toast.success('Shift closed successfully');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `dayReports/${currentReport.id}`);
    }
  },

  getDailyStats: async (startDate: Date) => {
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return null;

    const startTimestamp = Timestamp.fromDate(startDate);

    // 1. Fetch all bills
    const billQ = query(
      collection(db, 'bills'),
      where('restaurantId', '==', profile.restaurantId),
      where('createdAt', '>=', startTimestamp)
    );
    const billSnap = await getDocs(billQ);
    
    let stats = {
      totalSales: 0,
      cashSales: 0,
      cardSales: 0,
      upiSales: 0,
      totalDiscounts: 0,
      totalGst: 0,
      pendingBills: 0,
      cancelledBills: 0,
      cancelledAmount: 0,
      totalOrders: 0,
      captainSales: {} as Record<string, number>,
      netProfit: 0
    };

    billSnap.forEach(doc => {
      const data = doc.data();
      if (data.status === 'cancelled' || data.status === 'deleted') {
        stats.cancelledBills += 1;
        stats.cancelledAmount += data.finalAmount || 0;
        return;
      }
      if (data.paymentStatus !== 'paid') { // Consider only paid bills for financial stats
        if (data.paymentStatus === 'unpaid') stats.pendingBills += 1;
        // Don't include unpaid bills in sales stats
      } else {
        stats.totalOrders += 1;
        stats.totalSales += data.finalAmount || 0;
        stats.totalDiscounts += data.discountAmount || 0;
        stats.totalGst += data.gstAmount || 0;
        
        // Captain sales
        const capName = data.captainName || 'Unknown';
        stats.captainSales[capName] = (stats.captainSales[capName] || 0) + (data.finalAmount || 0);

        // Payment break-down
        if (data.paymentMethod === 'CASH') stats.cashSales += data.finalAmount || 0;
        else if (data.paymentMethod === 'CARD') stats.cardSales += data.finalAmount || 0;
        else if (data.paymentMethod === 'UPI') stats.upiSales += data.finalAmount || 0;
      }
    });

    // Fetch expenses
    const expenseQ = query(
      collection(db, 'expenses'),
      where('restaurantId', '==', profile.restaurantId),
      where('date', '>=', startTimestamp)
    );
    const expenseSnap = await getDocs(expenseQ);
    let totalExpenses = 0;
    expenseSnap.forEach(doc => totalExpenses += doc.data().amount || 0);
    
    return { 
      ...stats, 
      totalExpenses,
      netProfit: stats.totalSales - totalExpenses
    };
  }
}));
