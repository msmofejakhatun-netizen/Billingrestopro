import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Menu, Building2, Utensils, ChevronDown, User, LogOut, Store } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { useConfigStore } from '../stores/useConfigStore';
import { syncService } from '../services/syncService';
import { socketService } from '../services/socketService';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, Cloud, CloudCheck, Printer, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { printerService } from '../services/printerService';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

import { EnterpriseHealthMonitor } from './EnterpriseHealthMonitor';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, subscribeProfile, setRestaurant } = useAuthStore();
  const { restaurants, subscribe: subscribeRestaurants, currentRestaurant } = useRestaurantStore();
  const { config } = useConfigStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const unsubProfile = subscribeProfile();
    const unsubRestaurants = profile?.role === 'owner' ? subscribeRestaurants() : () => {};
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubProfile();
      unsubRestaurants();
    };
  }, [subscribeProfile, subscribeRestaurants, profile?.role]);

   useEffect(() => {
    let unsubPrint: (() => void) | undefined;

    if (profile?.restaurantId) {
       syncService.startSync();
       socketService.connect(profile.restaurantId);

       // Listen for new orders and play sound
       socketService.onOrderReceived((data) => {
         if (profile.role === 'captain' || profile.role === 'admin') {
           const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
           audio.play().catch(e => console.log('Audio play failed', e));
           toast.info(`New Order: Table ${data.order?.tableNumber || '?'}`);
         }
       });

       // CENTRAL PRINTER SERVER LOGIC
       if (profile.role === 'admin' || profile.role === 'owner') {
          const q = query(
            collection(db, 'printQueue'), 
            where('restaurantId', '==', profile.restaurantId),
            where('status', '==', 'pending')
          );

          unsubPrint = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                const task = { id: change.doc.id, ...change.doc.data() } as any;
                
                try {
                   // Mark as processing immediately to prevent duplicate prints
                   await updateDoc(doc(db, 'printQueue', task.id), { status: 'processing' });
                   
                   console.log("CENTRAL PRINTER: Processing", task.type, "for Table", task.tableNumber);
                   
                   // In a real desktop environment, we connect to printer
                   await printerService.connect();
                   
                   // Encode and Print (using existing logic)
                   const encoded = printerService.encodeReceipt(task, config || {});
                   await printerService.print(encoded);

                   await updateDoc(doc(db, 'printQueue', task.id), { status: 'completed' });
                   
                   toast.success(`${task.type} Printed`, {
                     description: `Table ${task.tableNumber} - Success`
                   });
                } catch (error) {
                   console.error("Print Error:", error);
                   await updateDoc(doc(db, 'printQueue', task.id), { status: 'failed' });
                }
              }
            });
          });
       }

       socketService.onProcessPrint((data) => {
         if (profile.role === 'admin' || profile.role === 'owner') {
            console.log("SOCKET: Immediate print request received", data.type);
            // The Firestore listener is the primary and more robust way, 
            // but we could also trigger local print here if they share the same LAN.
         }
       });
    }
    return () => {
       syncService.stopSync();
       if (unsubPrint) unsubPrint();
    };
  }, [profile?.restaurantId, config]);

  const handleSwitchRestaurant = async (id: string) => {
    await setRestaurant(id);
    setIsSwitching(false);
  };

  const handleLeaveRestaurant = async () => {
    await setRestaurant('');
    navigate('/owner');
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:pl-[260px]">
        <EnterpriseHealthMonitor />
        {/* Mobile Navbar */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <Store size={18} />
              </div>
              <h1 className="text-sm font-black text-slate-800 uppercase tracking-tighter">POS System</h1>
            </div>
          </div>

          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
            {profile?.name?.charAt(0)}
          </div>
        </header>

        {/* Global Dashboard Header & Switcher (Visible on both) */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30 hidden lg:flex h-20">
           <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {currentRestaurant?.restaurantName || 'Master Dashboard'}
              </h2>
              {profile?.role === 'owner' && restaurants.length > 1 && (
                <div className="relative">
                  <button 
                    onClick={() => setIsSwitching(!isSwitching)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Switch</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isSwitching ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isSwitching && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50"
                      >
                         <div className="max-h-60 overflow-y-auto space-y-1">
                            {restaurants.map(r => (
                              <button
                                key={r.id}
                                onClick={() => handleSwitchRestaurant(r.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition ${
                                  profile.restaurantId === r.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'
                                }`}
                              >
                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{r.restaurantName}</p>
                                <p className="text-[9px] font-mono text-slate-400 uppercase">{r.restaurantCode}</p>
                              </button>
                            ))}
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
           </div>

           <div className="flex items-center gap-4">
              {/* Connection Status Indicators */}
              <div className="flex items-center gap-2 mr-4">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {isOnline ? 'Online' : 'Local Mode'}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest">
                  <CloudCheck size={10} />
                  POS Synced
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 flex items-center gap-3">
                 <div className='text-right'>
                    <p className="text-[10px] font-black text-slate-900 uppercase">{profile?.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{profile?.role}</p>
                 </div>
                 <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
                    {profile?.name?.charAt(0)}
                 </div>
              </div>
           </div>
        </div>

        {/* Main Content Area */}
        <main className={`flex-1 p-4 md:p-8 max-w-full lg:max-w-[1600px] w-full mx-auto ${profile?.role === 'captain' ? 'pb-24' : ''}`}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
};

export default Layout;
