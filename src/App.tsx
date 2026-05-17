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
import Layout from './components/Layout';
import { RoleGuard } from './components/RoleGuard';
import { Toaster } from 'sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuthStore();
  const location = useLocation();
  
  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;

  // Redirect owner to Owner Dashboard if no restaurant selected, unless they are already going there
  if (profile?.role === 'owner' && !profile.restaurantId && !location.pathname.startsWith('/owner')) {
    return <Navigate to="/owner/restaurants" />;
  }

  // Also redirect owner from /owner to /owner/restaurants
  if (profile?.role === 'owner' && location.pathname === '/owner') {
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
        <Route path="/kds" element={<RoleGuard allowedRoles={['owner', 'admin', 'captain']}><KDS /></RoleGuard>} />
        <Route path="/menu/:restaurantId" element={<QRMenu />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="menu" element={<RoleGuard allowedRoles={['owner', 'admin', 'captain']}><MenuScreen /></RoleGuard>} />
          <Route path="orders" element={<ActiveOrders />} />
          <Route path="history" element={<RoleGuard allowedRoles={['owner', 'admin']}><OrderHistory /></RoleGuard>} />
          <Route path="analytics" element={<RoleGuard allowedRoles={['owner', 'admin']}><Analytics /></RoleGuard>} />
          <Route path="billing/:orderId" element={<Billing />} />
          <Route path="pending-bills" element={<PendingBills />} />
          <Route path="bill-history" element={<RoleGuard allowedRoles={['owner', 'admin']}><BillHistory /></RoleGuard>} />
          <Route path="cancellation-audit" element={<RoleGuard allowedRoles={['owner', 'admin']}><CancellationReports /></RoleGuard>} />
          <Route path="expenses" element={<RoleGuard allowedRoles={['owner', 'admin']}><Expenses /></RoleGuard>} />
          <Route path="day-end" element={<RoleGuard allowedRoles={['owner', 'admin']}><DayEnd /></RoleGuard>} />
          <Route path="reservations" element={<RoleGuard allowedRoles={['owner', 'admin', 'captain']}><Reservations /></RoleGuard>} />
          <Route path="hybrid-sync" element={<RoleGuard allowedRoles={['owner', 'admin']}><HybridSyncDashboard /></RoleGuard>} />
          <Route path="enterprise" element={<RoleGuard allowedRoles={['owner', 'admin']}><EnterpriseManagement /></RoleGuard>} />
          <Route path="inventory" element={<RoleGuard allowedRoles={['owner', 'admin']}><InventoryDashboard /></RoleGuard>} />
          <Route path="branches" element={<RoleGuard allowedRoles={['owner', 'admin']}><BranchManagement /></RoleGuard>} />
          <Route path="merchant-mobile" element={<RoleGuard allowedRoles={['owner', 'admin']}><MerchantMobileApp /></RoleGuard>} />
          <Route path="ai-insights" element={<RoleGuard allowedRoles={['owner', 'admin']}><AIInsights /></RoleGuard>} />
          <Route path="franchise" element={<RoleGuard allowedRoles={['owner']}><FranchiseDashboard /></RoleGuard>} />
          <Route path="admin/*" element={<RoleGuard allowedRoles={['owner', 'admin']}><Admin /></RoleGuard>} />
          
          <Route path="owner">
            <Route index element={<Navigate to="/owner/restaurants" replace />} />
            <Route path="restaurants" element={<RoleGuard allowedRoles={['owner']}><RestaurantManagement /></RoleGuard>} />
            <Route path="admins" element={<RoleGuard allowedRoles={['owner']}><UserManagement roleFilter="admin" /></RoleGuard>} />
            <Route path="captains" element={<RoleGuard allowedRoles={['owner']}><UserManagement roleFilter="captain" /></RoleGuard>} />
          </Route>

          <Route path="users" element={<RoleGuard allowedRoles={['owner']}><UserManagement /></RoleGuard>} />
          <Route path="restaurants" element={<RoleGuard allowedRoles={['owner']}><RestaurantManagement /></RoleGuard>} />
          <Route path="settings" element={<RoleGuard allowedRoles={['owner', 'admin']}><Settings /></RoleGuard>} />
          <Route path="printer-settings" element={<RoleGuard allowedRoles={['owner', 'admin']}><PrinterSettings /></RoleGuard>} />
          <Route path="billing-config" element={<RoleGuard allowedRoles={['owner', 'admin']}><BillingConfiguration /></RoleGuard>} />
        </Route>
      </Routes>
    </Router>
  </>
);
}

export default App;
