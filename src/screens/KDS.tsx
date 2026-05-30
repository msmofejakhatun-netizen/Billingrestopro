import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, Timestamp, addDoc } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  ChefHat, Clock, CheckCircle2, AlertCircle, Utensils,
  Timer, Flame, Bell, CheckCircle, ChevronRight, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const KDS = () => {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!profile?.restaurantId) return;

    // Listen to Active Orders that are NOT completed/cancelled
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('orderStatus', 'in', ['running', 'RUNNING']),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Filter out orders that have items with 'preparing' or 'ready' status
      // In this version, we'll assume the kitchen manages per-order
      setOrders(results.filter(o => o.items.some((i: any) => i.status !== 'served')));
      setLoading(false);
      
      // Sound for new orders
      const lastChange = snapshot.docChanges().find(c => c.type === 'added');
      if (lastChange && !loading) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
        toast.info("NEW KOT RECEIVED", {
          description: `Table ${lastChange.doc.data().tableNumber}`
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.restaurantId, loading]);

  const updateItemStatus = async (orderId: string, itemIdx: number, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    newItems[itemIdx] = { ...newItems[itemIdx], status: newStatus };

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        items: newItems,
        kdsStatus: newItems.every(i => i.status === 'ready') ? 'ready' : 'preparing'
      });
    } catch (e) {
      toast.error("Failed to update kitchen status");
    }
  };

  const markOrderReady = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = order.items.map((i: any) => ({ ...i, status: 'ready' }));
    await updateDoc(doc(db, 'orders', orderId), { 
      items: newItems,
      kdsStatus: 'ready'
    });
    toast.success(`Table ${order.tableNumber} is READY`);
  };

  const markKOTReady = async (orderId: string, itemIdxs: number[]) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    itemIdxs.forEach(idx => {
      newItems[idx] = { ...newItems[idx], status: 'ready' };
    });

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        items: newItems,
        kdsStatus: newItems.every(i => i.status === 'ready') ? 'ready' : 'preparing'
      });
      toast.success("KOT Ticket marked ready!");
    } catch (e) {
      toast.error("Failed to update kitchen status");
    }
  };

  if (loading) return <div className="bg-slate-900 min-h-screen flex items-center justify-center text-indigo-400 font-black uppercase tracking-[0.2em] animate-pulse">Initializing Kitchen Hub...</div>;

  return (
    <div className="bg-slate-950 min-h-screen text-white p-6 md:p-10 font-sans overflow-x-hidden">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20">
              <ChefHat size={32} className="text-white" />
           </div>
           <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Kitchen <span className="text-indigo-500">Expeditor</span></h1>
              <div className="flex items-center gap-2 mt-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Connection Active</p>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-3xl border border-slate-800">
           <div className="px-6 py-2 border-r border-slate-800 text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Queue</p>
              <p className="text-2xl font-black text-white italic">{orders.length}</p>
           </div>
           <div className="px-6 py-2 text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Avg Time</p>
              <p className="text-2xl font-black text-emerald-400 italic">14m</p>
           </div>
           <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all"
           >
              <History size={20} className={showHistory ? 'text-indigo-400' : 'text-slate-400'} />
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        <AnimatePresence mode="popLayout">
          {orders.map((order) => {
            const minutesElapsed = order.timestamp ? Math.floor((Date.now() - order.timestamp.toMillis()) / 60000) : 0;
            const isLate = minutesElapsed > 15;

            // Group order items by kotId
            const kotGroups: Record<string, typeof order.items> = {};
            const itemIndices: Record<string, number[]> = {};

            order.items.forEach((item: any, idx: number) => {
              const kotId = item.kotId || 'Direct-Order';
              if (!kotGroups[kotId]) {
                kotGroups[kotId] = [];
                itemIndices[kotId] = [];
              }
              kotGroups[kotId].push(item);
              itemIndices[kotId].push(idx);
            });

            // Sort KOT IDs dynamically using original sequence first or alphabetical compare
            const sortedKotIds = Object.keys(kotGroups).sort((a, b) => {
              if (a === 'Direct-Order') return 1;
              if (b === 'Direct-Order') return -1;
              const aIdx = order.kotHistory?.findIndex((k: any) => k.id === a) ?? -1;
              const bIdx = order.kotHistory?.findIndex((k: any) => k.id === b) ?? -1;
              if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
              if (aIdx !== -1) return -1;
              if (bIdx !== -1) return 1;
              return a.localeCompare(b);
            });

            return (
              <motion.div 
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`flex flex-col bg-slate-900 border-2 rounded-[3.5rem] overflow-hidden shadow-2xl transition-all duration-500 ${isLate ? 'border-rose-600/50 shadow-rose-900/20' : 'border-slate-800'}`}
              >
                {/* Card Header */}
                <div className={`p-8 ${isLate ? 'bg-rose-950/20' : 'bg-slate-800/30'} flex items-center justify-between`}>
                   <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">TABLE</p>
                      <h3 className="text-4xl font-black tracking-tighter italic leading-none">{order.tableNumber}</h3>
                   </div>
                   <div className="text-right">
                      <div className={`flex items-center gap-2 justify-end mb-2 ${isLate ? 'text-rose-500' : 'text-emerald-500'}`}>
                         <Timer size={16} />
                         <span className="text-lg font-black italic">{minutesElapsed}m</span>
                      </div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">#{order.id.slice(-4)}</p>
                   </div>
                </div>

                {/* Items List Grouped by KOT */}
                <div className="p-8 flex-1 space-y-6">
                  {sortedKotIds.map((kotId) => {
                    const groupItems = kotGroups[kotId];
                    const originalIndices = itemIndices[kotId];
                    const isGroupCompleted = groupItems.every((item: any) => item.status === 'ready');

                    const kotHistoryEntry = order.kotHistory?.find((kh: any) => kh.id === kotId);
                    let kTimeStr = '';
                    if (kotHistoryEntry?.timestamp) {
                      try {
                        const dateObj = typeof kotHistoryEntry.timestamp.toDate === 'function'
                          ? kotHistoryEntry.timestamp.toDate()
                          : new Date(kotHistoryEntry.timestamp);
                        kTimeStr = format(dateObj, 'hh:mm a');
                      } catch (e) {
                        console.warn(e);
                      }
                    }

                    return (
                      <div 
                        key={kotId}
                        className={`p-4 rounded-3xl border transition-all ${
                          isGroupCompleted 
                            ? 'bg-slate-950/10 border-slate-800/30 opacity-55' 
                            : 'bg-slate-950/40 border-slate-800/80 shadow-md'
                        }`}
                      >
                        {/* KOT Header Block */}
                        <div className="flex items-center justify-between border-b border-slate-800/50 pb-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isGroupCompleted ? 'bg-slate-500' : 'bg-indigo-500 animate-pulse'}`} />
                            <p className="font-mono text-[9px] font-black uppercase text-indigo-400 tracking-wider">
                              {kotId === 'Direct-Order' ? 'Direct Punched' : `KOT: ${kotId.slice(-6).toUpperCase()}`}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {kTimeStr && (
                              <span className="text-[8px] font-bold text-slate-500 font-mono">
                                {kTimeStr}
                              </span>
                            )}
                            {!isGroupCompleted && (
                              <button
                                onClick={() => markKOTReady(order.id, originalIndices)}
                                className="px-2 py-1 bg-indigo-600/20 border border-indigo-500/25 text-indigo-400 rounded-lg hover:bg-indigo-650 hover:text-white transition-all flex items-center justify-center gap-1 text-[8px] font-black uppercase tracking-wider"
                                title="Mark Entire Ticket Ready"
                              >
                                <CheckCircle size={10} />
                                Ready
                              </button>
                            )}
                          </div>
                        </div>

                        {/* KOT Items */}
                        <div className="space-y-3">
                          {groupItems.map((item: any, gItemIdx: number) => {
                            const originalIdx = originalIndices[gItemIdx];
                            const isReady = item.status === 'ready';

                            return (
                              <div key={gItemIdx} className="flex items-start gap-4 group">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 transition-colors ${isReady ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-400'}`}>
                                  {item.quantity}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className={`text-xs font-bold uppercase tracking-tight transition-all ${isReady ? 'text-slate-500 line-through' : 'text-white'}`}>
                                      {item.itemName}
                                    </p>
                                    {!isReady && (
                                      <button 
                                        onClick={() => updateItemStatus(order.id, originalIdx, 'ready')}
                                        className="opacity-0 group-hover:opacity-100 p-1 bg-slate-800 rounded-lg hover:text-emerald-400 transition-all"
                                      >
                                        <CheckCircle size={12} />
                                      </button>
                                    )}
                                  </div>
                                  {item.notes && <p className="text-[9px] text-amber-500 font-bold mt-1 bg-amber-500/5 px-2 py-0.5 rounded inline-block">{item.notes}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Card Footer */}
                <div className="p-6 bg-slate-950/40">
                   <button 
                     onClick={() => markOrderReady(order.id)}
                     className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${order.kdsStatus === 'ready' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/40' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                   >
                     {order.kdsStatus === 'ready' ? <CheckCircle2 size={18} /> : <Flame size={18} />}
                     {order.kdsStatus === 'ready' ? 'READY TO SERVE' : 'MARK ALL READY'}
                   </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-40 animate-in fade-in duration-1000">
           <div className="w-32 h-32 bg-slate-900 rounded-full flex items-center justify-center text-slate-800 mb-8 blur-[1px]">
              <ChefHat size={80} />
           </div>
           <p className="text-2xl font-black italic uppercase tracking-tighter text-slate-800">Kitchen Clear</p>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 mt-4">All orders have been expedited</p>
        </div>
      )}
    </div>
  );
};

export default KDS;
