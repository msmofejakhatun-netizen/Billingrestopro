import React, { useState, useEffect } from 'react';
import { useExpenseStore, Expense } from '../stores/useExpenseStore';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Plus, Search, Trash2, Edit3, Calendar, IndianRupee, Tag, Info } from 'lucide-react';
import { format } from 'date-fns';

const Categories = ["Staff Salary", "Grocery", "Gas", "Electricity", "Maintenance", "Misc"] as const;

const Expenses = () => {
  const { expenses, loading, addExpense, deleteExpense, subscribeExpenses } = useExpenseStore();
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    category: 'Misc' as any,
    amount: '',
    paymentMethod: 'CASH',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const unsub = subscribeExpenses();
    return () => unsub();
  }, [subscribeExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addExpense({
      ...formData,
      amount: Number(formData.amount),
      date: formData.date
    });
    setIsAdding(false);
    setFormData({
      title: '',
      category: 'Misc',
      amount: '',
      paymentMethod: 'CASH',
      notes: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const filteredExpenses = expenses.filter(exp => 
    exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Expenses</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Track restaurant operational costs</p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
        >
          <Plus size={18} />
          Log New Expense
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics or Quick Glance */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-100">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Total Monthly Spend</p>
            <h3 className="text-4xl font-black italic tracking-tighter">
              ₹{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
            </h3>
            <div className="mt-8 pt-8 border-t border-indigo-500/30 grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Items</p>
                  <p className="text-xl font-black">{expenses.length}</p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Avg. Cost</p>
                  <p className="text-xl font-black">₹{Math.round(expenses.length ? expenses.reduce((sum, e) => sum + e.amount, 0)/expenses.length : 0)}</p>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Common Categories</h4>
             <div className="space-y-2">
                {Categories.map(cat => (
                   <div key={cat} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-indigo-500" />
                         <span className="text-[11px] font-black uppercase text-slate-600">{cat}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 italic">
                         ₹{expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0)}
                      </span>
                   </div>
                ))}
             </div>
          </div>
        </div>

        {/* Expense List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by title, category, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600"
            />
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic">
                  {loading ? (
                     <tr><td colSpan={5} className="p-20 text-center font-bold text-slate-300">Loading...</td></tr>
                  ) : filteredExpenses.length === 0 ? (
                     <tr><td colSpan={5} className="p-20 text-center font-bold text-slate-300 uppercase tracking-widest text-xs">No records found</td></tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-indigo-50/20 transition-colors group">
                        <td className="px-6 py-5">
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{exp.title}</p>
                           {exp.notes && <p className="text-[9px] font-bold text-slate-400 tracking-wider truncate max-w-[150px]">{exp.notes}</p>}
                        </td>
                        <td className="px-6 py-5 font-black text-rose-500 text-sm">-₹{exp.amount}</td>
                        <td className="px-6 py-5">
                           <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded font-black text-[8px] uppercase tracking-widest border border-slate-100 whitespace-nowrap">
                             {exp.category}
                           </span>
                        </td>
                        <td className="px-6 py-5 text-[10px] font-mono text-slate-400">
                           {exp.date?.seconds ? format(new Date(exp.date.seconds * 1000), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-6 py-5 text-right">
                           <button 
                             onClick={() => deleteExpense(exp.id)}
                             className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                           >
                              <Trash2 size={16} />
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
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-0">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase italic">Log Expense</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provide expense details below</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Title / Description</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Milk for Chai"
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold italic"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-[10px] uppercase tracking-widest"
                      >
                         {Categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Amount</label>
                      <input
                        required
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        placeholder="0.00"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-rose-500 italic"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Method</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-[10px] uppercase tracking-widest"
                      >
                         <option value="CASH">CASH</option>
                         <option value="CARD">CARD</option>
                         <option value="UPI">UPI</option>
                         <option value="BANK">BANK</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Date</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold text-xs"
                      />
                   </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Add extra info..."
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium italic text-xs"
                  />
                </div>

                <div className="pt-4 grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 font-black text-[11px] uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-100"
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Expenses;
