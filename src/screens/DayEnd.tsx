import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, addDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';
import { useShiftStore } from '../stores/useShiftStore';
import { 
  Calculator, DollarSign, CreditCard, Smartphone, 
  XCircle, CheckCircle2, Printer, Download, Clock,
  TrendingUp, ArrowRight, AlertTriangle, RefreshCw,
  Wallet, FileSpreadsheet, User, Trash2, Ban,
  ShieldAlert, Sparkles, Receipt, Check, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const DayEnd: React.FC = () => {
  const { profile } = useAuthStore();
  const shiftStore = useShiftStore();

  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [openingCash, setOpeningCash] = useState<number>(() => {
    const saved = localStorage.getItem(`restopro_opcash_${profile?.restaurantId || 'default'}`);
    return saved ? Number(saved) : 0;
  });
  const [closingCash, setClosingCash] = useState<number>(0);
  
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cancellationLogs, setCancellationLogs] = useState<any[]>([]);
  
  const [lockedReportData, setLockedReportData] = useState<any>(null);
  const [reportLocked, setReportLocked] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Determine authorization
  const normalizedRole = (profile?.role || "").toUpperCase();
  const isAuthorized = normalizedRole === 'ADMIN' || normalizedRole === 'CASHIER';

  // Persist opening cash changes locally
  useEffect(() => {
    if (profile?.restaurantId) {
      localStorage.setItem(`restopro_opcash_${profile.restaurantId}`, openingCash.toString());
    }
  }, [openingCash, profile?.restaurantId]);

  // Main data load trigger
  useEffect(() => {
    if (isAuthorized && profile?.restaurantId) {
      fetchDayData(selectedDate);
    }
  }, [profile?.restaurantId, selectedDate, isAuthorized]);

  const fetchDayData = async (targetDateStr: string) => {
    if (!profile?.restaurantId) return;
    setLoading(true);
    setIsOffline(false);

    const targetDate = new Date(targetDateStr);

    try {
      // 1. Fetch Bills (Simple single property where-clause to avoid composite index error)
      const billQ = query(
        collection(db, 'bills'),
        where('restaurantId', '==', profile.restaurantId)
      );
      let rawBills: any[] = [];
      try {
        const billSnap = await getDocs(billQ);
        rawBills = billSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.error("Error fetching bills: ", e);
      }

      // 2. Fetch Payments
      const payQ = query(
        collection(db, 'payments'),
        where('restaurantId', '==', profile.restaurantId)
      );
      let rawPayments: any[] = [];
      try {
        const paySnap = await getDocs(payQ);
        rawPayments = paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.error("Error fetching payments: ", e);
      }

      // 3. Fetch Expenses
      const expQ = query(
        collection(db, 'expenses'),
        where('restaurantId', '==', profile.restaurantId)
      );
      let rawExpenses: any[] = [];
      try {
        const expSnap = await getDocs(expQ);
        rawExpenses = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.error("Error fetching expenses: ", e);
      }

      // 4. Fetch Cancellation Logs
      const logQ = query(
        collection(db, 'cancellationLogs'),
        where('restaurantId', '==', profile.restaurantId)
      );
      let rawCancellationLogs: any[] = [];
      try {
        const logSnap = await getDocs(logQ);
        rawCancellationLogs = logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.error("Error fetching cancellationLogs: ", e);
      }

      // 5. Fetch shift report state
      const reportQ = query(
        collection(db, 'dayReports'),
        where('restaurantId', '==', profile.restaurantId),
        where('date', '==', targetDateStr)
      );
      let lockedReportObj: any = null;
      try {
        const reportSnap = await getDocs(reportQ);
        const closedReports = reportSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((r: any) => r.status === 'closed');
        
        if (closedReports.length > 0) {
          lockedReportObj = closedReports[0];
        }
      } catch (e) {
        console.error("Error checking locked reports: ", e);
      }

      // Handle Timestamp & Plain Text Parsing safely without formatting crash
      const getDocDate = (fieldVal: any): Date | null => {
        if (!fieldVal) return null;
        if (typeof fieldVal.toDate === 'function') return fieldVal.toDate();
        if (fieldVal.seconds) return new Date(fieldVal.seconds * 1000);
        if (fieldVal._seconds) return new Date(fieldVal._seconds * 1000);
        const d = new Date(fieldVal);
        return isNaN(d.getTime()) ? null : d;
      };

      const isTargetDay = (date: Date | null): boolean => {
        if (!date) return false;
        return (
          date.getFullYear() === targetDate.getFullYear() &&
          date.getMonth() === targetDate.getMonth() &&
          date.getDate() === targetDate.getDate()
        );
      };

      // Client-side date sorting to fully prevent composite indexing locks
      const filteredBills = rawBills.filter(b => isTargetDay(getDocDate(b.createdAt)));
      const filteredPayments = rawPayments.filter(p => isTargetDay(getDocDate(p.timestamp)));
      const filteredExpenses = rawExpenses.filter(e => {
        if (typeof e.date === 'string' && e.date.includes('-')) {
          return e.date === targetDateStr;
        }
        return isTargetDay(getDocDate(e.date));
      });
      const filteredLogs = rawCancellationLogs.filter(log => isTargetDay(getDocDate(log.cancellationTime)));

      setBills(filteredBills);
      setPayments(filteredPayments);
      setExpenses(filteredExpenses);
      setCancellationLogs(filteredLogs);
      setLockedReportData(lockedReportObj);
      setReportLocked(!!lockedReportObj);

      // Save complete cache safely for offline retrieval
      const cacheData = {
        bills: filteredBills,
        payments: filteredPayments,
        expenses: filteredExpenses,
        cancellationLogs: filteredLogs,
        lockedReportObj,
        cachedAt: Date.now()
      };
      localStorage.setItem(
        `restopro_dayend_cache_${profile.restaurantId}_${targetDateStr}`,
        JSON.stringify(cacheData)
      );

    } catch (err) {
      console.warn("Firestore fetch failed. Restoring from offline local cache:", err);
      setIsOffline(true);
      const cacheStr = localStorage.getItem(`restopro_dayend_cache_${profile.restaurantId}_${targetDateStr}`);
      if (cacheStr) {
        try {
          const cache = JSON.parse(cacheStr);
          setBills(cache.bills || []);
          setPayments(cache.payments || []);
          setExpenses(cache.expenses || []);
          setCancellationLogs(cache.cancellationLogs || []);
          setLockedReportData(cache.lockedReportObj || null);
          setReportLocked(!!cache.lockedReportObj);
          toast.info("Offline Mode: Restored sales data from cache.");
        } catch (cacheErr) {
          toast.error("Failed to parse cached metrics.");
        }
      } else {
        toast.error("Network connection offline & no local cache found.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Performance optimized memoized calculations (No infinite loops)
  const stats = useMemo(() => {
    // Completed Bills (Successfully settled) - Strictly exclude voided or cancelled/deleted bills
    const completedBills = bills.filter(b => {
      const isPaid = b.status === 'paid' || b.paymentStatus === 'paid' || b.status === 'completed';
      const isVoid = b.status === 'cancelled' || b.status === 'deleted' || b.status === 'void' || b.isVoid === true;
      return isPaid && !isVoid;
    });

    const statsObj = {
      totalSales: 0,
      cashSales: 0,
      upiSales: 0,
      cardSales: 0,
      otherSales: 0,
      taxes: 0,
      discounts: 0,
      subtotal: 0,
      
      // Pending 
      pendingCount: 0,
      pendingAmount: 0,

      // Cancelled
      cancelledCount: 0,
      cancelledAmount: 0,

      // Void / Audit Metrics
      itemCancellationsCount: 0,
      billVoidsCount: 0,
      cancelledLogsTotalValue: 0,

      // Expenses Category breakdown
      staffExpenses: 0,
      purchaseExpenses: 0,
      miscExpenses: 0,
      totalExpenses: 0,

      // Calculated totals
      netRevenue: 0,
      
      // Captain breakdown metrics
      captainSales: {} as Record<string, number>,
      totalOrdersCount: 0
    };

    // 1. Process Completed Bills 
    completedBills.forEach(b => {
      statsObj.totalOrdersCount += 1;

      // Filter out any cancelled items from subtotal/tax/discount/finalAmount calculations
      const rawItems = Array.isArray(b.items) ? b.items : [];
      const activeItems = rawItems.filter((i: any) => i.status !== 'cancelled');
      
      let billSubtotal = Number(b.subtotal) || 0;
      let billTax = Number(b.gstAmount) || 0;
      let billDiscount = Number(b.discountAmount) || 0;
      let billFinal = Number(b.finalAmount) || 0;

      if (rawItems.length > 0 && activeItems.length < rawItems.length) {
        const totalRawSubtotal = rawItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const activeSubtotal = activeItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        
        if (totalRawSubtotal > 0) {
          const ratio = activeSubtotal / totalRawSubtotal;
          billSubtotal = activeSubtotal;
          billTax = (Number(b.gstAmount) || 0) * ratio;
          billDiscount = (Number(b.discountAmount) || 0) * ratio;
          billFinal = (Number(b.finalAmount) || 0) * ratio;
        }
      }

      statsObj.taxes += billTax;
      statsObj.discounts += billDiscount;
      statsObj.subtotal += billSubtotal;

      // Support Split / Partial Payments dynamically
      let actualPaidAmountCalculated = 0;
      const matchingPayDocs = payments.filter((p: any) => p.billId === b.id);

      if (matchingPayDocs.length > 0) {
        matchingPayDocs.forEach((p: any) => {
          const method = (p.method || '').toUpperCase();
          const amt = Number(p.amount) || 0;
          actualPaidAmountCalculated += amt;
          if (method === 'CASH') statsObj.cashSales += amt;
          else if (method === 'UPI') statsObj.upiSales += amt;
          else if (method === 'CARD') statsObj.cardSales += amt;
          else statsObj.otherSales += amt;
        });
      } else if (Array.isArray(b.payments) && b.payments.length > 0) {
        b.payments.forEach((p: any) => {
          const method = (p.method || '').toUpperCase();
          const amt = Number(p.amount) || 0;
          actualPaidAmountCalculated += amt;
          if (method === 'CASH') statsObj.cashSales += amt;
          else if (method === 'UPI') statsObj.upiSales += amt;
          else if (method === 'CARD') statsObj.cardSales += amt;
          else statsObj.otherSales += amt;
        });
      } else {
        // Fallback to primary paymentMethod, handling partial payments using paidAmount if present
        const method = (b.paymentMethod || '').toUpperCase();
        const amt = typeof b.paidAmount === 'number' ? b.paidAmount : billFinal;
        actualPaidAmountCalculated = amt;
        if (method === 'CASH') statsObj.cashSales += amt;
        else if (method === 'UPI') statsObj.upiSales += amt;
        else if (method === 'CARD') statsObj.cardSales += amt;
        else statsObj.otherSales += amt;
      }

      statsObj.totalSales += actualPaidAmountCalculated;

      // Track Captain Performance metrics
      const capName = b.captainName || 'Unknown Captain';
      statsObj.captainSales[capName] = (statsObj.captainSales[capName] || 0) + actualPaidAmountCalculated;
    });

    // 2. Process Pending Bills (Generated but Unpaid)
    const pendingBillsList = bills.filter(b => b.status === 'generated' || b.status === 'billed' || b.paymentStatus === 'unpaid');
    pendingBillsList.forEach(b => {
      const isCompleted = b.status === 'paid' || b.paymentStatus === 'paid' || b.status === 'completed';
      const isVoid = b.status === 'cancelled' || b.status === 'deleted' || b.status === 'void' || b.isVoid === true;
      if (isCompleted || isVoid) return;

      const rawItems = Array.isArray(b.items) ? b.items : [];
      const activeItems = rawItems.filter((i: any) => i.status !== 'cancelled');
      
      let billFinal = Number(b.finalAmount) || 0;

      if (rawItems.length > 0 && activeItems.length < rawItems.length) {
        const totalRawSubtotal = rawItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const activeSubtotal = activeItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        
        if (totalRawSubtotal > 0) {
          billFinal = (Number(b.finalAmount) || 0) * (activeSubtotal / totalRawSubtotal);
        }
      }

      statsObj.pendingCount += 1;
      statsObj.pendingAmount += billFinal;
    });

    // 3. Process Cancelled / Deleted Bills
    const cancelledBillsList = bills.filter(b => b.status === 'cancelled' || b.status === 'deleted' || b.status === 'void' || b.isVoid === true);
    statsObj.cancelledCount = cancelledBillsList.length;
    statsObj.cancelledAmount = cancelledBillsList.reduce((sum, b) => sum + (Number(b.finalAmount) || 0), 0);

    // 4. Trace audit logs for Cancelled actions
    cancellationLogs.forEach(log => {
      if (log.cancellationType === 'Item Cancel') {
        statsObj.itemCancellationsCount += 1;
      } else if (log.cancellationType === 'Bill Void' || log.cancellationType === 'Full Order Cancel') {
        statsObj.billVoidsCount += 1;
      }
      const before = Number(log.orderTotalBefore) || 0;
      const after = Number(log.orderTotalAfter) || 0;
      statsObj.cancelledLogsTotalValue += Math.max(0, before - after);
    });

    // 5. Process Expenses Classification
    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      statsObj.totalExpenses += amt;

      const cat = (e.category || 'Misc').trim();
      if (cat === 'Staff Salary') {
        statsObj.staffExpenses += amt;
      } else if (['Grocery', 'Gas', 'Electricity', 'Maintenance'].includes(cat)) {
        statsObj.purchaseExpenses += amt;
      } else {
        statsObj.miscExpenses += amt;
      }
    });

    // Net operating revenue subtracts expenses
    statsObj.netRevenue = statsObj.totalSales - statsObj.totalExpenses;

    return statsObj;
  }, [bills, expenses, cancellationLogs]);

  // Reconciliation cash mathematics
  const expectedCash = useMemo(() => {
    // Only subtract cash expenses from cash drawer calculations
    const cashExpenses = expenses
      .filter(e => (e.paymentMethod || '').toUpperCase() === 'CASH')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    return Number(openingCash) + stats.cashSales - cashExpenses;
  }, [openingCash, stats.cashSales, expenses]);

  const cashDifference = useMemo(() => {
    return Number(closingCash) - expectedCash;
  }, [closingCash, expectedCash]);

  // Final Close Day action
  const handleCloseDay = async () => {
    if (reportLocked) {
      toast.warning("This day has already been locked & archived.");
      return;
    }

    if (!confirm("Are you sure you want to finalize Day End? This will lock all sales data and archive the session.")) {
      return;
    }

    setIsClosing(true);

    try {
      // 1. Submit complete lock report to 'dayReports'
      const reportPayload = {
        restaurantId: profile?.restaurantId,
        date: selectedDate,
        openingTime: serverTimestamp(),
        closingTime: serverTimestamp(),
        totalSales: stats.totalSales,
        cashSales: stats.cashSales,
        cardSales: stats.cardSales,
        upiSales: stats.upiSales,
        totalExpenses: stats.totalExpenses,
        totalDiscounts: stats.discounts,
        totalGst: stats.taxes,
        pendingBills: stats.pendingCount,
        cancelledBills: stats.cancelledCount,
        netProfit: stats.netRevenue,
        totalOrders: stats.totalOrdersCount,
        captainSales: stats.captainSales,
        status: 'closed',
        closedBy: auth.currentUser?.uid,
        closedByName: profile?.name || 'Authorized Admin',
        reconciliation: {
          openingCash: Number(openingCash),
          closingCash: Number(closingCash),
          expectedCash: Number(expectedCash),
          cashDifference: Number(cashDifference)
        },
        staffExpenses: stats.staffExpenses,
        purchaseExpenses: stats.purchaseExpenses,
        miscExpenses: stats.miscExpenses,
        terminal: navigator.userAgent || 'Terminal Handheld POS',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'dayReports'), reportPayload).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, 'dayReports');
        throw e;
      });

      // 2. Shut down any active shift session in useShiftStore if currently in session
      try {
        await shiftStore.checkActiveSession();
        if (shiftStore.activeSession) {
          await shiftStore.closeShift(closingCash);
        }
      } catch (shiftErr) {
        console.warn("Active shift shutdown warning (may not be active): ", shiftErr);
      }

      toast.success("Day End transaction securely locked and shift archived.");
      
      // Update local values instantly
      setLockedReportData({ id: docRef.id, ...reportPayload });
      setReportLocked(true);

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to finalize Day End session.");
    } finally {
      setIsClosing(false);
    }
  };

  // Excel spreadsheet exporter (Strict CSV parameters)
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "RESTOPRO POS - DAY END SUMMARY REPORT\r\n";
    csvContent += `Report Date,${selectedDate}\r\n`;
    csvContent += `Generated By,${profile?.name || 'Admin'}\r\n`;
    csvContent += `Status,${reportLocked ? 'LOCKED' : 'IN_SESSION'}\r\n\r\n`;
    
    csvContent += "SALES SUMMARY METRICS\r\n";
    csvContent += `Gross Sales,INR ${stats.totalSales}\r\n`;
    csvContent += `Taxes (GST),INR ${stats.taxes}\r\n`;
    csvContent += `Discounts,INR ${stats.discounts}\r\n`;
    csvContent += `Net Subtotal,INR ${stats.subtotal}\r\n`;
    csvContent += `Net Revenue,INR ${stats.netRevenue}\r\n\r\n`;

    csvContent += "PAYMENT MODE METRICS\r\n";
    csvContent += `Cash Payments,INR ${stats.cashSales}\r\n`;
    csvContent += `UPI Payments,INR ${stats.upiSales}\r\n`;
    csvContent += `Card Payments,INR ${stats.cardSales}\r\n`;
    csvContent += `Other/Mixed,INR ${stats.otherSales}\r\n\r\n`;

    csvContent += "CASH DRAWER RECONCILIATION\r\n";
    csvContent += `Opening Cash,INR ${openingCash}\r\n`;
    csvContent += `Closing Cash,INR ${closingCash}\r\n`;
    csvContent += `Expected Cash,INR ${expectedCash}\r\n`;
    csvContent += `Difference,INR ${cashDifference} (${cashDifference === 0 ? 'Balanced' : cashDifference > 0 ? 'Surplus' : 'Deficit'})\r\n\r\n`;

    csvContent += "OPERATIONAL EXPENSES\r\n";
    csvContent += `Staff Expenses,INR ${stats.staffExpenses}\r\n`;
    csvContent += `Purchase Expenses,INR ${stats.purchaseExpenses}\r\n`;
    csvContent += `Misc Expenses,INR ${stats.miscExpenses}\r\n`;
    csvContent += `Total Expenses,INR ${stats.totalExpenses}\r\n\r\n`;

    csvContent += "AUDIT SUMMARY\r\n";
    csvContent += `Successful Bills,${stats.totalOrdersCount}\r\n`;
    csvContent += `Pending Bills,${stats.pendingCount} (Outstanding: INR ${stats.pendingAmount})\r\n`;
    csvContent += `Cancelled Bills,${stats.cancelledCount} (Outstanding: INR ${stats.cancelledAmount})\r\n`;
    csvContent += `Item Cancellations,${stats.itemCancellationsCount}\r\n`;
    csvContent += `Bill Voids,${stats.billVoidsCount}\r\n\r\n`;

    csvContent += "CAPTAIN WISE PERFORMANCE\r\n";
    Object.entries(stats.captainSales).forEach(([cap, total]) => {
      csvContent += `${cap},INR ${total}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RestoPro_DayEnd_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel CSV file downloaded successfully!");
  };

  // Dedicated PDF Z-Report full-page invoice document exporter
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Popup window blocked by browser. Please allow popups to save/print report.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>RestoPro POS - Z Report - ${selectedDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              background-color: #fff;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              letter-spacing: -0.05em;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0;
            }
            .subtitle {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              color: #64748b;
              margin: 2px 0 0 0;
            }
            .section-title {
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: #4f46e5;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 6px;
              margin-top: 25px;
              margin-bottom: 15px;
            }
            .grid-stats {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .stat-card {
              background: #f8fafc;
              border: 1px solid #f1f5f9;
              padding: 15px;
              border-radius: 12px;
            }
            .stat-label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #64748b;
              margin: 0;
            }
            .stat-value {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin: 4px 0 0 0;
            }
            .table-rows {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              margin-bottom: 25px;
            }
            .table-rows th {
              text-align: left;
              padding: 8px;
              background-color: #f1f5f9;
              color: #475569;
              font-weight: 700;
              text-transform: uppercase;
            }
            .table-rows td {
              padding: 10px 8px;
              border-bottom: 1px solid #f1f5f9;
            }
            .table-rows tr:last-child td {
              border-bottom: 2px solid #e2e8f0;
            }
            .footer-notes {
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              margin-top: 50px;
              border-top: 1px dashed #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">RestoProPOS</h1>
              <p class="subtitle">Z Report & Operations Audit</p>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <strong>Date:</strong> ${selectedDate}<br/>
              <strong>Status:</strong> ${reportLocked ? 'LOCKED' : 'IN_SESSION'}
            </div>
          </div>

          <table style="width:100%; margin-bottom: 30px; font-size: 11px;">
            <tr>
              <td><strong>Billed At:</strong> ${format(new Date(), 'yyyy-MM-dd hh:mm a')}</td>
              <td style="text-align: right;"><strong>Issued By:</strong> ${profile?.name || 'Administrator'}</td>
            </tr>
            <tr>
              <td><strong>Operating Store:</strong> POS Terminal #${profile?.restaurantId || 'Default'}</td>
              <td style="text-align: right;"><strong>Shift State:</strong> Archived</td>
            </tr>
          </table>

          <div class="section-title">Revenue & Net Business Sales</div>
          <div class="grid-stats">
            <div class="stat-card">
              <p class="stat-label">Gross Revenue Sales (Settled)</p>
              <div class="stat-value">₹${stats.totalSales.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background-color: #eef2ff; border-color: #e0e7ff;">
              <p class="stat-label" style="color: #4f46e5;">Net Operating Margin</p>
              <div class="stat-value" style="color: #4f46e5;">₹${stats.netRevenue.toLocaleString()}</div>
            </div>
          </div>

          <div class="section-title">Payment Channels Breakdown</div>
          <table class="table-rows">
            <thead>
              <tr>
                <th>Payment Mode Source</th>
                <th style="text-align: right;">Total Aggregated Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cash Drawers (Physical registers)</td>
                <td style="text-align: right;">₹${stats.cashSales.toLocaleString()}</td>
              </tr>
              <tr>
                <td>UPI QR Scans (PhonePe, GPay, Paytm)</td>
                <td style="text-align: right;">₹${stats.upiSales.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Credit/Debit Card Swipes (Terminals)</td>
                <td style="text-align: right;">₹${stats.cardSales.toLocaleString()}</td>
              </tr>
              ${stats.otherSales > 0 ? `
              <tr>
                <td>Other / Mixed Split Channels</td>
                <td style="text-align: right;">₹${stats.otherSales.toLocaleString()}</td>
              </tr>` : ''}
              <tr style="font-weight: bold; background-color: #f8fafc;">
                <td>Total Confirmed Inflows</td>
                <td style="text-align: right;">₹${(stats.cashSales + stats.upiSales + stats.cardSales + stats.otherSales).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Drawer Reconciliation Statistics</div>
          <table class="table-rows">
            <thead>
              <tr>
                <th>Reconciliation Audit Parameter</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Opening Handover Balance</td>
                <td style="text-align: right;">₹${openingCash.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Calculated Expected Cash (Inflows - Cash Expenses)</td>
                <td style="text-align: right;">₹${expectedCash.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Actual Counts (Physical Drawer)</td>
                <td style="text-align: right;">₹${closingCash.toLocaleString()}</td>
              </tr>
              <tr style="font-weight: bold; color: ${cashDifference === 0 ? '#10b981' : '#ef4444'};">
                <td>Discrepancy (Variance)</td>
                <td style="text-align: right;">${cashDifference >= 0 ? '+' : ''}${cashDifference.toLocaleString()} (${cashDifference === 0 ? 'Balanced' : cashDifference > 0 ? 'Surplus' : 'Deficit'})</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Operating Expenses Classification</div>
          <table class="table-rows">
            <thead>
              <tr>
                <th>Expense Classification category</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Human Resource & Staff Salaries</td>
                <td style="text-align: right;">₹${stats.staffExpenses.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Daily Inventory Sourcing (Purchases, gas, raw goods)</td>
                <td style="text-align: right;">₹${stats.purchaseExpenses.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Miscellaneous / Contingency Drawer costs</td>
                <td style="text-align: right;">₹${stats.miscExpenses.toLocaleString()}</td>
              </tr>
              <tr style="font-weight: bold; color: #ef4444;">
                <td>Total Expenses Deducted</td>
                <td style="text-align: right;">₹${stats.totalExpenses.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Operations & Audit summary</div>
          <div class="grid-stats">
            <div class="stat-card">
              <p class="stat-label">Successful Transactions</p>
              <div class="stat-value" style="font-size: 14px;">${stats.totalOrdersCount} orders</div>
            </div>
            <div class="stat-card">
              <p class="stat-label">Pending/Outstanding Bills</p>
              <div class="stat-value" style="font-size: 14px;">${stats.pendingCount} (₹${stats.pendingAmount.toLocaleString()})</div>
            </div>
            <div class="stat-card">
              <p class="stat-label">Cancelled/Voided Billings</p>
              <div class="stat-value" style="font-size: 14px; color: #ef4444;">${stats.cancelledCount} (₹${stats.cancelledAmount.toLocaleString()})</div>
            </div>
            <div class="stat-card">
              <p class="stat-label">Partial cancelled Item Actions</p>
              <div class="stat-value" style="font-size: 14px;">${stats.itemCancellationsCount} sessions</div>
            </div>
          </div>

          <div class="footer-notes">
            <p>Generated dynamically by RestoPro POS shift engine. Verified, authenticated, and locked securely.</p>
            <p style="font-size: 8px; font-family: monospace;">UUID: ${lockedReportData?.id || 'LOCAL-RECORD-UNLOCKED'}</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    toast.success("PDF print preview prepared!");
  };

  // Secure Gate: Only owners/admins allowed
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[60vh]">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-100 text-center space-y-6 shadow-sm"
        >
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Access Denied</h3>
            <p className="text-sm font-bold text-slate-400">
              Only Cashier operators and Outlet Administrators are authorized to view or manage active POS shifts.
            </p>
          </div>
          <div className="pt-4 text-xs font-mono text-slate-400 uppercase">
            Current Privilege: {profile?.role || 'Guest'}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 px-2 md:px-0 relative">
      
      {/* THERMAL PRINT ON DEMAND Z-REPORT (Hidden on screen, shown cleanly on print) */}
      <div className="hidden print:block font-mono text-xs w-full max-w-[280px] mx-auto text-black p-4 bg-white select-text">
        <div className="text-center space-y-1 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-tight">RESTOPRO POS BILLING SYSTEM</h2>
          <p className="text-[10px] uppercase">Z-REPORT SHIFT ARCHIVE</p>
          <div className="border-b border-dashed border-black my-2"></div>
          <p className="text-[10px] text-left">DATE: {selectedDate}</p>
          <p className="text-[10px] text-left">PRINTED: {format(new Date(), 'yyyy-MM-dd hh:mm a')}</p>
          <p className="text-[10px] text-left">ISSUED BY: {profile?.name || 'Administrator'}</p>
          <p className="text-[10px] text-left">STATUS: {reportLocked ? 'LOCKED' : 'IN_SESSION'}</p>
        </div>

        <div className="border-b border-dashed border-black my-2"></div>
        
        <div className="space-y-1 my-3">
          <p className="font-bold uppercase tracking-tight">SALES OUTFLOWS</p>
          <div className="flex justify-between"><span>GROSS SALES:</span><span>INR {stats.totalSales.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>TOTAL GST:</span><span>INR {stats.taxes.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>DISCOUNTS:</span><span>INR {stats.discounts.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>NET REVENUE:</span><span>INR {stats.netRevenue.toFixed(2)}</span></div>
        </div>

        <div className="border-b border-dashed border-black my-2"></div>

        <div className="space-y-1 my-3">
          <p className="font-bold uppercase tracking-tight">PAYMENT MODES</p>
          <div className="flex justify-between"><span>CASH BILLS:</span><span>INR {stats.cashSales.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>UPI SETTLED:</span><span>INR {stats.upiSales.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CARD SETTLED:</span><span>INR {stats.cardSales.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>OTHER/MIXED:</span><span>INR {stats.otherSales.toFixed(2)}</span></div>
        </div>

        <div className="border-b border-dashed border-black my-2"></div>

        <div className="space-y-1 my-3">
          <p className="font-bold uppercase tracking-tight">CASH REGISTER RECON</p>
          <div className="flex justify-between"><span>OPENING CASH:</span><span>INR {openingCash.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>EXPECTED CASH:</span><span>INR {expectedCash.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CLOSING CASH:</span><span>INR {closingCash.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold">
            <span>DIFFERENCE:</span>
            <span>INR {cashDifference.toFixed(2)} ({cashDifference === 0 ? 'BALANCED' : cashDifference > 0 ? 'SURPLUS' : 'SHORTAGE'})</span>
          </div>
        </div>

        <div className="border-b border-dashed border-black my-2"></div>

        <div className="space-y-1 my-3">
          <p className="font-bold uppercase tracking-tight">OPERATIONS AUDIT</p>
          <div className="flex justify-between"><span>SETTLED BILLS:</span><span>{stats.totalOrdersCount}</span></div>
          <div className="flex justify-between"><span>PENDING BILLS:</span><span>{stats.pendingCount} (INR {stats.pendingAmount})</span></div>
          <div className="flex justify-between"><span>VOIDED BILLS:</span><span>{stats.cancelledCount} (INR {stats.cancelledAmount})</span></div>
          <div className="flex justify-between"><span>ITEM CANCELS:</span><span>{stats.itemCancellationsCount}</span></div>
          <div className="flex justify-between font-bold"><span>TOTAL EXPENSES:</span><span>INR {stats.totalExpenses.toFixed(2)}</span></div>
        </div>

        <div className="border-b border-dashed border-black my-4"></div>
        <p className="text-[9px] text-center uppercase font-bold tracking-widest">--- END OF REPORT ---</p>
      </div>

      {/* DASHBOARD DISPLAY UI (Hidden on Print) */}
      <div className="print:hidden space-y-8">
        
        {/* HEADER BLOCK */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Calculator size={140} />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Clock size={22} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight italic uppercase flex items-center gap-2">
                  DayEnd <span className="text-indigo-600">Recon</span>
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                  Daily Balance Sheet & Registers Closing
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isOffline && (
                <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle size={10} />
                  Offline Cache Loaded
                </span>
              )}
              {reportLocked ? (
                <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Ban size={10} />
                  Shift Closed & Locked
                </span>
              ) : (
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Sparkles size={10} />
                  Session Active
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* DATE INPUT */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Select:</span>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer"
              />
            </div>
            
            {/* MANUAL REFRESH */}
            <button 
              onClick={() => fetchDayData(selectedDate)}
              className="p-3.5 bg-slate-50 text-slate-500 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors active:scale-95"
              title="Sync Data"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <RefreshCw size={36} className="text-indigo-600 animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">Calculating balances ...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* FINANCIAL BALANCES GRID */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* PRIMARY GROSS CARD */}
              <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-xl shadow-slate-200">
                <div className="absolute -bottom-8 -right-8 p-6 opacity-5 pointer-events-none text-white">
                  <TrendingUp size={160} />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 leading-none">Gross Sales Revenue</p>
                  <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter text-indigo-400">₹{stats.totalSales.toLocaleString()}</h3>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Taxes (GST)</p>
                    <p className="text-sm font-black text-white">₹{stats.taxes.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Total Discounts</p>
                    <p className="text-sm font-black text-white">₹{stats.discounts.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* PAYMENT MODES DEEP BREAKDOWN */}
              <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-4 pb-2 border-b border-slate-50">
                  Realtime Payment Inflows
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><DollarSign size={16}/></div>
                      <span className="text-xs font-black text-slate-600 uppercase tracking-tight">Cash Register</span>
                    </div>
                    <span className="text-base font-black text-slate-900 italic">₹{stats.cashSales.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Smartphone size={16}/></div>
                      <span className="text-xs font-black text-slate-600 uppercase tracking-tight">UPI / QR Scan</span>
                    </div>
                    <span className="text-base font-black text-slate-900 italic">₹{stats.upiSales.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center"><CreditCard size={16}/></div>
                      <span className="text-xs font-black text-slate-600 uppercase tracking-tight">Card Terminals</span>
                    </div>
                    <span className="text-base font-black text-slate-900 italic">₹{stats.cardSales.toLocaleString()}</span>
                  </div>

                  {stats.otherSales > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><Wallet size={16}/></div>
                        <span className="text-xs font-black text-slate-600 uppercase tracking-tight">Other Splits</span>
                      </div>
                      <span className="text-base font-black text-slate-900 italic">₹{stats.otherSales.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* NET OPERATING REVENUE WITH STATEMENT */}
              <div className="bg-indigo-600 text-white rounded-[2rem] p-8 shadow-xl shadow-indigo-100 relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-indigo-200">Net Business Revenue</p>
                  <h3 className="text-4xl md:text-5xl font-black italic tracking-tighter">₹{stats.netRevenue.toLocaleString()}</h3>
                </div>

                <div className="mt-6 space-y-3 pt-6 border-t border-white/10 text-[9px] font-black uppercase leading-none">
                  <div className="flex justify-between items-center text-indigo-200">
                    <span>Operational Expenses:</span>
                    <span className="text-xs text-white">- ₹{stats.totalExpenses}</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-200">
                    <span>Reconciliation Balance:</span>
                    <span className="text-xs text-white">₹{stats.totalSales}</span>
                  </div>
                </div>
              </div>

            </section>

            {/* EXPENSES AND CASH DRAWER RECONCILIATION */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* INTERACTIVE DRAWER RECONCILIATION */}
              <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <Wallet className="text-slate-500" size={18} />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Cash Drawer Reconciliation</h3>
                  </div>
                  <div className="text-[8px] font-mono uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Reconciliation</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* OPENING CASH INPUT */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Opening Cash Drawer</p>
                    <div className="flex items-center gap-1.5 focus-within:text-indigo-600 transition-colors">
                      <span className="text-xs font-black">₹</span>
                      <input 
                        type="number"
                        disabled={reportLocked}
                        value={openingCash || ''}
                        onChange={(e) => setOpeningCash(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="bg-transparent w-full text-base font-black outline-none placeholder-slate-300"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* CLOSING CASH INPUT */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Actual Closing Cash Drawer</p>
                    <div className="flex items-center gap-1.5 focus-within:text-rose-600 transition-colors">
                      <span className="text-xs font-black">₹</span>
                      <input 
                        type="number"
                        disabled={reportLocked}
                        value={closingCash || ''}
                        onChange={(e) => setClosingCash(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="bg-transparent w-full text-base font-black outline-none placeholder-slate-300"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-500">
                    <span>Expected Closing Cash:</span>
                    <span className="font-mono text-slate-700">₹{expectedCash.toLocaleString()}</span>
                  </div>
                  
                  {/* ALARM / HIGHLIGHT */}
                  <div className={`p-4 rounded-2xl flex items-center justify-between transition-all ${
                    cashDifference === 0 
                      ? 'bg-emerald-50/50 border border-emerald-100 text-emerald-800' 
                      : cashDifference > 0 
                        ? 'bg-amber-50/50 border border-amber-100 text-amber-800'
                        : 'bg-rose-50/50 border border-rose-100 text-rose-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      {cashDifference === 0 ? (
                        <div className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><Check size={16}/></div>
                      ) : (
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cashDifference > 0 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}><AlertTriangle size={14}/></div>
                      )}
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-wider leading-none mb-1">Difference Audit</p>
                        <p className="text-xs font-black text-slate-800">
                          {cashDifference === 0 ? "Drawer perfectly balanced" : cashDifference > 0 ? "Drawer Surplus discrepancy" : "Drawer Shortage discrepancy"}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-black italic">
                      {cashDifference >= 0 ? '+' : ''}{cashDifference.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* OPERATIONAL EXPENSES SUMMARY */}
              <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-slate-500" size={18} />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Daily Expenses Outflows</h3>
                  </div>
                  <div className="text-[8px] font-mono uppercase bg-rose-50 text-rose-600 px-2 py-0.5 rounded">Spendings</div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-black uppercase text-slate-600 tracking-tight">Staff Salaries</span>
                    <span className="text-sm font-black text-slate-800 italic">₹{stats.staffExpenses.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-black uppercase text-slate-600 tracking-tight">Purchases (Grocery, Gas, Utility)</span>
                    <span className="text-sm font-black text-slate-800 italic">₹{stats.purchaseExpenses.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-black uppercase text-slate-600 tracking-tight">Miscellaneous / Other Costs</span>
                    <span className="text-sm font-black text-slate-800 italic">₹{stats.miscExpenses.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 font-black uppercase tracking-tight">
                  <span className="text-xs text-slate-400">Total Subtracted Expenses:</span>
                  <span className="text-lg text-rose-600">₹{stats.totalExpenses.toLocaleString()}</span>
                </div>
              </div>

            </section>

            {/* AUDIT SUMMARY GRID */}
            <section className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-sm">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-6 pb-2 border-b border-sub border-slate-50">
                Operational & Performance Auditing
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl text-center space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Settled Orders</p>
                  <p className="text-xl font-black text-emerald-600">{stats.totalOrdersCount}</p>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl text-center space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Outstanding / Pending</p>
                  <p className="text-xl font-black text-amber-600">{stats.pendingCount}</p>
                  <p className="text-[8px] font-mono font-bold text-slate-400 italic leading-none">₹{stats.pendingAmount}</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl text-center space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Cancelled / Locked</p>
                  <p className="text-xl font-black text-rose-500">{stats.cancelledCount}</p>
                  {stats.cancelledAmount > 0 && <p className="text-[8px] font-mono text-slate-400 leading-none">₹{stats.cancelledAmount}</p>}
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl text-center space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Item cancellations</p>
                  <p className="text-xl font-black text-slate-700">{stats.itemCancellationsCount}</p>
                  {stats.cancelledLogsTotalValue > 0 && <p className="text-[8px] font-mono text-slate-400 leading-none">₹{stats.cancelledLogsTotalValue}</p>}
                </div>
              </div>

              {/* CAPTAIN PERFORMANCE ACCORDION */}
              {Object.keys(stats.captainSales).length > 0 && (
                <div className="mt-8 border-t border-slate-100 pt-6 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Captain Sales Breakdown</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(stats.captainSales).map(([captain, total]) => (
                      <div key={captain} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <span className="text-[10px] font-black text-slate-600 uppercase truncate pr-2">{captain}</span>
                        <span className="text-xs font-black text-slate-800 font-mono">₹{total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ACTION PANELS */}
            <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* PRINT BTN */}
              <button 
                onClick={() => window.print()}
                className="py-4 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-lg active:scale-95"
              >
                <Printer size={16} />
                Print Thermal Receipt
              </button>

              {/* PDF EXPORT BTN */}
              <button 
                onClick={handleExportPDF}
                className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
              >
                <FileText size={16} />
                Export PDF Report
              </button>

              {/* EXCEL EXPORT BTN */}
              <button 
                onClick={handleExportCSV}
                className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
              >
                <FileSpreadsheet size={16} />
                Export CSV (Excel)
              </button>

              {/* FINALIZE CLOSE DAY LOCK BTN */}
              <button 
                onClick={handleCloseDay}
                disabled={isClosing || reportLocked}
                className={`py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                  reportLocked 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                }`}
              >
                {isClosing ? 'Finalizing Day End ...' : (
                  <>
                    <CheckCircle2 size={16} />
                    {reportLocked ? 'Day Reports Finalized' : 'Close Day & Lock'}
                  </>
                )}
              </button>
              
            </section>

          </div>
        )}

      </div>
    </div>
  );
};

export default DayEnd;
