import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Utensils, 
  Table as TableIcon, 
  Settings as SettingsIcon,
  ShoppingBag,
  IndianRupee,
  BarChart3,
  Printer,
  ShieldCheck,
  X,
  Building2,
  Box,
  BrainCircuit,
  Crown,
  LogOut,
  Receipt,
  History,
  Wallet,
  Clock,
  XOctagon,
  Cloud,
  Activity
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const { profile, signOut, loading } = useAuthStore();

  const role = profile?.role || null;
  const permissions = profile?.permissions || {};
  const roleUpper = (profile?.role || '').toUpperCase();

  const menuItems = [
    // Standard required menus
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'SUPER_ADMIN'] },
    { path: '/', icon: Utensils, label: 'Dining', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'CAPTAIN', 'CASHIER', 'SUPER_ADMIN'] },
    { path: '/orders', icon: ShoppingBag, label: 'Running Orders', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'CAPTAIN', 'CASHIER', 'SUPER_ADMIN'] },
    { path: '/pending-bills', icon: Receipt, label: 'Pending Bills', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'CAPTAIN', 'CASHIER', 'SUPER_ADMIN'] },
    { path: '/kds', icon: Clock, label: 'KDS', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'CAPTAIN', 'CASHIER', 'SUPER_ADMIN'] },
    { path: '/cancellation-audit', icon: XOctagon, label: 'Reports', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/printer-settings', icon: Printer, label: 'Printer Settings', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'SUPER_ADMIN'] },
    { path: '/inventory', icon: Box, label: 'Inventory', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/analytics', icon: BarChart3, label: 'Analytics', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/settings', icon: SettingsIcon, label: 'Settings', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'SUPER_ADMIN'] },

    // Additional/Historic POS modules (e.g., for advanced operations)
    { path: '/bill-history', icon: History, label: 'Bill History', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/expenses', icon: Wallet, label: 'Expenses', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/day-end', icon: Clock, label: 'Shift / Day End', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },

    // Owner management only:
    { path: '/owner-management', icon: Users, label: 'Owner Management', roles: ['SUPER_OWNER', 'SUPER_ADMIN'] },
    { path: '/owner/restaurants', icon: Building2, label: 'Restaurant Management', roles: ['SUPER_OWNER', 'OWNER', 'SUPER_ADMIN'] },
    { path: '/owner/admins', icon: ShieldCheck, label: 'Admin Management', roles: ['SUPER_OWNER', 'OWNER', 'SUPER_ADMIN'] },
    { path: '/owner/captains', icon: Users, label: 'Captain Management', roles: ['SUPER_OWNER', 'OWNER', 'SUPER_ADMIN'] },

    // Admin & Owner sections within restaurant context
    { path: '/admin/branches', icon: Building2, label: 'Branch Operations', roles: ['SUPER_OWNER', 'OWNER', 'SUPER_ADMIN'] },
    { path: '/admin/restaurant', icon: Store, label: 'Restaurant Profile', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/admin/menu', icon: Utensils, label: 'Menu Management', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/admin/tables', icon: TableIcon, label: 'Table Management', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/billing-config', icon: Receipt, label: 'Billing Config', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },

    // Observability & sync
    { path: '/monitoring', icon: Activity, label: 'System Observability', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/hybrid-sync', icon: Cloud, label: 'Hybrid Sync Center', roles: ['SUPER_OWNER', 'OWNER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
    { path: '/enterprise', icon: ShieldCheck, label: 'Enterprise Hub', roles: ['SUPER_OWNER', 'OWNER', 'SUPER_ADMIN'] },
    { path: '/branches', icon: Building2, label: 'Branch Network', roles: ['SUPER_OWNER', 'OWNER', 'SUPER_ADMIN'] },
    { path: '/ai-insights', icon: BrainCircuit, label: 'Neural Analytics', roles: ['SUPER_OWNER', 'OWNER', 'SUPER_ADMIN'] },
    { path: '/franchise', icon: Crown, label: 'Franchise Master', roles: ['SUPER_OWNER', 'SUPER_ADMIN'] }
  ];

  // Map roles to exact requirement filters:
  // - SUPER_ADMIN & SUPER_OWNER see global fleet views.
  // - OWNER sees analytical business monitors (no day-to-day cashier sessions).
  // - ADMIN & MANAGER see active operations and outlet-level parameters.
  // - CASHIER & CAPTAIN see their day-to-day operational modules only.
  let filteredItems = menuItems.filter(item => {
    if (!roleUpper) return false;

    // 1. SUPER_ADMIN & SUPER_OWNER Fleet-wide platform views
    if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPER_OWNER') {
      const allowedPaths = [
        '/', '/owner-management', '/owner/restaurants', '/owner/admins', 
        '/owner/captains', '/monitoring', '/ai-insights', '/franchise', '/enterprise'
      ];
      return allowedPaths.includes(item.path);
    }

    // 2. OWNER Business management views
    if (roleUpper === 'OWNER') {
      const allowedPaths = [
        '/', '/orders', '/cancellation-audit', '/inventory', '/analytics', 
        '/bill-history', '/expenses', '/owner/admins', '/owner/captains', 
        '/admin/restaurant', '/admin/menu', '/admin/tables', '/billing-config', 
        '/monitoring', '/hybrid-sync'
      ];
      return allowedPaths.includes(item.path);
    }

    // 3. ADMIN / MANAGER Operational view controls
    if (roleUpper === 'ADMIN' || roleUpper === 'MANAGER') {
      const nonAdminPaths = [
        '/owner-management', '/owner/restaurants', '/franchise', '/ai-insights', '/enterprise'
      ];
      if (nonAdminPaths.includes(item.path)) return false;
      
      const itemRoles = item.roles.map(r => r.toUpperCase());
      return itemRoles.includes('ADMIN') || itemRoles.includes('MANAGER');
    }

    // 4. CASHIER POS checkout views
    if (roleUpper === 'CASHIER') {
      const allowedPaths = [
        '/', '/orders', '/pending-bills', '/printer-settings', '/day-end', '/settings'
      ];
      return allowedPaths.includes(item.path);
    }

    // 5. CAPTAIN ordering views
    if (roleUpper === 'CAPTAIN') {
      const allowedPaths = [
        '/', '/orders', '/pending-bills', '/kds', '/settings'
      ];
      return allowedPaths.includes(item.path);
    }

    const itemRoles = item.roles.map(r => r.toUpperCase());
    return itemRoles.includes(roleUpper);
  });

  // Safe fallback if filteredItems is empty (e.g. invalid permissions/role or loading):
  const defaultMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: [] },
    { path: '/', icon: Utensils, label: 'Dining', roles: [] },
    { path: '/orders', icon: ShoppingBag, label: 'Running Orders', roles: [] },
    { path: '/pending-bills', icon: Receipt, label: 'Pending Bills', roles: [] },
    { path: '/settings', icon: SettingsIcon, label: 'Settings', roles: [] }
  ];

  if (!profile || !profile.role || filteredItems.length === 0) {
    filteredItems = defaultMenuItems;
  }

  // Debug requirements check (5):
  const items = filteredItems;
  console.log("ROLE", role);
  console.log("PERMISSIONS", permissions);
  console.log("SIDEBAR_ITEMS", items);

  const SidebarContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col h-full bg-white border-r border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 bg-slate-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 w-24 rounded-md" />
              <div className="h-3 bg-slate-100 w-16 rounded-md" />
            </div>
          </div>
          <div className="flex-1 space-y-4 pt-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-4 rounded-xl">
                <div className="w-5 h-5 bg-slate-200 rounded-md" />
                <div className="h-4 bg-slate-200 w-2/3 rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white border-r border-slate-200">
        {/* Brand */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3" onClick={onClose}>
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                <Building2 size={22} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 leading-tight uppercase tracking-tighter italic">RestoPro</h1>
                <p className="text-[10px] font-mono text-indigo-600 uppercase font-bold tracking-widest">Enterprise</p>
              </div>
            </Link>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path + '-' + item.label}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 translate-x-1' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={18} className={isActive ? 'text-indigo-400' : 'group-hover:text-indigo-600 transition-colors'} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-600'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-lg">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-900 uppercase truncate">{profile?.name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if(confirm('Are you sure you want to logout?')) signOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors font-black text-[11px] uppercase tracking-widest"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-[260px] z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-[70] shadow-2xl lg:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
