import React, { useState, useEffect } from 'react';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { 
  Crown, Globe, TrendingUp, Users, 
  MapPin, ShieldCheck, Briefcase, ChevronRight,
  ArrowRight, Search, Activity, LayoutDashboard 
} from 'lucide-react';
import { motion } from 'motion/react';

const FranchiseDashboard = () => {
  const { currentRestaurant } = useRestaurantStore();

  return (
    <div className="space-y-12 pb-20 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-amber-100">
                 <Crown size={24} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">Franchise <span className="text-amber-500">Master</span></h1>
           </div>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Enterprise Brand Command Center</p>
        </div>
        <div className="flex gap-3">
           <button className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all">
              <Globe size={14} className="text-amber-500" />
              Region Map
           </button>
           <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
              <ShieldCheck size={14} />
              Protocol Settings
           </button>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: 'Total Franchisees', value: '42', icon: Briefcase, color: 'indigo' },
           { label: 'Annual Royalty', value: '₹1.2Cr', icon: TrendingUp, color: 'emerald' },
           { label: 'Global Guests', value: '142K', icon: Users, color: 'amber' },
           { label: 'Market Cap', value: '₹4.5Cr', icon: Activity, color: 'indigo' }
         ].map((stat, i) => (
           <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className={`w-10 h-10 bg-${stat.color}-50 text-${stat.color}-500 rounded-xl flex items-center justify-center mb-6`}>
                 <stat.icon size={20} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 italic tracking-tighter">{stat.value}</p>
           </div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Franchise List */}
         <div className="lg:col-span-2 bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
               <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Active Franchise Partners</h3>
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search partners..." className="bg-slate-50 border border-slate-100 px-10 py-2 rounded-xl text-[10px] font-bold outline-none"/>
               </div>
            </div>
            <div className="divide-y divide-slate-50">
               {[
                 { name: 'North India Ventures', owner: 'Vikram Singh', locations: 12, rev: '₹42L' },
                 { name: 'Southern Flavors Co', owner: 'Ananya Rao', locations: 8, rev: '₹34L' },
                 { name: 'Western Grub Hub', owner: 'Priyesh Shah', locations: 15, rev: '₹62L' }
               ].map((partner, i) => (
                 <div key={i} className="px-10 py-8 flex items-center justify-between group hover:bg-slate-50/50 transition-all cursor-pointer">
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                          <LayoutDashboard size={24} />
                       </div>
                       <div>
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{partner.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{partner.owner}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-12">
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Outlets</p>
                          <p className="text-lg font-black text-slate-900 italic">{partner.locations}</p>
                       </div>
                       <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Rev (MTD)</p>
                          <p className="text-lg font-black text-emerald-600 italic">{partner.rev}</p>
                       </div>
                       <button className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all">
                          <ChevronRight size={20} />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
            <button className="w-full py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all">
               View All 42 Partners
            </button>
         </div>

         {/* Distribution & Royalty */}
         <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white flex flex-col justify-between">
            <header className="mb-12">
               <h3 className="text-xl font-black italic tracking-tighter uppercase mb-2">Royalty Stream</h3>
               <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-loose">Automated settlement tracking from all franchises.</p>
            </header>

            <div className="space-y-6">
               <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="flex justify-between items-center mb-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collected</span>
                     <span className="text-xl font-black italic">₹84.2L</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                     <div className="w-[84%] h-full bg-amber-500" />
                  </div>
               </div>

               <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending</span>
                     <span className="text-xl font-black italic text-amber-500">₹12.5L</span>
                  </div>
               </div>
            </div>

            <button className="w-full h-16 bg-amber-500 hover:bg-amber-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all mt-10">
               Generate Global Invoices
            </button>
         </div>
      </div>
    </div>
  );
};

export default FranchiseDashboard;
