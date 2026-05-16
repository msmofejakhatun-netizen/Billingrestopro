import React, { useEffect, useState } from 'react';
import { useOrderStore, Order } from '../stores/useOrderStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useTableStore } from '../stores/useTableStore';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Users, X, CheckCircle, Receipt, Printer, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { printQueueService } from '../services/printQueueService';
import { toast } from 'sonner';
import { CancellationReasonModal } from '../components/CancellationReasonModal';

const ActiveOrders = () => {
  const { activeOrders, subscribeActiveOrders, cancelOrder, setCurrentOrder, setCurrentTable } = useOrderStore();
  const { tables, subscribe: subscribeTables, updateStatus } = useTableStore();
  const { profile } = useAuthStore();
   const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationContext, setCancellationContext] = useState<{ type: 'order' | 'item', order: Order, itemIdx?: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;

    const unsubOrders = subscribeActiveOrders();
    const unsubTables = subscribeTables();
    return () => {
      unsubOrders();
      unsubTables();
    };
  }, [subscribeActiveOrders, subscribeTables, profile]);

  const canEdit = profile?.role === 'owner' || profile?.role === 'admin' || profile?.permissions?.canEditOrder;
   const canCancel = profile?.role === 'owner' || profile?.role === 'admin' || profile?.permissions?.canCancelOrder;
  const canBill = profile?.role === 'owner' || profile?.role === 'admin' || profile?.permissions?.canGenerateBill;

  const handleCancelOrder = (order: Order) => {
    if (!canCancel) return toast.error("Not authorized to cancel orders");
    
    // Void Bill Approval logic
    if (order.billed && profile?.role === 'captain') {
      return toast.error("Bill already generated. Only Admin/Owner can void a generated bill.");
    }

    setCancellationContext({ type: 'order', order });
  };

  const confirmCancellation = async (reason: string) => {
    if (!cancellationContext) return;
    const { type, order, itemIdx } = cancellationContext;

    setCancelling(true);
    try {
      if (type === 'order') {
        const table = tables.find(t => t.tableNumber === order.tableNumber);
        if (!table) throw new Error("Table not found");
        await cancelOrder(order.id!, reason);
        toast.success("Order cancelled");
        setSelectedOrder(null);
      } else if (type === 'item' && itemIdx !== undefined) {
        await useOrderStore.getState().cancelItem(order.id!, itemIdx, reason);
        toast.success("Item cancelled");
      }
    } catch (err) {
      toast.error("Action failed");
    } finally {
      setCancelling(false);
      setCancellationContext(null);
    }
  };

  const handleEditOrder = (order: Order) => {
    if (!canEdit) return toast.error("Not authorized to edit orders");
    useOrderStore.getState().loadOrderToCart(order);
    navigate('/menu');
  };

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Active Orders</h2>
        <p className="text-gray-500 text-sm">{activeOrders.length} orders currently in kitchen/running</p>
      </header>

      {activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ClipboardList className="text-gray-300" size={32} />
          </div>
          <p className="text-gray-400 font-medium">No running orders</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {activeOrders.map((order) => {
              const table = tables.find(t => t.tableNumber === order.tableNumber);
              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:border-indigo-100 transition-all hover:shadow-lg"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex flex-col lg:flex-row h-full">
                    {/* Left Column: Order Header & Info */}
                    <div className="p-5 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-50 bg-slate-50/50 group-hover:bg-indigo-50/30 transition-colors lg:w-48 shrink-0">
                      <div className="flex lg:flex-col items-center lg:items-start justify-between gap-4">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-slate-200 group-hover:bg-indigo-600 transition-colors shrink-0">
                          {order.tableNumber}
                        </div>
                        <div className="flex-1 lg:flex-none">
                          <h4 className="font-bold text-slate-800 line-clamp-1">Capt. {order.captainName}</h4>
                          <div className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">
                            <Clock size={10} />
                            {order.timestamp?.toDate ? format(order.timestamp.toDate(), 'hh:mm a') : 'Live'}
                          </div>
                        </div>
                        <div className="flex gap-1.5 lg:flex-col">
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            Running
                          </span>
                          {order.paymentStatus === 'paid' ? (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                              <CheckCircle size={10} /> Paid
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                              Unpaid
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Items and Totals */}
                    <div className="flex flex-col flex-1">
                      <div className="px-6 py-5 flex-1 space-y-3">
                        <h5 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Items List</h5>
                        {order.items.slice(0, 4).map((item, idx) => (
                          <div key={idx} className={`flex justify-between items-start text-sm ${item.status === 'cancelled' ? 'opacity-50' : ''}`}>
                            <div className="flex-1 truncate pr-4">
                              <p className={`font-bold truncate ${item.status === 'cancelled' ? 'text-rose-500 line-through' : 'text-slate-700'}`}>
                                {item.itemName}
                              </p>
                              {item.notes && <p className="text-[9px] text-indigo-500 italic truncate italic">"{item.notes}"</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-black px-2 py-0.5 rounded-md text-[10px] ${item.status === 'cancelled' ? 'bg-rose-50 text-rose-400' : 'bg-indigo-50 text-indigo-600'}`}>x{item.quantity}</span>
                              <span className={`font-black italic tabular-nums ${item.status === 'cancelled' ? 'text-rose-300' : 'text-slate-400'}`}>₹{item.status === 'cancelled' ? 0 : item.price * item.quantity}</span>
                            </div>
                          </div>
                        ))}
                        {order.items.length > 4 && (
                          <p className="text-[10px] font-black uppercase text-indigo-400 text-center pt-2">+{order.items.length - 4} more items</p>
                        )}
                      </div>

                      <div className="p-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-white" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Running Total</span>
                          <span className="text-2xl font-black text-indigo-600">₹{order.totalAmount}</span>
                        </div>
                        <div className="flex gap-2 flex-1 sm:flex-none">
                           <button 
                            onClick={async () => {
                              try {
                                await printQueueService.queuePrint({
                                  type: 'KOT',
                                  orderId: order.id!,
                                  tableNumber: order.tableNumber,
                                  restaurantId: order.restaurantId,
                                  items: order.items,
                                  requestedBy: profile?.name || 'Captain'
                                });
                                toast.success('KOT Reprint request sent');
                              } catch (e) {
                                toast.error('Reprint failed');
                              }
                            }}
                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm group"
                            title="Reprint KOT"
                          >
                            <Printer size={18} className="group-hover:scale-110 transition-transform" />
                          </button>
                          <button 
                            onClick={() => handleEditOrder(order)}
                            disabled={order.billed}
                            className={`p-3 bg-white border border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200 rounded-xl transition-all shadow-sm ${(!canEdit || order.billed) ? 'opacity-30 cursor-not-allowed' : ''}`}
                            title={order.billed ? "Cannot edit billed order" : "Edit Order"}
                          >
                            <ClipboardList size={18} />
                          </button>
                          <button 
                            disabled={!canBill}
                            onClick={() => navigate(`/billing/${order.id}`)}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-3 rounded-2xl font-black shadow-sm hover:bg-indigo-100 transition-all text-[10px] uppercase tracking-widest border border-indigo-100 ${!canBill ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Receipt size={16} />
                            Settlement
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-100">
                    {selectedOrder.tableNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 uppercase tracking-tight text-xl">Order Details</h3>
                      {selectedOrder.paymentStatus === 'paid' ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-black uppercase tracking-widest">Paid</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-black uppercase tracking-widest">Unpaid</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Captain {selectedOrder.captainName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 space-y-8">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Order ID</p>
                    <p className="font-mono text-sm font-black text-slate-700">#{selectedOrder.id?.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Started At</p>
                    <p className="text-sm font-black text-slate-700">
                      {selectedOrder.timestamp?.toDate ? format(selectedOrder.timestamp.toDate(), 'hh:mm a') : 'Live'}
                    </p>
                  </div>
                </div>

                {/* Status Toggles/Info */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                    <Clock size={12} />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {selectedOrder.billed ? 'Billed' : 'Running'}
                    </span>
                  </div>
                  {selectedOrder.orderNotes && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shrink-0">
                      <ClipboardList size={12} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Has Notes</span>
                    </div>
                  )}
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Items Ordered</h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {selectedOrder.items.length} Items total
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className={`flex flex-col gap-2 p-4 rounded-[1.5rem] border transition-all ${item.status === 'cancelled' ? 'bg-rose-50/50 border-rose-100 opacity-60' : 'bg-white border-slate-100 group hover:border-indigo-200'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${item.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                              {item.quantity}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`font-black tracking-tight ${item.status === 'cancelled' ? 'text-rose-700 line-through' : 'text-slate-700'}`}>{item.itemName}</p>
                                {item.status === 'cancelled' && (
                                  <span className="text-[8px] font-black text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded w-fit uppercase tracking-tighter">
                                    Voided
                                  </span>
                                )}
                              </div>
                              {item.notes && <p className={`text-[10px] font-medium mt-0.5 italic ${item.status === 'cancelled' ? 'text-rose-400' : 'text-indigo-500'}`}>"{item.notes}"</p>}
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">₹{item.price} per unit</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <span className={`font-black text-lg tabular-nums ${item.status === 'cancelled' ? 'text-rose-400' : 'text-slate-900'}`}>₹{item.price * item.quantity}</span>
                            
                            {item.status !== 'cancelled' && (
                              <div className="flex items-center gap-2">
                                <select 
                                  value={item.status}
                                  onChange={(e) => useOrderStore.getState().updateItemStatus(selectedOrder.id!, idx, e.target.value as any)}
                                  className="text-[10px] font-black uppercase tracking-widest bg-slate-100 border-none rounded-xl px-3 py-1.5 outline-none appearance-none cursor-pointer hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="preparing">Preparing</option>
                                  <option value="served">Served</option>
                                </select>
                                <button 
                                  onClick={() => {
                                    setCancellationContext({ type: 'item', order: selectedOrder, itemIdx: idx });
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                  title="Cancel Item"
                                >
                                  <X size={14} strokeWidth={3} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KOT History Timeline */}
                {selectedOrder.kotHistory && selectedOrder.kotHistory.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">KOT Timeline</h4>
                    <div className="space-y-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                      {selectedOrder.kotHistory.map((kot, kIdx) => (
                        <div key={kIdx} className="relative pl-10">
                          <div className="absolute left-3 top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                            <div className="flex justify-between items-center">
                              <p className="font-black text-[10px] uppercase text-slate-600">{kot.id}</p>
                              <p className="text-[9px] font-bold text-slate-400">
                                {kot.timestamp?.toDate ? format(kot.timestamp.toDate(), 'hh:mm a') : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {kot.items.map((ki, kiIdx) => (
                                <span key={kiIdx} className={`text-[10px] font-black px-2 py-1 rounded-lg ${ki.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-white text-slate-600 border border-slate-100'}`}>
                                  {ki.itemName} x{ki.quantity}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Notes */}
                {selectedOrder.orderNotes && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order Notes</h4>
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <p className="text-sm font-medium text-amber-900 italic">"{selectedOrder.orderNotes}"</p>
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="pt-8 border-t border-dashed border-slate-100">
                  <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl space-y-4">
                    <div className="flex justify-between items-center opacity-60">
                      <span className="text-xs font-black uppercase tracking-[0.2em]">Running Total</span>
                      <span className="text-sm font-black">₹{selectedOrder.totalAmount}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Settlement Amount</span>
                        <p className="text-4xl font-black italic tracking-tighter">₹{selectedOrder.totalAmount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full inline-block">
                          {selectedOrder.paymentStatus}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-50 grid grid-cols-2 gap-4">
                <button 
                   onClick={() => handleCancelOrder(selectedOrder)}
                   disabled={!canCancel || cancelling}
                   className={`flex items-center justify-center gap-2 bg-white border border-rose-100 text-rose-500 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-rose-50 transition-all ${(!canCancel || cancelling) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <X size={16} />
                  {cancelling ? 'Wait...' : 'Cancel Order'}
                </button>
                <button 
                  onClick={() => handleEditOrder(selectedOrder)}
                  disabled={!canEdit || selectedOrder.billed}
                  className={`flex items-center justify-center gap-2 bg-white border border-amber-100 text-amber-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-amber-50 transition-all ${(!canEdit || selectedOrder.billed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ClipboardList size={16} />
                  {selectedOrder.billed ? 'Billed (Locked)' : 'Edit / Add Items'}
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await printQueueService.queuePrint({
                        type: 'KOT',
                        orderId: selectedOrder.id!,
                        tableNumber: selectedOrder.tableNumber,
                        restaurantId: selectedOrder.restaurantId,
                        items: selectedOrder.items,
                        requestedBy: profile?.name || 'Captain'
                      });
                      toast.success('Kitchen copy request sent');
                    } catch (e) {
                      toast.error('Reprint failed');
                    }
                  }}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
                >
                  <Printer size={16} />
                  Kitchen Copy
                </button>
                <button 
                  disabled={!canBill}
                  onClick={() => navigate(`/billing/${selectedOrder.id}`)}
                  className={`flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all ${!canBill ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Receipt size={16} />
                  Settlement
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CancellationReasonModal 
        isOpen={!!cancellationContext}
        onClose={() => setCancellationContext(null)}
        onConfirm={confirmCancellation}
        title={cancellationContext?.type === 'order' ? "Cancel Entire Order" : "Cancel Item"}
        message={cancellationContext?.type === 'order' ? "Are you sure you want to cancel this entire order?" : "Please specify why this item is being cancelled."}
      />
    </div>
  );
};

export default ActiveOrders;
