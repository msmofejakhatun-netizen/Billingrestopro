import React, { useState, useEffect } from 'react';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { 
  Sparkles, TrendingUp, Cpu, PieChart, 
  Target, Zap, Lightbulb, ArrowRight,
  ChevronRight, Calendar, BrainCircuit
} from 'lucide-react';
import { motion } from 'motion/react';

const AIInsights = () => {
  const { currentRestaurant } = useRestaurantStore();

  return (
    <div className="space-y-12 pb-20 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                 <BrainCircuit size={24} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">Neural <span className="text-indigo-600">Analytics</span></h1>
           </div>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Enterprise Artificial Intelligence Engine</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
           <Zap size={14} className="text-indigo-600" />
           <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Core Status: Hyper-Learning</span>
        </div>
      </header>

      {/* Hero Prediction */}
      <div className="bg-slate-900 rounded-[3.5rem] p-12 text-white relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-10">
            <Sparkles size={200} />
         </div>
         <div className="max-w-xl relative z-10">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
               <Lightbulb size={12} />
               Smart Forecasting
            </p>
            <h3 className="text-4xl font-black italic tracking-tighter mb-8 leading-tight">
               Expect a <span className="text-indigo-400">22% surge</span> in Chicken Tikka orders this weekend between 7:00 PM and 9:00 PM.
            </h3>
            <div className="flex gap-4">
               <button className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3">
                  Adjust Stock Plan
                  <ArrowRight size={14} />
               </button>
               <button className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 transition-all">
                  Dismiss
               </button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <TrendingUp size={32} className="text-indigo-600 mb-8" />
            <h4 className="text-xl font-black italic tracking-tighter uppercase mb-4 text-slate-900">Profit Maxima</h4>
            <ul className="space-y-4">
               {[
                 'Menu Price Optimization: +8% possible',
                 'Suggested Bundle: Burger + Classic Fries',
                 'Labor efficiency: -2 captains needed on Tue'
               ].map((tip, i) => (
                 <li key={i} className="flex gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-relaxed">
                    <ChevronRight size={18} className="text-indigo-600 shrink-0" />
                    {tip}
                 </li>
               ))}
            </ul>
         </div>

         <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <Target size={32} className="text-emerald-600 mb-8" />
            <h4 className="text-xl font-black italic tracking-tighter uppercase mb-4 text-slate-900">Guest Behavior</h4>
            <ul className="space-y-4">
               {[
                 'Churn risk: 14 regular guests inactive',
                 'New segments: Early morning coffee seekers',
                 'Loyalty effect: 34% higher ticket size'
               ].map((tip, i) => (
                 <li key={i} className="flex gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-relaxed">
                    <ChevronRight size={18} className="text-emerald-600 shrink-0" />
                    {tip}
                 </li>
               ))}
            </ul>
         </div>

         <div className="bg-indigo-600 rounded-[3rem] p-10 text-white flex flex-col justify-between">
            <PieChart size={32} className="text-indigo-200 mb-8" />
            <div>
               <h4 className="text-xl font-black italic tracking-tighter uppercase mb-2">Branch Synergy</h4>
               <p className="text-[10px] font-bold text-indigo-200 opacity-60 uppercase tracking-widest mb-6">Cross-Branch Analytics</p>
               <button className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  Open Master Report
               </button>
            </div>
         </div>
      </div>

      {/* Training Monitor */}
      <div className="bg-slate-50 p-10 rounded-[3.5rem] border border-slate-100 flex flex-col md:flex-row items-center gap-10">
         <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-indigo-600">
            <Cpu size={48} />
         </div>
         <div className="flex-1 text-center md:text-left">
            <h3 className="text-xs font-black uppercase tracking-widest mb-2">Engine Training Status</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-loose mb-6">Learning from 14,204 transactions across 3 branches. Confidence score increased by 4% this week.</p>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
               <div className="w-4/5 h-full bg-indigo-600" />
            </div>
         </div>
         <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
            Update Logic
         </button>
      </div>
    </div>
  );
};

export default AIInsights;
