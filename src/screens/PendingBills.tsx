import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { Receipt, Search, Printer, CreditCard, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { printQueueService } from '../services/printQueueService';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const PendingBills = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.restaurantId) return;

    // Realtime query on orders collection where paymentStatus suggests pending collection
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('paymentStatus', 'in', ['PENDING', 'pending', 'UNPAID', 'unpaid', 'partial'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((o: any) => {
          const status = String(o.orderStatus || '').toUpperCase();
          return status === 'GENERATED' || status === 'BILL_GENERATED' || status === 'BILLED';
        });
      // Sort in-memory to avoid needing a composite index on Firestore:
      const sortedData = orderData.sort((a: any, b: any) => {
        const tA = a.billedAt?.seconds || a.timestamp?.seconds || 0;
        const tB = b.billedAt?.seconds || b.timestamp?.seconds || 0;
        return tB - tA;
      });
      setOrders(sortedData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.restaurantId]);

  const filteredOrders = orders.filter(order => 
    order.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.tableNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.captainName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = async (order: any) => {
    try {
      await printQueueService.queuePrint({
        type: 'BILL',
        orderId: order.id,
        tableNumber: order.tableNumber,
        restaurantId: order.restaurantId,
        items: order.items,
        total: order.finalAmount || order.totalAmount,
        requestedBy: profile?.name || 'User'
      });
      toast.success('Print request sent to Billing Server');
    } catch (error) {
      toast.error('Print request failed');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Pending Bills</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Settle payments and clear tables</p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by Bill No, Table, Captain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600 transition-all shadow-sm"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Fetching pending bills...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
            <Receipt size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic">No Pending Bills</h3>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">All generated bills are currently settled</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all overflow-hidden group"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl italic shadow-lg">
                        {order.tableNumber}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill Number</p>
                        <p className="text-sm font-black text-slate-800 uppercase italic">{order.billNumber || `BN-${order.id?.slice(-6).toUpperCase()}`}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Amount</p>
                       <p className="text-2xl font-black text-indigo-600 italic">₹{Math.round(order.balanceAmount !== undefined ? order.balanceAmount : order.finalAmount || order.totalAmount)}</p>
                       {order.paidAmount > 0 && (
                         <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                           Paid: ₹{Math.round(order.paidAmount)}
                         </p>
                       )}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Billed {order.billedAt?.seconds ? new Date(order.billedAt.seconds * 1000).toLocaleTimeString() : 'Recently'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <AlertCircle size={14} className="text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                        {order.paidAmount > 0 ? 'Partial Paid' : 'Payment Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handlePrint(order)}
                      className="flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 font-black text-[10px] uppercase tracking-widest transition-colors"
                    >
                      <Printer size={16} />
                      Print Bill
                    </button>
                    <button
                      onClick={() => navigate(`/billing/${order.id}`)}
                      className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-100"
                    >
                      <CreditCard size={16} />
                      Settle Payment
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default PendingBills;
