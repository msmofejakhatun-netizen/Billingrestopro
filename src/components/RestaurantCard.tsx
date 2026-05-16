import React, { useState } from 'react';
import { Settings, ExternalLink, Activity, DollarSign, Users, Grid, Copy, Share2, QrCode as QrIcon, Check, User as UserIcon, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Restaurant } from '../stores/useRestaurantStore';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onSelect: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  isActive: boolean;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({ 
  restaurant, 
  onSelect, 
  onEdit, 
  onToggleActive,
  isActive 
}) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(restaurant.restaurantCode);
    setCopied(true);
    toast.success('Restaurant ID copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: restaurant.restaurantName,
      text: `Join ${restaurant.restaurantName} on RestoPro. ID: ${restaurant.restaurantCode}`,
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        handleCopy();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleCopy();
      }
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300 flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-6 flex justify-between items-start border-b border-slate-50 bg-slate-50/30">
        <div className="flex gap-4 items-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
            {restaurant.logo ? (
              <img src={restaurant.logo} alt={restaurant.restaurantName} className="w-full h-full object-cover" />
            ) : (
              <div className="text-indigo-600 font-black text-xl">{restaurant.restaurantName.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-800 text-lg uppercase leading-tight truncate pr-2">{restaurant.restaurantName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${restaurant.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest truncate">
                {restaurant.active ? 'System Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={onEdit}
            className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-colors border border-transparent hover:border-slate-100 shadow-sm"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Identity Bar */}
      <div className="px-6 py-3 bg-white border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider leading-none mb-1">Restaurant ID</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{restaurant.restaurantCode}</code>
              <button onClick={handleCopy} className="text-slate-300 hover:text-indigo-600 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowQR(!showQR)} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-100">
            <QrIcon className="w-4 h-4" />
          </button>
          <button onClick={handleShare} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-100">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showQR && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-indigo-600 overflow-hidden"
          >
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <div className="p-4 bg-white rounded-2xl shadow-xl">
                <QRCodeSVG value={restaurant.restaurantCode} size={120} level="H" />
              </div>
              <p className="text-[10px] font-black uppercase text-indigo-100 tracking-widest">Scan to join restaurant</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-50">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
          <UserIcon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider leading-none">Owner</p>
          <p className="text-xs font-bold text-slate-700">{restaurant.ownerName || restaurant.ownerEmail}</p>
        </div>
        <button 
          onClick={onToggleActive}
          className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg transition-colors ${
            restaurant.active 
              ? 'bg-emerald-50 text-emerald-600 hover:bg-rose-50 hover:text-rose-600' 
              : 'bg-rose-50 text-rose-600 hover:bg-emerald-50 hover:text-emerald-600'
          }`}
        >
          {restaurant.active ? 'Active' : 'Inactive'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="p-6 grid grid-cols-3 gap-3">
        <div className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100 text-center">
          <div className="flex justify-center mb-1">
            <DollarSign className="w-3 h-3 text-emerald-500" />
          </div>
          <div className="text-sm font-black text-slate-800 tracking-tight">
            ₹{(restaurant.earnings || 0).toLocaleString()}
          </div>
          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Earnings</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100 text-center">
          <div className="flex justify-center mb-1">
            <ShoppingCart className="w-3 h-3 text-indigo-500" />
          </div>
          <div className="text-sm font-black text-slate-800 tracking-tight">
            {restaurant.totalOrders || 0}
          </div>
          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Orders</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100 text-center">
          <div className="flex justify-center mb-1">
            <Grid className="w-3 h-3 text-amber-500" />
          </div>
          <div className="text-sm font-black text-slate-800 tracking-tight">
            {restaurant.tablesCount || 0}
          </div>
          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Tables</span>
        </div>
      </div>

      {/* Action */}
      <div className="p-4 bg-slate-50/50 mt-auto border-t border-slate-100">
        <button 
          onClick={onSelect}
          className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-slate-200 transition-all active:scale-95"
        >
          Access Enterprise
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};

export default RestaurantCard;
