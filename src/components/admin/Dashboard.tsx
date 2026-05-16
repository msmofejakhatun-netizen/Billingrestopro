import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { DollarSign, ShoppingCart, LayoutGrid, Users, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

const DashboardTab = () => {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    activeTables: 0,
    onlineCaptains: 0
  });

  useEffect(() => {
    if (!profile?.restaurantId) return;

    // Today's Orders & Sales
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const ordersQuery = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('orderStatus', '==', 'completed'),
      where('timestamp', '>=', startOfDay)
    );

    const unsubOrders = onSnapshot(ordersQuery, {
      next: (snapshot) => {
        let sales = 0;
        snapshot.docs.forEach(doc => {
          sales += doc.data().totalAmount || 0;
        });
        setStats(prev => ({ ...prev, todaySales: sales, todayOrders: snapshot.size }));
      },
      error: (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    });

    // Active Tables
    const tablesQuery = query(
      collection(db, 'tables'),
      where('restaurantId', '==', profile.restaurantId),
      where('status', 'in', ['occupied', 'running'])
    );
    const unsubTables = onSnapshot(tablesQuery, {
      next: (snapshot) => {
        setStats(prev => ({ ...prev, activeTables: snapshot.size }));
      },
      error: (error) => handleFirestoreError(error, OperationType.LIST, 'tables')
    });

    // Online Captains (Users with role captain, active: true)
    const captainsQuery = query(
      collection(db, 'users'),
      where('restaurantId', '==', profile.restaurantId),
      where('role', '==', 'captain'),
      where('active', '==', true)
    );
    const unsubCaptains = onSnapshot(captainsQuery, {
      next: (snapshot) => {
        setStats(prev => ({ ...prev, onlineCaptains: snapshot.size }));
      },
      error: (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    });

    return () => {
      unsubOrders();
      unsubTables();
      unsubCaptains();
    };
  }, [profile?.restaurantId]);

  const cards = [
    { title: "Today's Sales", value: `₹${stats.todaySales.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: "Orders Today", value: stats.todayOrders, icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: "Active Tables", value: stats.activeTables, icon: LayoutGrid, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: "Captains Online", value: stats.onlineCaptains, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div 
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${card.bg} ${card.color} group-hover:scale-110 transition-transform`}>
                <card.icon size={24} />
              </div>
              <TrendingUp size={16} className="text-slate-200" />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">{card.title}</p>
            <p className="text-3xl font-black text-slate-900 leading-none">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Recent Activity</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Latest updates from the floor</p>
            </div>
            <Calendar size={20} className="text-slate-300" />
          </div>
          <div className="space-y-6">
            {/* Mock activity for now */}
            {[
              { time: '2 mins ago', text: 'Table T4 cleared for next guest', icon: CheckCircle, color: 'text-emerald-500' },
              { time: '10 mins ago', text: 'New order #342 initiated at Table T1', icon: ShoppingCart, color: 'text-indigo-500' },
              { time: '25 mins ago', text: 'Captain Rahul joined the floor', icon: Users, color: 'text-blue-500' },
            ].map((activity, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center ${activity.color} flex-shrink-0`}>
                   <activity.icon size={20} />
                </div>
                <div className="pt-0.5">
                  <p className="text-sm font-bold text-slate-700 leading-tight">{activity.text}</p>
                  <p className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full -mr-32 -mt-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
          <h3 className="text-xl font-black uppercase tracking-tight mb-2">System Health</h3>
          <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8">Service Monitoring</p>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                <span>Database Sync</span>
                <span className="text-emerald-400">Stable</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '98%' }}
                  className="h-full bg-emerald-400" 
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                <span>Printer Engine</span>
                <span className="text-emerald-400">Ready</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="h-full bg-indigo-400" 
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                <span>API Latency</span>
                <span className="text-indigo-300">42ms</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '85%' }}
                   className="h-full bg-amber-400" 
                 />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckCircle = ({ size, className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);

export default DashboardTab;
