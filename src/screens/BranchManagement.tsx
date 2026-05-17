import React, { useState, useEffect } from 'react';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { 
  Building2, MapPin, Smartphone, ArrowRight, 
  Search, Plus, Map, Activity, Users, MoreHorizontal 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion } from 'motion/react';
import { branchService, Branch } from '../services/branchService';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const BranchManagement = () => {
  const { currentRestaurant } = useRestaurantStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentRestaurant?.id) return;

    const q = query(
      collection(db, 'branches'),
      where('restaurantId', '==', currentRestaurant.id)
    );

    return onSnapshot(q, (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branches');
    });
  }, [currentRestaurant?.id]);

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-indigo-400">CONNECTING BRANCH NODES...</div>;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full">Global Ops</span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">Branch <span className="text-indigo-600">Network</span></h1>
           </div>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Multi-Branch Ecosystem control</p>
        </div>
        <button className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-100">
           <Plus size={16} />
           Provision New Branch
        </button>
      </header>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
            <Map className="absolute top-0 right-0 p-10 opacity-10" size={150} />
            <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.3em] mb-2">Active Locations</p>
            <h3 className="text-6xl font-black italic tracking-tighter">{branches.length}</h3>
            <div className="mt-10 flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-widest">
               <Activity size={12} />
               All Nodes Stable
            </div>
         </div>

         <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm col-span-2">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Growth Performance</h3>
               <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">+14.2% Growth</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4">
               {['Revenue', 'Orders', 'Avg Ticket', 'Wait Time'].map((label, i) => (
                 <div key={i} className="flex-1 min-w-[140px] bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">{label}</p>
                    <p className="text-xl font-black italic text-slate-900 tracking-tighter">Branch {i+1}</p>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Branch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         {branches.map((branch, i) => (
           <motion.div 
             key={branch.id}
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: i * 0.1 }}
             className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm p-10 group hover:shadow-2xl hover:shadow-slate-100 transition-all cursor-pointer"
           >
              <div className="flex justify-between items-start mb-8">
                 <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                    <Building2 size={24} />
                 </div>
                 <button className="p-3 text-slate-300 hover:text-slate-600"><MoreHorizontal size={24}/></button>
              </div>

              <div className="space-y-1 mb-10">
                 <div className="flex items-center gap-2">
                    <h4 className="text-xl font-black text-slate-900 tracking-tighter italic uppercase">{branch.branchName}</h4>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={10} /> {branch.city} Branch • {branch.branchCode}
                 </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                 <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Captains</p>
                    <p className="text-lg font-black text-slate-900 italic flex items-center gap-2">
                       <Users size={14} className="text-indigo-400" /> 12
                    </p>
                 </div>
                 <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminals</p>
                    <p className="text-lg font-black text-slate-900 italic flex items-center gap-2">
                       <Smartphone size={14} className="text-indigo-400" /> 3
                    </p>
                 </div>
              </div>

              <button className="w-full h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center justify-center gap-3">
                 Access Switch Center
                 <ArrowRight size={16} />
              </button>
           </motion.div>
         ))}

         {/* Placeholder for adding */}
         <div className="bg-slate-50/50 rounded-[3.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-10 min-h-[400px]">
             <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center text-slate-300 mb-6">
                <Plus size={32} />
             </div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center max-w-[150px]">Scale Your Enterprise Brand</p>
         </div>
      </div>
    </div>
  );
};

export default BranchManagement;
