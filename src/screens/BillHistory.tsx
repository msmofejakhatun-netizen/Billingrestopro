import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { History, Search, Filter, Calendar, Printer, CheckCircle, XCircle, FileText, Trash2, RotateCcw, XSquare, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { printReceipt } from '../utils/printReceipt';
import { toast } from 'sonner';
import { useOrderStore } from '../stores/useOrderStore';
import { CancellationReasonModal } from '../components/CancellationReasonModal';

import { useRestaurantStore } from '../stores/useRestaurantStore';

const BillHistory = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [cancellationContext, setCancellationContext] = useState<{ type: 'cancel' | 'delete', bill: any } | null>(null);
  const { profile } = useAuthStore();
  const { currentRestaurant } = useRestaurantStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.restaurantId) return;

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (dateFilter === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
    } else if (dateFilter === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateFilter === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const collectionName = statusFilter === 'cancelled' ? 'cancelledBills' : 
                          statusFilter === 'deleted' ? 'deletedBills' : 'bills';

    const q = query(
      collection(db, collectionName),
      where('restaurantId', '==', profile.restaurantId),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBills(billData);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.restaurantId, dateFilter, statusFilter]);

  const filteredBills = bills.filter(bill => {
    const matchesSearch = 
      bill.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.tableNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.captainName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter || (statusFilter === 'generated' && bill.status === 'billed');
    
    return matchesSearch && matchesStatus;
  });

  const { cancelBill, deleteBill, reopenOrder } = useOrderStore();

  const canCancelBill = profile?.role === 'owner' || profile?.role === 'admin' || profile?.permissions?.canCancelBill;
  const canDeleteBill = profile?.role === 'owner' || profile?.role === 'admin';

  const handleCancel = (bill: any) => {
    setCancellationContext({ type: 'cancel', bill });
  };

  const handleDelete = (bill: any) => {
    setCancellationContext({ type: 'delete', bill });
  };

  const confirmCancellation = async (reason: string) => {
    if (!cancellationContext) return;
    const { type, bill } = cancellationContext;

    try {
      if (type === 'cancel') {
        await cancelBill(bill.id, reason);
      } else {
        await deleteBill(bill.id, reason);
      }
    } catch (err) {
      toast.error("Action failed");
    } finally {
      setCancellationContext(null);
    }
  };

  const handleReopen = async (bill: any) => {
    if (window.confirm("Reopen this order? It will move back to active orders.")) {
      await reopenOrder(bill.orderId);
    }
  };

   const handlePrint = (bill: any) => {
    printReceipt({
      title: currentRestaurant?.restaurantName || 'RESTAURANT',
      type: 'BILL',
      tableNumber: bill.tableNumber,
      captainName: bill.captainName,
      items: bill.items,
      totalAmount: bill.subtotal,
      discountAmount: bill.discountAmount,
      gstAmount: bill.gstAmount,
      serviceChargeAmount: bill.serviceChargeAmount,
      orderId: bill.orderId,
      isCancelled: bill.status === 'cancelled' || bill.status === 'deleted' || bill.isCancelled
    });
    toast.success(bill.isCancelled ? 'Printing cancelled bill copy...' : 'Reprinting bill...');
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Bill History</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Review finalized transactions</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 text-xs uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 text-xs uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="generated">Active Bills</option>
              <option value="cancelled">Cancelled</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>
      </header>

      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Filter by invoice, table or captain..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600 shadow-sm"
        />
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill #</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Table</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold italic uppercase tracking-widest text-[10px]">
                     Loading records...
                   </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold italic uppercase tracking-widest text-[10px]">
                     No records found for the selected filters
                   </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-indigo-400" />
                        <span className="font-black text-slate-700 text-xs tracking-tighter">{bill.billNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-xs italic">
                        {bill.tableNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900">₹{Math.round(bill.finalAmount)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${
                        bill.status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                        bill.status === 'cancelled' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {bill.status === 'paid' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{bill.paymentMethod || '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">
                      {new Date(bill.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {bill.status !== 'cancelled' && bill.status !== 'deleted' && (
                          <>
                            <button
                              onClick={() => handlePrint(bill)}
                              className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                              title="Print Bill"
                            >
                              <Printer size={16} />
                            </button>
                            
                            <button
                              onClick={() => navigate(`/billing/${bill.orderId}`)}
                              className="p-2 hover:bg-white border border-transparent hover:border-indigo-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                              title="View in Billing"
                            >
                              <CreditCard size={16} />
                            </button>
                            
                            {canCancelBill && (
                              <button
                                onClick={() => handleCancel(bill)}
                                className="p-2 hover:bg-white border border-transparent hover:border-rose-200 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                                title="Cancel Bill"
                              >
                                <XCircle size={16} />
                              </button>
                            )}

                            {canDeleteBill && (
                              <button
                                onClick={() => handleDelete(bill)}
                                className="p-2 hover:bg-white border border-transparent hover:border-rose-200 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                                title="Delete Bill"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}

                            <button
                              onClick={() => handleReopen(bill)}
                              className="p-2 hover:bg-white border border-transparent hover:border-amber-200 rounded-lg text-slate-400 hover:text-amber-600 transition-all"
                              title="Reopen Order"
                            >
                              <RotateCcw size={16} />
                            </button>
                          </>
                        )}
                        {(bill.status === 'cancelled' || bill.status === 'deleted') && (
                          <button
                            onClick={() => handlePrint({ ...bill, isCancelled: true })}
                            className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                            title="Print Cancelled Bill"
                          >
                            <Printer size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CancellationReasonModal 
        isOpen={!!cancellationContext}
        onClose={() => setCancellationContext(null)}
        onConfirm={confirmCancellation}
        title={cancellationContext?.type === 'cancel' ? "Cancel Bill" : "Delete Bill"}
        message={cancellationContext?.type === 'cancel' ? "This will void the bill and move the order back to RUNNING status." : "This will permanently delete the bill and cancel the associated order."}
      />
    </div>
  );
};

export default BillHistory;
