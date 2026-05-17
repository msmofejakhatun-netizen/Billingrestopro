import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { ShoppingBag, Clock, CheckCircle, IndianRupee, Eye, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

const OrdersTab = () => {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!profile?.restaurantId) return;

    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });
  }, [profile?.restaurantId]);

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.orderStatus === filter);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'running': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex gap-2">
          {['all', 'running', 'completed', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === s ? 'bg-slate-900 text-white shadow-xl translate-y-[-2px]' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Order Ref</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Table</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Captain</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredOrders.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 italic">No orders recorded in this segment</td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                           <ShoppingBag size={18} />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 leading-none">#{order.id.slice(-6).toUpperCase()}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase mt-1">
                            {order.timestamp?.toDate ? new Date(order.timestamp.toDate()).toLocaleTimeString() : 'Recent'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-bold text-slate-600">Table {order.tableNumber}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{order.captainName || 'Self'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex justify-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-black text-slate-900">₹{(order.totalAmount || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-3 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrdersTab;
