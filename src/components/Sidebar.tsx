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
  Cloud
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const { profile, signOut } = useAuthStore();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['owner', 'admin', 'captain'] },
    
    // POS Sections
    { path: '/orders', icon: ShoppingBag, label: 'Running Orders', roles: ['owner', 'admin', 'captain'] },
    { path: '/pending-bills', icon: Receipt, label: 'Pending Bills', roles: ['owner', 'admin', 'captain'] },
    { path: '/bill-history', icon: History, label: 'Bill History', roles: ['owner', 'admin', 'captain'] },
    { path: '/cancellation-audit', icon: XOctagon, label: 'Cancellation Audit', roles: ['owner', 'admin'] },

    // Expense & Reports
    { path: '/expenses', icon: Wallet, label: 'Expenses', roles: ['owner', 'admin'] },
    { path: '/day-end', icon: Clock, label: 'Shift / Day End', roles: ['owner', 'admin'] },
    
    // Owner Only Sections
    { path: '/owner/restaurants', icon: Building2, label: 'Restaurant Management', roles: ['owner'] },
    { path: '/owner/admins', icon: ShieldCheck, label: 'Admin Management', roles: ['owner'] },
    { path: '/owner/captains', icon: Users, label: 'Captain Management', roles: ['owner'] },

    // Admin & Owner (within a restaurant context)
    { path: '/admin/restaurant', icon: Store, label: 'Restaurant Profile', roles: ['owner', 'admin'] },
    { path: '/admin/menu', icon: Utensils, label: 'Menu Management', roles: ['owner', 'admin'] },
    { path: '/admin/tables', icon: TableIcon, label: 'Table Management', roles: ['owner', 'admin'] },
    { path: '/billing-config', icon: Receipt, label: 'Billing Config', roles: ['owner', 'admin'] },
    
    // Universal/Role-specific
    { path: '/analytics', icon: BarChart3, label: 'Analytics', roles: ['owner', 'admin'] },
    { path: '/hybrid-sync', icon: Cloud, label: 'Hybrid Sync Center', roles: ['owner', 'admin'] },
    { path: '/enterprise', icon: ShieldCheck, label: 'Enterprise Hub', roles: ['owner', 'admin'] },
    { path: '/inventory', icon: Box, label: 'Inventory (Raw)', roles: ['owner', 'admin'] },
    { path: '/branches', icon: Building2, label: 'Branch Network', roles: ['owner', 'admin'] },
    { path: '/ai-insights', icon: BrainCircuit, label: 'Neural Analytics', roles: ['owner', 'admin'] },
    { path: '/franchise', icon: Crown, label: 'Franchise Master', roles: ['owner'] },
    { path: '/printer-settings', icon: Printer, label: 'Printer Settings', roles: ['owner', 'admin'] },
    { path: '/settings', icon: SettingsIcon, label: 'Settings', roles: ['owner', 'admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(profile?.role || ''));

  const SidebarContent = () => (
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
              key={item.path}
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{profile?.role}</p>
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
