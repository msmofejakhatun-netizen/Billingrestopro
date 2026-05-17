import React, { useState } from 'react';
import { useTableStore, RestaurantTable } from '../../stores/useTableStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { LayoutGrid, Plus, Trash2, CheckCircle, Clock, AlertCircle, QrCode, X, Download, ArrowUpNarrowWide, ArrowDownWideNarrow, Edit2, Users, Layers } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'motion/react';

const TableManager = () => {
  const { profile } = useAuthStore();
  const { tables, addTable, deleteTable, updateStatus, updateTable } = useTableStore();
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Hall');
  const [sections, setSections] = useState<string[]>(['Hall', 'Outside', 'Outdoor', 'Other']);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  const filteredTables = tables.filter(t => (t.section || 'Hall') === activeTab);

  const sortedTables = [...filteredTables].sort((a, b) => {
    const numA = parseInt(a.tableNumber.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.tableNumber.match(/\d+/)?.[0] || '0');
    
    if (sortOrder === 'asc') return numA - numB;
    return numB - numA;
  });

  const getQRUrl = (tableId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/order/${profile?.restaurantId}/${tableId}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'occupied': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'running': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'billed': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Table <span className="text-indigo-600">Architect</span></h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Design your floor plan and manage zones</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
              <button 
                onClick={() => setSortOrder('asc')}
                className={`p-2 rounded-xl transition-all ${sortOrder === 'asc' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <ArrowUpNarrowWide size={16} />
              </button>
              <button 
                onClick={() => setSortOrder('desc')}
                className={`p-2 rounded-xl transition-all ${sortOrder === 'desc' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <ArrowDownWideNarrow size={16} />
              </button>
           </div>

           <button 
             onClick={async () => {
               try {
                  await addTable(activeTab);
                  toast.success(`Table added to ${activeTab}`);
               } catch (e) {
                  toast.error('Add failed');
               }
             }}
             className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-rose-100 flex items-center gap-3 hover:bg-rose-600 transition-all hover:scale-[1.02] active:scale-95"
           >
             <Plus size={18} strokeWidth={3} />
             Add Table in {activeTab}
           </button>
        </div>
      </header>

      {/* Sections Nav */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-[2rem] overflow-x-auto no-scrollbar max-w-fit">
        {sections.map(sec => (
          <button
            key={sec}
            onClick={() => setActiveTab(sec)}
            className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === sec 
                ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100/20' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {sec}
          </button>
        ))}
         <button
            onClick={() => {
               const newSection = prompt("Enter new section name");
               if (newSection && !sections.includes(newSection)) {
                 setSections([...sections, newSection]);
                 setActiveTab(newSection);
               }
            }}
            className="px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-all"
         >
           + Add
         </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <AnimatePresence mode="popLayout">
          {sortedTables.map(table => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={table.id} 
              className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/10 transition-all group relative overflow-hidden"
            >
               {/* Actions Overlay */}
               <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => setEditingTableId(table.id === editingTableId ? null : table.id)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => { if(confirm('Remove this table?')) deleteTable(table.id); }}
                    className="p-2 bg-rose-50 text-rose-400 hover:text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
               </div>

               <div className="flex flex-col items-center gap-6">
                  {editingTableId === table.id ? (
                    <div className="w-full space-y-4">
                       <input 
                         autoFocus
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-center font-black text-xl text-slate-900 outline-none focus:border-indigo-500"
                         defaultValue={table.tableNumber}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                             updateTable(table.id, { tableNumber: e.currentTarget.value });
                             setEditingTableId(null);
                             toast.success('Updated');
                           }
                         }}
                       />
                       <p className="text-[8px] font-black text-slate-400 uppercase text-center">Press Enter to Save</p>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-[2rem] bg-slate-900 border-4 border-white shadow-2xl flex items-center justify-center text-white font-black text-2xl italic relative group/qr">
                       {table.tableNumber}
                       <button 
                         onClick={() => setSelectedTable(table)}
                         className="absolute inset-0 bg-indigo-600/90 text-white rounded-[1.75rem] flex items-center justify-center opacity-0 group-hover/qr:opacity-100 transition-all scale-75 group-hover/qr:scale-100"
                       >
                         <QrCode size={24} />
                       </button>
                    </div>
                  )}
                  
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-center gap-4 text-slate-400">
                       <div className="flex items-center gap-1.5">
                          <Users size={12} />
                          <input 
                            type="number"
                            className="w-12 bg-transparent border-none text-[10px] font-black uppercase tracking-tighter focus:ring-0 p-0 text-center"
                            defaultValue={table.guestCount || 4}
                            onChange={(e) => updateTable(table.id, { guestCount: parseInt(e.target.value) || 4 })}
                          />
                          <span className="text-[10px] font-black uppercase tracking-tighter">Pax</span>
                       </div>
                    </div>

                    <div className={`py-3 px-4 rounded-2xl border text-center flex items-center justify-center gap-2 ${getStatusColor(table.status)}`}>
                       <span className="text-[9px] font-black uppercase tracking-widest">{table.status}</span>
                    </div>
                  </div>
               </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* QR Modal */}
      <AnimatePresence>
        {selectedTable && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.9, y: 20 }}
               className="bg-white rounded-[3.5rem] p-12 max-w-sm w-full relative shadow-2xl"
             >
                <button 
                  onClick={() => setSelectedTable(null)}
                  className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>

                <div className="text-center space-y-8">
                   <div>
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                         <QrCode size={32} />
                      </div>
                      <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Table <span className="text-indigo-600">{selectedTable.tableNumber}</span></h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 italic">Digital Self-Order ID</p>
                   </div>

                   <div className="p-8 bg-white rounded-[3rem] border-2 border-slate-50 inline-block mx-auto shadow-xl shadow-slate-100/50">
                      <QRCode 
                         value={getQRUrl(selectedTable.id)}
                         size={180}
                         style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                         viewBox={`0 0 256 256`}
                      />
                   </div>

                   <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <p className="text-[9px] font-mono font-bold text-slate-400 break-all leading-relaxed">
                            {getQRUrl(selectedTable.id)}
                         </p>
                      </div>
                      <button 
                         onClick={() => window.print()}
                         className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100/20"
                      >
                         <Download size={20} />
                         Print Table Card
                      </button>
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TableManager;
