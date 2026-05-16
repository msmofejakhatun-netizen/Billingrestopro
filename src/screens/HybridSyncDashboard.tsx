import React, { useState, useEffect } from 'react';
import { dbLocal, LocalOrder } from '../lib/db';
import { syncService } from '../services/syncService';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  Database, RefreshCcw, Wifi, WifiOff, Cloud, 
  CheckCircle2, AlertCircle, HardDrive, Network, 
  Server, Smartphone, Zap, Monitor
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

const HybridSyncDashboard = () => {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    pending: 0,
    failed: 0
  });
  const [pendingOrders, setPendingOrders] = useState<LocalOrder[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    
    const interval = setInterval(fetchStats, 5000);
    fetchStats();

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      clearInterval(interval);
    };
  }, []);

  const fetchStats = async () => {
    const all = await dbLocal.orders.toArray();
    const pending = all.filter(o => o.synced === 0);
    const failed = pending.filter(o => !!o.syncError);
    
    setStats({
      total: all.length,
      synced: all.length - pending.length,
      pending: pending.length,
      failed: failed.length
    });
    setPendingOrders(pending);
  };

  const triggerManualSync = () => {
    syncService.syncPendingItems();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Hybrid System Center</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Local Server + Cloud Sync Manager</p>
        </div>
        <button 
          onClick={triggerManualSync}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:ring-4 hover:ring-indigo-100 transition-all"
        >
          <RefreshCcw size={18} /> Force Sync
        </button>
      </header>

      {/* Connectivity Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-[2.5rem] border-2 flex items-center gap-4 ${isOnline ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isOnline ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
             {isOnline ? <Wifi size={24} /> : <WifiOff size={24} />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Network Status</p>
            <p className={`text-sm font-black uppercase ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isOnline ? 'Cloud Connection Active' : 'Offline Mode (Local Only)'}
            </p>
          </div>
        </div>

        <div className="p-6 rounded-[2.5rem] border-2 bg-indigo-50 border-indigo-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
             <Server size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Local Node</p>
            <p className="text-sm font-black uppercase text-indigo-600">POS Server Connected</p>
          </div>
        </div>

        <div className="p-6 rounded-[2.5rem] border-2 bg-amber-50 border-amber-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
             <Zap size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Realtime Engine</p>
            <p className="text-sm font-black uppercase text-amber-600 tracking-tight">Active (Socket.IO)</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
           <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
             <Cloud className="text-indigo-600" /> Cloud Sync Queue
           </h3>
           <div className="flex gap-2">
             <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-600">{stats.synced} Synced</div>
             <div className="px-4 py-1.5 bg-indigo-100 rounded-full text-[10px] font-black text-indigo-600">{stats.pending} Pending</div>
           </div>
        </div>

        <div className="p-4">
           {pendingOrders.length === 0 ? (
             <div className="py-20 text-center space-y-4">
                <CheckCircle2 size={48} className="mx-auto text-emerald-300" />
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">All local data is synchronized</p>
             </div>
           ) : (
             <div className="divide-y divide-slate-50">
               {pendingOrders.map(order => (
                 <div key={order.localId} className="py-4 px-4 flex items-center justify-between hover:bg-slate-50 rounded-2xl transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                         <HardDrive size={18} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 uppercase text-xs">Table {order.tableNumber} - ₹{order.total}</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase">{order.id} • {format(order.timestamp, 'HH:mm:ss')}</p>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                      {order.syncError ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-100">
                          <AlertCircle size={10} /> Sync Error
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100">
                          <RefreshCcw size={10} className="animate-spin" /> Retrying...
                        </div>
                      )}
                      <button className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-400 transition-all">
                        <Zap size={16} />
                      </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* Local Server Instructions */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10">
           <Smartphone size={160} />
        </div>
        <div className="relative z-10 space-y-6">
           <div className="flex items-center gap-3">
              <div className="bg-indigo-500 p-2 rounded-xl">
                 <Monitor size={20} />
              </div>
              <h4 className="font-black uppercase tracking-widest text-sm">Server Mode: Billing Desktop</h4>
           </div>
           
           <h3 className="text-3xl font-black tracking-tight max-w-md">Connect your Captain devices to this terminal</h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                 <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">Step 1: Network</p>
                 <p className="text-slate-300 text-xs font-bold leading-relaxed">Ensure all Captain tablets and Billing PC are on same 5GHz WiFi network.</p>
              </div>
              <div className="space-y-2">
                 <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">Step 2: Access</p>
                 <p className="text-slate-300 text-xs font-bold leading-relaxed">Open this URL on Captain device: <code className="bg-slate-800 px-3 py-1 rounded-md text-emerald-400 font-mono text-[10px]">{window.location.origin}</code></p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default HybridSyncDashboard;
