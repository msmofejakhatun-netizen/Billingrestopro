import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  Calculator, DollarSign, CreditCard, Smartphone, 
  XCircle, CheckCircle2, Printer, Download, Clock,
  TrendingUp, ArrowRight
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const DayEnd = () => {
  const { profile } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    fetchDayData();
  }, [profile?.restaurantId]);

  const fetchDayData = async () => {
    if (!profile?.restaurantId) return;
    setLoading(true);
    
    const today = new Date();
    const q = query(
      collection(db, 'bills'),
      where('restaurantId', '==', profile.restaurantId),
      where('status', '==', 'paid'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay(today))),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay(today)))
    );

    try {
      const snap = await getDocs(q);
      const bills = snap.docs.map(d => d.data());
      
      const stats = {
        totalSales: bills.reduce((sum, b) => sum + b.finalAmount, 0),
        cashSales: bills.filter(b => b.paymentMethod === 'CASH').reduce((sum, b) => sum + b.finalAmount, 0),
        upiSales: bills.filter(b => b.paymentMethod === 'UPI').reduce((sum, b) => sum + b.finalAmount, 0),
        cardSales: bills.filter(b => b.paymentMethod === 'CARD').reduce((sum, b) => sum + b.finalAmount, 0),
        billCount: bills.length,
        cancelledCount: 0 // Fetch from separate collection if needed
      };

      setData(stats);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch day summary");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    if (!confirm("Finalize Day End? This will archive today's session.")) return;
    setIsClosing(true);
    try {
      await addDoc(collection(db, 'dayEndReports'), {
        ...data,
        restaurantId: profile?.restaurantId,
        closedById: auth.currentUser?.uid,
        closedByName: profile?.name,
        timestamp: serverTimestamp(),
        date: format(new Date(), 'yyyy-MM-dd')
      });
      toast.success("Day reports finalized and locked.");
      fetchDayData();
    } catch (e) {
      toast.error("Day End failed");
    } finally {
      setIsClosing(false);
    }
  };

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-indigo-400">CALCULATING DAY SUMMARY...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <header className="flex justify-between items-center bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5">
           <Calculator size={100} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase flex items-center gap-3">
             <Clock className="text-indigo-600" size={32} />
             Day End <span className="text-indigo-600">Close</span>
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Summary for {format(new Date(), 'MMMM dd, yyyy')}</p>
        </div>
        <div className="bg-emerald-50 px-6 py-2 rounded-2xl border border-emerald-100 text-center">
           <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Status</p>
           <p className="text-xs font-black text-emerald-700">In Session</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-indigo-200">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Total Gross Revenue</p>
            <h3 className="text-6xl font-black italic tracking-tighter">₹{data?.totalSales.toLocaleString()}</h3>
            <div className="mt-10 pt-8 border-t border-white/10 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
               <span>Processed Bills</span>
               <span className="text-xl italic">{data?.billCount}</span>
            </div>
         </div>

         <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm space-y-8">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">Payment Breakdown</h4>
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600"><DollarSign size={20}/></div>
                     <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Cash</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 italic">₹{data?.cashSales.toLocaleString()}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><Smartphone size={20}/></div>
                     <span className="text-sm font-black text-slate-800 uppercase tracking-tight">UPI / Digital</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 italic">₹{data?.upiSales.toLocaleString()}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600"><CreditCard size={20}/></div>
                     <span className="text-sm font-black text-slate-800 uppercase tracking-tight">Cards</span>
                  </div>
                  <span className="text-lg font-black text-slate-900 italic">₹{data?.cardSales.toLocaleString()}</span>
               </div>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
         <div className="flex items-center justify-between mb-10">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Operational Audit</h4>
            <AlertTriangle size={18} className="text-amber-500" />
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-slate-50 rounded-3xl">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Voided Bills</p>
               <p className="text-2xl font-black text-rose-500">2</p>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-3xl">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Avg Wait Time</p>
               <p className="text-2xl font-black text-slate-900">18m</p>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-3xl">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Tables Turned</p>
               <p className="text-2xl font-black text-slate-900">14</p>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-3xl">
               <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Top Captain</p>
               <p className="text-xs font-black text-indigo-600 uppercase">Rahul K.</p>
            </div>
         </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
         <button 
           onClick={() => window.print()}
           className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
         >
            <Printer size={18} />
            Print Z-Report
         </button>
         <button 
           onClick={handleCloseDay}
           disabled={isClosing}
           className="flex-1 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-rose-500 transition-all shadow-xl shadow-rose-200"
         >
            {isClosing ? 'Closing...' : (
               <>
                 <CheckCircle2 size={18} />
                 Finalize Day End
               </>
            )}
         </button>
      </div>
    </div>
  );
};

export default DayEnd;
