import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import { useAuthStore } from './stores/useAuthStore';
import { usePrinterStore } from './stores/usePrinterStore';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import MenuScreen from './screens/Menu';
import ActiveOrders from './screens/ActiveOrders';
import Billing from './screens/Billing';
import Admin from './screens/Admin';
import OrderHistory from './screens/OrderHistory';
import Analytics from './screens/Analytics';
import OwnerDashboard from './screens/OwnerDashboard';
import OwnerManagement from './screens/OwnerManagement';
import UserManagement from './screens/UserManagement';
import RestaurantManagement from './screens/RestaurantManagement';
import Settings from './screens/Settings';
import PrinterSettings from './screens/PrinterSettings';
import BillingConfiguration from './screens/BillingConfiguration';
import PendingBills from './screens/PendingBills';
import BillHistory from './screens/BillHistory';
import Expenses from './screens/Expenses';
import DayEnd from './screens/DayEnd';
import EnterpriseManagement from './screens/EnterpriseManagement';
import CancellationReports from './screens/CancellationReports';
import Reservations from './screens/Reservations';
import HybridSyncDashboard from './screens/HybridSyncDashboard';
import KDS from './screens/KDS';
import QRMenu from './screens/QRMenu';
import InventoryDashboard from './screens/InventoryDashboard';
import BranchManagement from './screens/BranchManagement';
import MerchantMobileApp from './screens/MerchantMobileApp';
import AIInsights from './screens/AIInsights';
import FranchiseDashboard from './screens/FranchiseDashboard';
import SystemObservability from './screens/SystemObservability';
import Layout from './components/Layout';
import { RoleGuard } from './components/RoleGuard';
import { Toaster } from 'sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, error, init, setError } = useAuthStore();
  const location = useLocation();
  
  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-sm p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-6">
          <div className="text-rose-500 mx-auto w-16 h-16 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-black uppercase">Unable to connect to server</h2>
          <p className="text-slate-400 text-xs">Please ensure you have an active internet connection and try again.</p>
          <div className="space-y-3">
            <button 
              onClick={() => { setError(null); init(); }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase"
            >
              Retry Connection
            </button>
            <button 
              onClick={() => window.location.href = '/settings'}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-xs uppercase"
            >
              Server Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;

  // Display strict lock screen overlay if the root status is disabled or suspended
  if (profile && (profile.active === false || (profile as any).status === 'DISABLED' || (profile as any).status === 'SUSPENDED')) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -ml-48 -mb-48" />
        
        <div className="w-full max-w-md bg-slate-950 rounded-[2.5rem] border border-slate-800 p-10 text-center relative z-10 shadow-2xl space-y-6">
          <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-rose-950/20 border border-rose-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-white text-xl font-black uppercase tracking-tight">Access Prohibited</h2>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mt-1">Status: Blocked / Suspended</p>
          </div>
          <p className="text-slate-300 font-bold text-sm">
            Your account has been disabled by Super Owner
          </p>
          <div className="pt-4 border-t border-slate-900">
            <button 
              onClick={() => useAuthStore.getState().signOut()}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Sign Out / Re-authenticate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect SUPER_OWNER/OWNER to Owner Dashboard if no restaurant selected, unless they are already going there
  if ((profile?.role === 'SUPER_OWNER' || profile?.role === 'OWNER') && !profile.restaurantId && !location.pathname.startsWith('/owner')) {
    return <Navigate to="/owner/restaurants" />;
  }

  // Also redirect SUPER_OWNER/OWNER from /owner to /owner/restaurants
  if ((profile?.role === 'SUPER_OWNER' || profile?.role === 'OWNER') && location.pathname === '/owner') {
    return <Navigate to="/owner/restaurants" />;
  }

  return <>{children}</>;
}

function App() {
  const { init, profile } = useAuthStore();
  const { init: initPrinter, autoConnect } = usePrinterStore();
  const [showSplash, setShowSplash] = React.useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Wake Lock API to keep screen on (useful for POS/Captain apps)
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            console.log('WakeLock disallowed by permission policy (expected in some browser/iframe environments)');
          } else {
            console.error('WakeLock Error:', err.message);
          }
        }
      }
    };
    
    if (profile?.role === 'captain' || profile?.role === 'admin') {
      requestWakeLock();
      
      // Auto-request fullscreen if possible (requires interaction usually, but let's try or add a hint)
      const enterFullscreen = () => {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      };
      // We'll attach it to a click listener once for the whole app
      document.addEventListener('click', enterFullscreen, { once: true });
    }

    return () => {
      wakeLock?.release().then(() => { wakeLock = null; });
    };
  }, [profile?.role]);

  useEffect(() => {
    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection')).catch(() => {
          // It's expected to fail if the doc doesn't exist, but we check for offline specifically
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or internet connection.");
        }
      }
    };
    testConnection();

    init();
    initPrinter();

    // Set up periodic auto-reconnect check
    const interval = setInterval(() => {
      autoConnect();
    }, 15000);

    return () => clearInterval(interval);
  }, [init, initPrinter, autoConnect]);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6"
            >
              <span className="text-white text-5xl font-black italic">R</span>
            </motion.div>
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white text-2xl font-black italic uppercase tracking-tighter"
            >
              RestoPro <span className="text-indigo-400">Mobile</span>
            </motion.h1>
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="w-32 h-1 bg-indigo-600 rounded-full mt-8 origin-left"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Router>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/kds" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN', 'CAPTAIN']}><KDS /></RoleGuard>} />
        <Route path="/menu/:restaurantId" element={<QRMenu />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="menu" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN', 'CAPTAIN']}><MenuScreen /></RoleGuard>} />
          <Route path="orders" element={<ActiveOrders />} />
          <Route path="history" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><OrderHistory /></RoleGuard>} />
          <Route path="analytics" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><Analytics /></RoleGuard>} />
          <Route path="billing/:orderId" element={<Billing />} />
          <Route path="pending-bills" element={<PendingBills />} />
          <Route path="bill-history" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><BillHistory /></RoleGuard>} />
          <Route path="cancellation-audit" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><CancellationReports /></RoleGuard>} />
          <Route path="expenses" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><Expenses /></RoleGuard>} />
          <Route path="day-end" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><DayEnd /></RoleGuard>} />
          <Route path="reservations" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN', 'CAPTAIN']}><Reservations /></RoleGuard>} />
          <Route path="hybrid-sync" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><HybridSyncDashboard /></RoleGuard>} />
          <Route path="enterprise" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><EnterpriseManagement /></RoleGuard>} />
          <Route path="inventory" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><InventoryDashboard /></RoleGuard>} />
          <Route path="branches" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><BranchManagement /></RoleGuard>} />
          <Route path="merchant-mobile" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><MerchantMobileApp /></RoleGuard>} />
          <Route path="ai-insights" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><AIInsights /></RoleGuard>} />
          <Route path="monitoring" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><SystemObservability /></RoleGuard>} />
          <Route path="franchise" element={<RoleGuard allowedRoles={['SUPER_OWNER']}><FranchiseDashboard /></RoleGuard>} />
          <Route path="owner-management" element={<RoleGuard allowedRoles={['SUPER_OWNER']}><OwnerManagement /></RoleGuard>} />
          <Route path="admin/*" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><Admin /></RoleGuard>} />
          
          <Route path="owner">
            <Route index element={<Navigate to="/owner/restaurants" replace />} />
            <Route path="restaurants" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER']}><RestaurantManagement /></RoleGuard>} />
            <Route path="admins" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER']}><UserManagement roleFilter="admin" /></RoleGuard>} />
            <Route path="captains" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER']}><UserManagement roleFilter="captain" /></RoleGuard>} />
          </Route>

          <Route path="users" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER']}><UserManagement /></RoleGuard>} />
          <Route path="restaurants" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER']}><RestaurantManagement /></RoleGuard>} />
          <Route path="settings" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><Settings /></RoleGuard>} />
          <Route path="printer-settings" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><PrinterSettings /></RoleGuard>} />
          <Route path="billing-config" element={<RoleGuard allowedRoles={['SUPER_OWNER', 'OWNER', 'ADMIN']}><BillingConfiguration /></RoleGuard>} />
        </Route>
      </Routes>
    </Router>
  </>
);
}

export default App;
