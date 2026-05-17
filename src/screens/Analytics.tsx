import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Package, ShoppingCart, DollarSign, Clock, 
  AlertTriangle, Filter, Calendar, Zap, ArrowUpRight, ArrowDownRight,
  TrendingDown, Info
} from 'lucide-react';
import { Order, OrderItem } from '../stores/useOrderStore';
import { format, subDays, isSameDay, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useAuthStore } from '../stores/useAuthStore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#4f46e5', '#818cf8', '#c7d2fe', '#e0e7ff'];

const Analytics = () => {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'cancellations' | 'performance'>('sales');

  useEffect(() => {
    if (!profile?.restaurantId) return;

    // Completed Orders
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('orderStatus', 'in', ['completed', 'billed']),
      orderBy('timestamp', 'desc')
    );

    const unsubCompleted = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // Cancelled Orders
    const qCancelled = query(
      collection(db, 'orders'),
      where('restaurantId', '==', profile.restaurantId),
      where('orderStatus', '==', 'cancelled'),
      orderBy('timestamp', 'desc')
    );

    const unsubCancelled = onSnapshot(qCancelled, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setCancelledOrders(results);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => {
      unsubCompleted();
      unsubCancelled();
    };
  }, [profile?.restaurantId]);

  if (loading) return <div className="p-8 text-center font-black animate-pulse uppercase tracking-widest text-slate-400">Loading Intelligence...</div>;

  // Aggregate Data
  const completedOrders = orders.filter(o => o.orderStatus === 'completed');
  const todayOrders = completedOrders.filter(o => o.timestamp?.toDate && isSameDay(o.timestamp.toDate(), new Date()));
  
  const totalSales = completedOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
  const todaySales = todayOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
  
  const avgOrderValue = totalSales / (completedOrders.length || 1);

  const cancellationRate = (cancelledOrders.length / (orders.length + cancelledOrders.length || 1)) * 100;
  const lostRevenue = cancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Popular Items
  const popularItemsMap: Record<string, number> = {};
  completedOrders.forEach(o => o.items.forEach(i => {
    if (i.status !== 'cancelled') {
      popularItemsMap[i.itemName] = (popularItemsMap[i.itemName] || 0) + i.quantity;
    }
  }));

  const popularItems = Object.entries(popularItemsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  // Sales Trend
  const last7Days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), i)).reverse();
  const salesData = last7Days.map(date => {
    const dayOrders = completedOrders.filter(o => o.timestamp?.toDate && isSameDay(o.timestamp.toDate(), date));
    const daySales = dayOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
    return { 
      name: format(date, 'MMM dd'), 
      sales: daySales,
      orders: dayOrders.length
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3 italic">
            <Zap size={32} className="text-indigo-600 fill-indigo-600" />
            Merchant <span className="text-indigo-600">Intelligence</span>
          </h2>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Live Restaurant Performance Dashboard</p>
        </div>

        <div className="flex bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
          {['sales', 'cancellations', 'performance'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                  : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'sales' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                <DollarSign size={80} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Gross Sales</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-slate-900 italic tracking-tighter">₹{totalSales.toLocaleString()}</p>
                <span className="text-emerald-500 text-[10px] font-black flex items-center gap-0.5">
                  <ArrowUpRight size={12} /> 12%
                </span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Today's Revenue</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-indigo-600 italic tracking-tighter">₹{todaySales.toLocaleString()}</p>
                <span className="text-slate-300 text-[10px] font-black">{todayOrders.length} orders</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Avg Order Value</p>
              <p className="text-3xl font-black text-slate-900 italic tracking-tighter">₹{Math.round(avgOrderValue)}</p>
            </div>

            <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm ${cancellationRate > 5 ? 'border-rose-100' : ''}`}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Cancellation Rate</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-black italic tracking-tighter ${cancellationRate > 5 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {cancellationRate.toFixed(1)}%
                </p>
                {cancellationRate > 5 && <AlertTriangle size={16} className="text-rose-500 animate-pulse" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Revenue Velocity</h3>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full" /> Last 7 Days
                </div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-8">Top Selling Products</h3>
              <div className="flex-1 space-y-6">
                {popularItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 group">
                    <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-xs font-black text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.qty / popularItems[0].qty) * 100}%` }}
                            className="h-full bg-indigo-600"
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 italic">{item.qty} units</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-10 py-4 bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all">
                View All Inventory
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'cancellations' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100">
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2">Lost Revenue</p>
                <p className="text-3xl font-black text-rose-600 italic tracking-tighter">₹{lostRevenue.toLocaleString()}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cancelled Tickets</p>
                <p className="text-3xl font-black text-slate-900 italic tracking-tighter">{cancelledOrders.length}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Avg Slip Loss</p>
                <p className="text-3xl font-black text-slate-900 italic tracking-tighter">₹{Math.round(lostRevenue / (cancelledOrders.length || 1))}</p>
             </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
             <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Recent Cancellations Audit</h3>
                <AlertTriangle size={20} className="text-amber-500" />
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                         <th className="px-8 py-4">ID / Table</th>
                         <th className="px-8 py-4">Captain</th>
                         <th className="px-8 py-4">Amount</th>
                         <th className="px-8 py-4">Reason</th>
                         <th className="px-8 py-4">Time</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 border-t border-slate-50">
                      {cancelledOrders.slice(0, 10).map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-8 py-5">
                              <p className="text-sm font-black text-slate-800">#{order.id?.slice(-6)}</p>
                              <p className="text-[10px] font-bold text-indigo-600 uppercase">Table {order.tableNumber}</p>
                           </td>
                           <td className="px-8 py-5">
                              <p className="text-sm font-bold text-slate-600">{order.captainName}</p>
                           </td>
                           <td className="px-8 py-5 font-black italic text-rose-500">₹{order.totalAmount}</td>
                           <td className="px-8 py-5">
                              <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight border border-amber-100">
                                 {order.cancellationReason || 'Mistake'}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {order.timestamp?.toDate ? format(order.timestamp.toDate(), 'HH:mm') : ''}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'performance' && (
        <div className="flex flex-col items-center justify-center py-40 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
           <TrendingUp size={48} className="text-slate-200 mb-4" />
           <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Enterprise Performance AI Coming Soon</p>
           <p className="text-[10px] font-bold text-slate-300 uppercase mt-2">Predictive analysis & Captain ranking</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
