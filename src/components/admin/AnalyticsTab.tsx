import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { BarChart3, TrendingUp, Users, ShoppingBag, IndianRupee, Calendar } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const AnalyticsTab = () => {
  const { profile } = useAuthStore();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Generate some mock historical data for the chart if real data is sparse
    const mockData = [
      { name: 'Mon', sales: 4000, orders: 24 },
      { name: 'Tue', sales: 3000, orders: 18 },
      { name: 'Wed', sales: 2000, orders: 12 },
      { name: 'Thu', sales: 2780, orders: 20 },
      { name: 'Fri', sales: 1890, orders: 15 },
      { name: 'Sat', sales: 2390, orders: 19 },
      { name: 'Sun', sales: 3490, orders: 22 },
    ];
    setData(mockData);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: 'Gross Revenue', value: '₹1,24,500', trend: '+12.5%', icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { title: 'Custome Count', value: '1,420', trend: '+5.2%', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { title: 'Avg Order Value', value: '₹340', trend: '-2.1%', icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <div className="flex justify-between items-start mb-4">
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                   <stat.icon size={24} />
                </div>
                <span className={`text-xs font-black px-2 py-1 rounded-lg ${stat.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {stat.trend}
                </span>
             </div>
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.title}</p>
             <p className="text-3xl font-black text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sales Velocity</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Weekly performance index</p>
          </div>
          <div className="flex gap-2">
             <button className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-400">7 Days</button>
             <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">30 Days</button>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
              />
              <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
