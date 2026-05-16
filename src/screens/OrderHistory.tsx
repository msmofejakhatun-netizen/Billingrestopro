import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, query, where, orderBy, limit, onSnapshot, Timestamp, startAt, endAt 
} from 'firebase/firestore';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { 
  History, Calendar, Filter, ChevronRight, CheckCircle, XCircle, 
  Search, Receipt, Table as TableIcon, User, Clock, ChevronLeft, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, useOrderStore } from '../stores/useOrderStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/useAuthStore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const OrderHistory = () => {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const cancelOrder = useOrderStore(state => state.cancelOrder);
  const navigate = useNavigate();

  const handleCancelOrder = async () => {
    if (!selectedOrder?.id || !cancelReason.trim()) {
      toast.error('Please enter a reason for cancellation');
      return;
    }
    try {
      await cancelOrder(selectedOrder.id, cancelReason);
      toast.success('Order cancelled successfully');
      setSelectedOrder(null);
      setIsCancelling(false);
      setCancelReason('');
    } catch (e) {
      toast.error('Failed to cancel order');
    }
  };

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    let startDate: Date;
    const now = new Date();

    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1));
        break;
      case 'week':
        startDate = startOfDay(subDays(now, 7));
        break;
      case 'month':
        startDate = startOfDay(subDays(now, 30));
        break;
      default:
        startDate = startOfDay(now);
    }

    const endDate = dateRange === 'yesterday' ? endOfDay(subDays(now, 1)) : endOfDay(now);

    let q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate)),
      orderBy('timestamp', 'desc')
    );

    if (statusFilter !== 'all') {
      // Note: This might require a composite index if combined with range on timestamp
      // For now, let's filter client-side if we hit index issues, or assume simple queries work.
      // Firestore requires indexes for multiple fields with range and equality.
      // Better to filter client side if we don't want to force user to create indexes.
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      if (statusFilter !== 'all') {
        results = results.filter(o => o.orderStatus === statusFilter);
      } else {
        results = results.filter(o => o.orderStatus === 'completed' || o.orderStatus === 'cancelled');
      }

      setOrders(results);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dateRange, statusFilter, profile]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'cancelled': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-slate-400 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <History size={32} className="text-indigo-600" />
            Order History
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Review and manage past transactions</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            {(['today', 'yesterday', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  dateRange === r ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          
          <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            {(['all', 'completed', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  statusFilter === s ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Orders List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-white rounded-[1.5rem] border border-slate-100 animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100 shadow-sm space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                <Search size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">No Orders Found</h3>
                <p className="text-slate-400 text-sm font-medium mt-1">Try adjusting your filters to see more results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <motion.div
                  layoutId={order.id}
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`group bg-white p-5 rounded-[1.5rem] border transition-all cursor-pointer flex items-center justify-between ${
                    selectedOrder?.id === order.id ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-xl' : 'border-slate-100 hover:border-indigo-200 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                      <TableIcon size={18} className="text-slate-400 group-hover:text-indigo-400" />
                      <span className="text-[10px] font-black text-slate-900 leading-none mt-1">{order.tableNumber}</span>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-slate-900 uppercase tracking-tight text-sm">₹{order.finalAmount || order.totalAmount}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Clock size={10} />
                          {order.timestamp?.toDate ? format(order.timestamp.toDate(), 'hh:mm a') : '...'}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border-l border-slate-200 pl-3">
                          <User size={10} />
                          {order.captainName}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Items</p>
                      <p className="text-xs font-black text-slate-700">{order.items.reduce((s, i) => s + i.quantity, 0)}</p>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Details Panel */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden sticky top-8"
              >
                <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Table {selectedOrder.tableNumber}</p>
                      <h3 className="text-2xl font-black uppercase tracking-tighter">Order Summary</h3>
                    </div>
                    <button 
                      onClick={() => navigate(`/billing/${selectedOrder.id}`)}
                      className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                      title="View Full Bill"
                    >
                      <Receipt size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${item.status === 'cancelled' ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black border ${item.status === 'cancelled' ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-white text-indigo-600 border-slate-200'}`}>
                            {item.quantity}
                          </span>
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold uppercase ${item.status === 'cancelled' ? 'text-rose-600 line-through' : 'text-slate-700'}`}>
                              {item.itemName}
                            </span>
                            {item.status === 'cancelled' && (
                              <span className="text-[8px] font-black text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded w-fit uppercase tracking-tighter mt-0.5 animate-pulse">
                                Cancelled
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs font-black ${item.status === 'cancelled' ? 'text-rose-400 font-bold' : 'text-slate-900'}`}>
                          ₹{item.status === 'cancelled' ? 0 : (item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-dashed border-slate-200 space-y-2">
                    <div className="flex justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <span>Subtotal</span>
                      <span>₹{selectedOrder.totalAmount}</span>
                    </div>
                    {selectedOrder.discountAmount && selectedOrder.discountAmount > 0 && (
                      <div className="flex justify-between text-rose-500 text-[10px] font-black uppercase tracking-widest">
                        <span>Discount</span>
                        <span>-₹{selectedOrder.discountAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 text-sm font-black uppercase tracking-tight pt-2 border-t border-slate-100">
                      <span>Total</span>
                      <span>₹{selectedOrder.finalAmount || selectedOrder.totalAmount}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                      <p className={`text-[10px] font-black uppercase flex items-center gap-1 ${
                        selectedOrder.orderStatus === 'completed' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {selectedOrder.orderStatus === 'completed' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {selectedOrder.orderStatus}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment</p>
                      <p className="text-[10px] font-black uppercase text-indigo-600">{selectedOrder.paymentMethod || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 col-span-2">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                      <p className="text-[10px] font-black uppercase text-slate-600">{selectedOrder.orderNotes || 'No notes'}</p>
                    </div>
                    {selectedOrder.cancellationReason && (
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 col-span-2">
                          <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Cancellation Reason</p>
                          <p className="text-[10px] font-black uppercase text-rose-600">{selectedOrder.cancellationReason}</p>
                        </div>
                    )}
                    {selectedOrder.orderStatus === 'running' && (
                      <div className="col-span-2 space-y-3 pt-4">
                        {isCancelling ? (
                          <div className="space-y-3 p-4 bg-white border border-rose-100 rounded-2xl">
                             <input 
                              type="text" 
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Reason for cancellation..."
                              className="w-full text-xs p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                             />
                             <div className="flex gap-2">
                               <button 
                                 onClick={handleCancelOrder}
                                 className="flex-1 bg-rose-600 text-white text-[10px] font-black uppercase py-3 rounded-xl hover:bg-rose-700"
                               >
                                 Confirm Cancel
                               </button>
                               <button 
                                 onClick={() => setIsCancelling(false)}
                                 className="flex-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase py-3 rounded-xl"
                               >
                                 Back
                               </button>
                             </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setIsCancelling(true)}
                            className="w-full flex items-center justify-center gap-2 bg-rose-600 text-white text-[10px] font-black uppercase py-4 rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                          >
                            <AlertCircle size={14} />
                            Cancel Order
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-[500px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem]">
                <div className="text-center text-slate-300">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <ChevronLeft size={32} />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest">Select an order<br/>to view details</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default OrderHistory;
