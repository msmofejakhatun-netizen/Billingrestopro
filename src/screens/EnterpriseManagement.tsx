import React, { useState, useEffect } from 'react';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { useAuthStore } from '../stores/useAuthStore';
import { 
  Shield, CreditCard, Smartphone, CheckCircle, 
  AlertTriangle, Zap, Server, Globe, Lock,
  Users, Printer, Search, MoreVertical, Trash2, Power
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const EnterpriseManagement = () => {
  const { currentRestaurant } = useRestaurantStore();
  const { profile } = useAuthStore();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentRestaurant?.id) return;

    const q = query(
      collection(db, 'authorizedDevices'),
      where('restaurantId', '==', currentRestaurant.id)
    );

    return onSnapshot(q, (snapshot) => {
      setDevices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
  }, [currentRestaurant?.id]);

  const toggleDevice = async (deviceId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'authorizedDevices', deviceId), { status: newStatus });
      toast.success(`Device ${newStatus === 'active' ? 'Authorized' : 'Suspended'}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const deleteDevice = async (deviceId: string) => {
    if (!confirm("Are you sure? This device will be logged out instantly.")) return;
    try {
      await deleteDoc(doc(db, 'authorizedDevices', deviceId));
      toast.success("Device removed");
    } catch (e) {
      toast.error("Failed to remove device");
    }
  };

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-indigo-400">LOADING ENTERPRISE HUB...</div>;

  return (
    <div className="space-y-10 pb-20 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-600 text-white text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full">Enterprise</span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">Security & <span className="text-indigo-600">Assets</span></h1>
           </div>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Manage Device Licensing & Ecosystem</p>
        </div>
      </header>

      {/* Subscription & Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
               <Shield className="text-indigo-600" size={18} />
               Subscription Pulse
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Plan Status</p>
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600">
                        <Zap size={24} />
                     </div>
                     <div>
                        <p className="text-lg font-black text-slate-900 uppercase italic">Enterprise Pro</p>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                           <CheckCircle size={10} /> Active Renewal: 14 June 2026
                        </p>
                     </div>
                  </div>
               </div>

               <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">License Key</p>
                  <div className="flex items-center justify-between gap-4">
                     <p className="bg-white px-4 py-2 rounded-xl text-xs font-mono font-black text-indigo-600 tracking-widest border border-slate-200">
                        {currentRestaurant?.licenseKey || 'RP-FREE-TRIAL-881'}
                     </p>
                     <button className="text-[9px] font-black uppercase text-indigo-600 hover:underline">Copy</button>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-8">
               {[
                 { label: 'Captain Slots', used: devices.length, total: currentRestaurant?.captainLimit || 10, icon: Users },
                 { label: 'Cloud Sync', used: '100%', total: 'Unlimited', icon: Globe },
                 { label: 'PC Terminals', used: 1, total: currentRestaurant?.deviceLimit || 2, icon: Server }
               ].map((stat, i) => (
                 <div key={i} className="space-y-3">
                    <div className="flex items-center justify-between">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{stat.label}</p>
                       <stat.icon size={12} className="text-slate-300" />
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-indigo-600" 
                         style={{ width: typeof stat.used === 'number' ? `${(stat.used/stat.total)*100}%` : '100%' }} 
                       />
                    </div>
                    <p className="text-[10px] font-black text-slate-700 italic">{stat.used} / {stat.total}</p>
                 </div>
               ))}
            </div>
         </div>

         <div className="bg-slate-900 text-white rounded-[3rem] p-10 flex flex-col justify-between">
            <div>
               <CreditCard className="text-indigo-400 mb-6" size={32} />
               <h3 className="text-xl font-black italic tracking-tighter uppercase mb-2">Billing Center</h3>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-loose">Manage your enterprise subscription and billing invoices.</p>
            </div>
            
            <div className="space-y-4 mt-10">
               <div className="flex justify-between items-center py-4 border-b border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Cost</span>
                  <span className="text-xl font-black italic">₹4,999</span>
               </div>
               <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                  Go Pro Support
               </button>
            </div>
         </div>
      </div>

      {/* Device Management */}
      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
            <div>
               <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1 flex items-center gap-3">
                  <Smartphone className="text-indigo-600" size={18} />
                  Authorized Devices
               </h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Only authorized terminals can process billing</p>
            </div>
            <button className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100">
               <Search size={20} />
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                     <th className="px-10 py-5">Device Identity</th>
                     <th className="px-10 py-5">Last Activity</th>
                     <th className="px-10 py-5">Status</th>
                     <th className="px-10 py-5">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {devices.map((device) => (
                    <tr key={device.id} className="hover:bg-slate-50/30 transition-colors">
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${device.status === 'active' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Smartphone size={24} />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{device.deviceId}</p>
                                <p className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">{device.metadata?.userAgent.split(' ')[0]}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-10 py-6">
                          <p className="text-xs font-black text-slate-600">{device.lastUsedAt?.toDate() ? device.lastUsedAt.toDate().toLocaleString() : 'N/A'}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Global IP: 42.106.XX.XX</p>
                       </td>
                       <td className="px-10 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            device.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {device.status}
                          </span>
                       </td>
                       <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                             <button 
                               onClick={() => toggleDevice(device.id, device.status)}
                               className={`p-3 rounded-xl transition-all ${device.status === 'active' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                               title={device.status === 'active' ? 'Revoke Access' : 'Authorize Device'}
                             >
                                <Power size={18} />
                             </button>
                             <button 
                               onClick={() => deleteDevice(device.id)}
                               className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                             >
                                <Trash2 size={18} />
                             </button>
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

export default EnterpriseManagement;
