import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useRestaurantStore } from '../stores/useRestaurantStore';
import { useMenuStore } from '../stores/useMenuStore';
import { useTableStore } from '../stores/useTableStore';
import { Navigate, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Utensils, 
  Table as TableIcon, 
  Settings as SettingsIcon,
  ChevronRight,
  LogOut,
  ShoppingBag,
  IndianRupee,
  BarChart3,
  Printer,
  ShieldCheck,
  XOctagon,
  Building2
} from 'lucide-react';

// Tabs
import DashboardTab from '../components/admin/Dashboard';
import RestaurantProfile from '../components/admin/RestaurantProfile';
import StaffManagement from '../components/admin/StaffManagement';
import MenuManager from '../components/admin/MenuManager';
import TableManager from '../components/admin/TableManager';
import SettingsTab from '../components/admin/Settings';
import OrdersTab from '../components/admin/OrdersTab';
import TaxationTab from '../components/admin/TaxationTab';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import PermissionsTab from '../components/admin/PermissionsTab';
import CancellationReports from './CancellationReports';
import BranchesTab from '../components/admin/BranchesTab';

const Admin = () => {
  const { profile, loading: authLoading, signOut } = useAuthStore();
  const { currentRestaurant, subscribeToRestaurant, loading: resLoading } = useRestaurantStore();
  const { subscribe: subscribeMenu } = useMenuStore();
  const { subscribe: subscribeTables } = useTableStore();
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('Admin Panel Debug:', {
      uid: profile?.uid,
      role: profile?.role,
      restaurantId: profile?.restaurantId
    });

    if (!profile?.restaurantId) {
      const timeout = setTimeout(() => {
        if (resLoading) {
          console.warn('Timeout reached for restaurant subscription');
          useRestaurantStore.setState({ loading: false });
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }

    const unsubRes = subscribeToRestaurant(profile.restaurantId);
    const unsubMenu = subscribeMenu();
    const unsubTables = subscribeTables();

    // Safety timeout to ensure loading state doesn't get stuck
    const timeout = setTimeout(() => {
      if (resLoading) {
        console.warn('Admin Panel: Loading state forced to false after timeout');
        useRestaurantStore.setState({ loading: false });
        useMenuStore.setState({ loading: false });
        useTableStore.setState({ loading: false });
      }
    }, 8000);

    return () => {
      unsubRes();
      unsubMenu();
      unsubTables();
      clearTimeout(timeout);
    };
  }, [profile?.restaurantId]);

  if (authLoading || (resLoading && profile?.restaurantId)) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Initializing Management Console...</p>
      </div>
    </div>
  );

  if (!profile || !['admin', 'owner', 'ADMIN', 'OWNER', 'SUPER_OWNER'].includes(profile.role)) {
    console.warn('Admin: Access denied - invalid role or no profile', profile?.role);
    return <Navigate to="/" />;
  }

  if (!currentRestaurant && !resLoading) {
    const isAnyOwner = ['owner', 'OWNER', 'SUPER_OWNER'].includes(profile?.role || '');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-2xl text-center max-w-sm">
           <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
             <Store size={40} />
           </div>
           <h2 className="text-2xl font-black text-slate-800 uppercase mb-4">No Restaurant Found</h2>
           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-loose mb-8">
             Your account is not associated with an active restaurant workspace.
           </p>
           <button 
             onClick={() => navigate(isAnyOwner ? '/owner' : '/')}
             className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest"
           >
             {isAnyOwner ? 'Back to Enterprise Dashboard' : 'Return Home'}
           </button>
        </div>
      </div>
    );
  }

  const isOwner = profile && ['owner', 'OWNER', 'SUPER_OWNER', 'super_owner'].includes(profile.role);
  const tabs = [
    { id: '', label: 'Dashboard', icon: LayoutDashboard },
    ...(isOwner ? [{ id: 'branches', label: 'Branch Operations', icon: Building2 }] : []),
    { id: 'restaurant', label: 'Restaurant Profile', icon: Store },
    { id: 'captains', label: 'Captain Management', icon: Users },
    { id: 'menu', label: 'Menu Management', icon: Utensils },
    { id: 'tables', label: 'Table Management', icon: TableIcon },
    { id: 'taxes', label: 'Billing & GST', icon: IndianRupee },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'printer', label: 'Printer Settings', icon: Printer },
    { id: 'permissions', label: 'Captain Permissions', icon: ShieldCheck },
    { id: 'cancellation', label: 'Cancellation Audit', icon: XOctagon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const currentTab = location.pathname.split('/').pop() || '';
  const activeTabId = tabs.find(t => t.id === currentTab)?.id || '';

  return (
    <div className="min-h-screen">
      {/* Main Content Area */}
      <main className="flex-1">
        <div className="md:p-2 lg:p-0 max-w-[1600px] mx-auto">
           {/* Tab Title Desktop */}
           <div className="hidden lg:block mb-8">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight group flex items-center gap-4 italic">
                {tabs.find(t => t.id === activeTabId)?.label || 'Dashboard'}
                <div className="h-0.5 w-12 bg-indigo-500 group-hover:w-20 transition-all duration-500 rounded-full" />
              </h2>
           </div>

           <div className="min-h-[70vh]">
              <Routes>
                <Route index element={<DashboardTab />} />
                 {isOwner && <Route path="branches" element={<BranchesTab />} />}
                <Route path="restaurant" element={<RestaurantProfile restaurant={currentRestaurant} />} />
                <Route path="captains" element={<StaffManagement />} />
                <Route path="menu" element={<MenuManager />} />
                <Route path="tables" element={<TableManager />} />
                <Route path="taxes" element={<TaxationTab restaurant={currentRestaurant} />} />
                <Route path="orders" element={<OrdersTab />} />
                <Route path="analytics" element={<AnalyticsTab />} />
                <Route path="printer" element={<SettingsTab restaurant={currentRestaurant} initialSubTab="printer" />} />
                <Route path="permissions" element={<PermissionsTab />} />
                <Route path="cancellation" element={<CancellationReports />} />
                <Route path="settings" element={<SettingsTab restaurant={currentRestaurant} />} />
              </Routes>
           </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;


