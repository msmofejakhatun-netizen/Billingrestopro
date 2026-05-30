import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { 
  Building2, TrendingUp, ShoppingBag, Box, Users, ShieldAlert,
  Clock, ArrowRight, ShieldCheck, FileText, ChevronRight, PlayCircle
} from 'lucide-react';
import { format, subDays, isSameDay } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function OwnerDashboardView() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.restaurantId) return;

    // 1. Fetch Today / Historic Completed and Billed Orders for Branch Sales
    const qCompleted = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('orderStatus', 'in', ['completed', 'COMPLETED', 'billed', 'BILL_GENERATED']),
      orderBy('timestamp', 'desc')
    );

    const unsubCompleted = onSnapshot(qCompleted, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // 2. Fetch Live Active Running Orders
    const qActive = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('orderStatus', 'in', ['running', 'placed', 'preparing', 'ready', 'served']),
      orderBy('timestamp', 'desc')
    );

    const unsubActive = onSnapshot(qActive, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveOrders(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // 3. Fetch Cancelled Orders
    const qCancelled = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('orderStatus', 'in', ['cancelled', 'CANCELLED']),
      orderBy('timestamp', 'desc')
    );

    const unsubCancelled = onSnapshot(qCancelled, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCancelledOrders(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // 4. Fetch Inventory Items for stock alerts
    const qInventory = query(
      collection(db, 'inventory'),
      where('restaurantId', '==', profile.restaurantId)
    );

    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventoryItems(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    // 5. Fetch Audit Trail logs
    const qLogs = query(
      collection(db, 'auditLogs'),
      where('restaurantId', '==', profile.restaurantId),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(results);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
      setLoading(false);
    });

    return () => {
      unsubCompleted();
      unsubActive();
      unsubCancelled();
      unsubInventory();
      unsubLogs();
    };
  }, [profile?.restaurantId]);

  // Calculations for dashboard metrics
  const todayCompleted = useMemo(() => {
    return orders.filter(o => o.timestamp?.toDate && isSameDay(o.timestamp.toDate(), new Date()));
  }, [orders]);

  const todaySales = useMemo(() => {
    return todayCompleted.reduce((sum, o) => sum + (o.finalAmount || o.totalAmount || 0), 0);
  }, [todayCompleted]);

  const totalSalesOverall = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.finalAmount || o.totalAmount || 0), 0);
  }, [orders]);

  const guestCountLive = useMemo(() => {
    return activeOrders.reduce((sum, o) => sum + (o.guestCount !== undefined ? o.guestCount : 2), 0);
  }, [activeOrders]);

  const lowStockCount = useMemo(() => {
    return inventoryItems.filter(item => {
      const current = Number(item.currentStock) || 0;
      const minLevel = Number(item.minStockLevel) || 5;
      return current <= minLevel;
    }).length;
  }, [inventoryItems]);

  // Popular items
  const topItemsData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach((i: any) => {
          if (i.status !== 'cancelled' && i.itemName) {
            map[i.itemName] = (map[i.itemName] || 0) + (i.quantity || 1);
          }
        });
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, qty]) => ({ name, qty }));
  }, [orders]);

  // Last 7 days Sales Trend
  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), i)).reverse();
    return days.map(day => {
      const dayOrders = orders.filter(o => o.timestamp?.toDate && isSameDay(o.timestamp.toDate(), day));
      const dayRev = dayOrders.reduce((sum, o) => sum + (o.finalAmount || o.totalAmount || 0), 0);
      return {
        name: format(day, 'MMM dd'),
        sales: dayRev,
        orders: dayOrders.length
      };
    });
  }, [orders]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="font-sans font-black tracking-widest text-slate-400 text-[10px] uppercase">Retrieving Outlet Metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* Upper Brand Grid Banner */}
      <div className="bg-slate-900 text-white rounded-[2rem] p-6 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-indigo-600/30 text-indigo-300 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-500/20">
                PRO ENTERPRISE CENTRAL
              </span>
              <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                LIVE STATUS
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight uppercase">
              {(profile as any)?.restaurantName || 'RestoPro Outlet'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Role: <span className="text-white font-extrabold">{profile?.role || 'Owner'}</span> &bull; Branch Code: {(profile as any)?.restaurantCode || 'L1'}
            </p>
          </div>
          <div className="flex bg-slate-800/80 border border-slate-700/50 p-2 rounded-2xl gap-4">
            <div className="px-3">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Live Orders</p>
              <p className="text-sm font-black text-rose-400">{activeOrders.length} Running</p>
            </div>
            <div className="border-l border-slate-750 px-3">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Pax Capacity</p>
              <p className="text-sm font-black text-indigo-400">{guestCountLive} Guest s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Branch Sales Completed Today */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-indigo-500">
            <TrendingUp size={64} />
          </div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 font-sans">Today's Sales (Completed)</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{todaySales.toLocaleString()}</h3>
            <span className="text-emerald-500 text-[9px] font-black uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded">
              +{todayCompleted.length} Bills
            </span>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Gross Branch Turnover Today</p>
        </div>

        {/* Total Overall Sales - Historic */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-teal-500 font-sans">
            <Building2 size={64} />
          </div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 font-sans">Branch sales (Historic)</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-indigo-600 tracking-tight">₹{totalSalesOverall.toLocaleString()}</h3>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">All-Time Cumulative Revenues</p>
        </div>

        {/* Live Active running order amount */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-rose-500">
            <ShoppingBag size={64} />
          </div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Live Orders Value</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-rose-600 tracking-tight">
              ₹{activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString()}
            </h3>
            <span className="text-rose-500 text-[9px] font-black bg-rose-50 px-1.5 py-0.5 rounded uppercase">
              Active
            </span>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Currently cooking/serving tables</p>
        </div>

        {/* Raw material / inventory warnings */}
        <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group ${lowStockCount > 0 ? 'border-rose-100 bg-rose-50/10' : ''}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform text-amber-500">
            <Box size={64} />
          </div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Inventory Stock Alerts</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-2xl font-black tracking-tight ${lowStockCount > 0 ? 'text-amber-600 shadow-rose-100' : 'text-slate-900'}`}>
              {lowStockCount} Items
            </h3>
            {lowStockCount > 0 ? (
              <span className="text-amber-600 text-[9px] font-black uppercase tracking-wider bg-amber-50 px-1.5 py-0.5 rounded leading-none">
                Reorder
              </span>
            ) : (
              <span className="text-emerald-600 text-[9px] font-black uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded leading-none">
                Healthy
              </span>
            )}
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Raw items below limit thresholds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Chart (AreaChart) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Revenue Trend Velocity</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Week-on-week financial trends</p>
            </div>
            <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase">
              <span className="w-2 h-2 bg-indigo-600 rounded-full" /> Last 7 Days
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ownerColorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} />
                <YAxis fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none' }}
                  labelStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#818cf8', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#ownerColorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Report Navigation Links */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <FileText size={18} className="text-indigo-600" />
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Audit & Analytics Reports</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Enterprise Command Controls</p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {[
                { label: 'Intelligence Analytics', desc: 'Revenue velocity & menu reports', path: '/analytics' },
                { label: 'Cancellations Audits', desc: 'Intervention audits & security logs', path: '/cancellation-audit' },
                { label: 'Billing Configuration', desc: 'Setup taxes, commissions & pricing', path: '/billing-config' },
                { label: 'Historic Bill Records', desc: 'Browse paid/settled historic sales', path: '/bill-history' },
                { label: 'Expenses Ledger', desc: 'Petty cash spending audits', path: '/expenses' },
                { label: 'Inventory Manager', desc: 'Manage stock ledger raw supplies', path: '/inventory' }
              ].map((item, id) => (
                <div 
                  key={id}
                  onClick={() => navigate(item.path)}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-50 hover:bg-slate-50 hover:border-slate-150 transition-all cursor-pointer group"
                >
                  <div>
                    <h5 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{item.label}</h5>
                    <p className="text-[9px] text-slate-450 font-semibold leading-none mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-350 group-hover:translate-x-1 transition-transform" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live active orders or tables overview + captain activity logs stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Live Orders Overview Panel */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Live Outlet Orders ({activeOrders.length})</h3>
            <span className="bg-rose-100 text-rose-700 text-[8px] font-black uppercase px-2 py-0.5 tracking-widest rounded-full animate-pulse">cooking</span>
          </div>

          <div className="space-y-2 max-h-[295px] overflow-y-auto pr-2">
            {activeOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-black text-xs uppercase tracking-wider">
                No tables ordering currently
              </div>
            ) : (
              activeOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 font-black rounded-xl flex items-center justify-center text-sm">
                      {order.tableNumber || 'KOT'}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">
                        ₹{(order.totalAmount || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        Captain: {order.captainName || 'Staff'} &bull; {order.guestCount || 2} Pax
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-wider rounded-lg">
                    {order.orderStatus || 'Running'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security / Critical Captain Activity Live Audit logs */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" size={18} />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Captain Activity Live Stream</h3>
            </div>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-black uppercase px-2 py-0.5 tracking-wider rounded-full">Secure Audit Trail</span>
          </div>

          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-black text-xs uppercase tracking-wider">
                Waiting on staff activities stream...
              </div>
            ) : (
              logs.map((log) => {
                let badgeStyle = 'bg-slate-55 text-slate-600';
                if (log.action?.includes('CANCEL') || log.action?.includes('DELETE')) {
                  badgeStyle = 'bg-rose-50 text-rose-700 border border-rose-100';
                } else if (log.action?.includes('PRICE') || log.action?.includes('DISCOUNT')) {
                  badgeStyle = 'bg-amber-50 text-amber-700 border border-amber-150';
                } else if (log.action?.includes('BILL') || log.action?.includes('SETTLE')) {
                  badgeStyle = 'bg-indigo-50 text-indigo-700 border border-indigo-150';
                }

                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-50/80 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${badgeStyle}`}>
                          {log.action?.replace('_', ' ')}
                        </span>
                        <span className="text-[8px] font-black text-slate-405">
                          {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm') : 'Recently'}
                        </span>
                      </div>
                      <p className="text-xs font-black text-slate-700 mt-1 uppercase tracking-tight">
                        {log.details || 'Intervention recorded'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Staff: <span className="text-slate-600 font-extrabold">{log.userName || 'Unknown'}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
