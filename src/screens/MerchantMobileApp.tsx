import React, { useState, useEffect } from 'react';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  TrendingUp, TrendingDown, Clock, Users, 
  MapPin, Bell, ChevronRight, PieChart, 
  Settings, LogOut, BarChart4, Filter 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

const MerchantMobileApp = () => {
  const { currentRestaurant } = useRestaurantStore();
  const { profile } = useAuthStore();
  const [stats, setStats] = useState({ revenue: 0, orders: 0, activeTables: 0 });
  const [liveOrders, setLiveOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!currentRestaurant?.id) return;

    // Live Stats
    const ordersQ = query(
      collection(db, 'orders'),
      where('restaurantId', '==', currentRestaurant.id),
      where('orderStatus', '==', 'running'),
      limit(10)
    );

    return onSnapshot(ordersQ, (snapshot) => {
      setLiveOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStats(prev => ({ ...prev, activeTables: snapshot.size }));
    });
  }, [currentRestaurant?.id]);

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-32">
      {/* Mobile Top Bar */}
      <header className="px-6 pt-12 pb-10 bg-slate-800 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5">
            <PieChart size={120} />
         </div>
         <div className="flex justify-between items-center mb-8 relative z-10">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black">
                  {currentRestaurant?.restaurantName?.[0]}
               </div>
               <div>
                  <h1 className="text-sm font-black uppercase tracking-widest">{currentRestaurant?.restaurantName}</h1>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                     <MapPin size={8} /> Global Control
                  </p>
               </div>
            </div>
            <button className="relative w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
               <Bell size={20} />
               <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-800" />
            </button>
         </div>

         <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl shadow-indigo-900/20">
               <p className="text-[9px] font-black uppercase opacity-60 tracking-widest mb-2">Today Rev.</p>
               <h3 className="text-2xl font-black italic tracking-tighter">₹42,850</h3>
               <p className="text-[9px] font-black text-emerald-300 mt-2 flex items-center gap-1">
                  <TrendingUp size={10} /> +12%
               </p>
            </div>
            <div className="bg-slate-700/50 backdrop-blur-md p-6 rounded-[2rem] border border-white/5">
               <p className="text-[9px] font-black uppercase opacity-60 tracking-widest mb-2">Active Tables</p>
               <h3 className="text-2xl font-black italic tracking-tighter">{liveOrders.length}</h3>
               <p className="text-[9px] font-black text-indigo-400 mt-2">Peak Now</p>
            </div>
         </div>
      </header>

      {/* Main Content Area */}
      <main className="px-6 mt-10 space-y-10">
         <section>
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Global Live Monitor</h2>
               <button className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                  Filter <Filter size={10} />
               </button>
            </div>

            <div className="space-y-4">
               {liveOrders.map((order, i) => (
                 <motion.div 
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: i * 0.1 }}
                   key={order.id} 
                   className="bg-slate-800/50 border border-white/5 p-5 rounded-[2rem] flex items-center justify-between"
                 >
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-slate-700 flex items-center justify-center font-black text-indigo-400">
                          {order.tableNumber}
                       </div>
                       <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Running Order</p>
                          <h4 className="text-sm font-bold tracking-tight">₹{order.totalAmount.toLocaleString()}</h4>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter mb-1 flex items-center justify-end gap-1">
                          <Clock size={10} /> 12m ago
                       </p>
                       <p className="text-[9px] font-bold text-slate-500 uppercase">{order.captainName}</p>
                    </div>
                 </motion.div>
               ))}
            </div>
         </section>

         <section className="bg-slate-800/20 border border-white/5 p-8 rounded-[2.5rem]">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
               <BarChart4 size={14} className="text-indigo-600" />
               Enterprise Insights
            </h2>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-500">Wait Time</p>
                  <p className="text-sm font-black italic">Avg 14.5m</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-500">Labor Cost</p>
                  <p className="text-sm font-black italic text-rose-400">High</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-500">Peak Branch</p>
                  <p className="text-sm font-black italic">HSR Layout</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-slate-500">Staff Score</p>
                  <p className="text-sm font-black italic font-mono">9.2/10</p>
               </div>
            </div>
         </section>
      </main>

      {/* Mobile Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 px-6 py-6 flex justify-between items-center z-50">
         {[
           { icon: PieChart, active: true },
           { icon: Users, active: false },
           { icon: TrendingUp, active: false },
           { icon: Settings, active: false },
           { icon: LogOut, active: false, color: 'text-rose-500' }
         ].map((item, i) => (
           <button key={i} className={`p-3 rounded-2xl transition-all ${item.active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'text-slate-500 hover:text-white'} ${item.color || ''}`}>
              <item.icon size={22} />
           </button>
         ))}
      </nav>
    </div>
  );
};

export default MerchantMobileApp;
