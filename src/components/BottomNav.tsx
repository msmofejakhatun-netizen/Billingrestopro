import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Receipt, 
  History, 
  Printer,
  User
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const BottomNav = () => {
  const location = useLocation();
  const { profile } = useAuthStore();

  if (profile?.role !== 'captain') return null;

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dining' },
    { path: '/orders', icon: ShoppingBag, label: 'Running' },
    { path: '/pending-bills', icon: Receipt, label: 'Pending' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 w-full max-w-[100vw] overflow-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-3 items-center h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center h-full gap-0.5 transition-all ${
                isActive ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <item.icon size={16} />
              <span className="text-[7px] font-black uppercase tracking-widest leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
