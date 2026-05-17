import React, { useState, useEffect } from 'react';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { 
  Box, Package, TrendingDown, AlertCircle, Plus, 
  Truck, ArrowUpRight, History, ShoppingCart, 
  ArrowRightLeft, FileText, Search, Filter 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const InventoryDashboard = () => {
  const { currentRestaurant } = useRestaurantStore();
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    if (!currentRestaurant?.id) return;

    const q = query(
      collection(db, 'inventory'),
      where('restaurantId', '==', currentRestaurant.id),
      orderBy('name', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });
  }, [currentRestaurant?.id]);

  const lowStockItems = stock.filter(item => item.currentStock <= item.minStockLevel);

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-indigo-400">SYNCING STOCK LEDGER...</div>;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full">Inventory Hub</span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">Stock & <span className="text-emerald-600">Procurement</span></h1>
           </div>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Real-time RAW MATERIAL MANAGEMENT</p>
        </div>
        <div className="flex gap-3">
           <button className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all">
              <Truck size={14} className="text-indigo-600" />
              Vendor Portal
           </button>
           <button className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-100">
              <Plus size={14} />
              New Purchase
           </button>
        </div>
      </header>

      {/* Warning Banner for Low Stock */}
      <AnimatePresence>
        {lowStockItems.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden"
          >
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
                   <AlertCircle size={24} className="animate-pulse" />
                </div>
                <div>
                   <p className="text-sm font-black text-rose-900 uppercase tracking-tight">Critical Stock Alert</p>
                   <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{lowStockItems.length} items have dropped below minimum thresholds</p>
                </div>
             </div>
             <button className="px-8 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all">
                Restock Now
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           { label: 'Total Inventory Value', value: '₹1,24,500', icon: Box, color: 'indigo' },
           { label: 'Active Items', value: stock.length, icon: Package, color: 'emerald' },
           { label: 'Purchase (This Month)', value: '₹48,200', icon: ShoppingCart, color: 'amber' },
           { label: 'Estimated Wastage', value: '1.2%', icon: TrendingDown, color: 'rose' }
         ].map((stat, i) => (
           <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className={`w-10 h-10 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl flex items-center justify-center mb-6`}>
                 <stat.icon size={20} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 italic tracking-tighter">{stat.value}</p>
           </div>
         ))}
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="px-10 py-8 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
               <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Master Stock List</h3>
               <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                  {['all', 'raw', 'semi-cooked', 'beverage'].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        categoryFilter === cat ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
               </div>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="relative flex-1 md:w-64">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search stock..." 
                    className="w-full bg-slate-50 border border-slate-100 py-3 pl-11 pr-4 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-200"
                  />
               </div>
               <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100">
                  <Filter size={18} />
               </button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                     <th className="px-10 py-5">Item Name</th>
                     <th className="px-10 py-5">Unit</th>
                     <th className="px-10 py-5 text-center">In Stock</th>
                     <th className="px-10 py-5 text-center">Avg Cost</th>
                     <th className="px-10 py-5">Status</th>
                     <th className="px-10 py-5 text-right">Action</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {stock.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                       <td className="px-10 py-6">
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.category || 'General'}</p>
                       </td>
                       <td className="px-10 py-6">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{item.unit}</span>
                       </td>
                       <td className="px-10 py-6 text-center font-mono font-black text-slate-900">
                          {item.currentStock.toLocaleString()}
                       </td>
                       <td className="px-10 py-6 text-center font-mono font-black text-emerald-600">
                          ₹{item.costPrice.toLocaleString()}
                       </td>
                       <td className="px-10 py-6">
                          {item.currentStock <= item.minStockLevel ? (
                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100">Low Stock</span>
                          ) : (
                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">Sufficient</span>
                          )}
                       </td>
                       <td className="px-10 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100"><History size={16}/></button>
                             <button className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><ArrowUpRight size={16}/></button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default InventoryDashboard;
