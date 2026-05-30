import React, { useState, useEffect } from 'react';
import { useMenuStore } from '../stores/useMenuStore';
import { useTableStore } from '../stores/useTableStore';
import { useOrderStore } from '../stores/useOrderStore';
import { useAuthStore } from '../stores/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Search, ShoppingCart, ArrowLeft, X, UtensilsCrossed, LayoutGrid, CheckCircle, MessageSquare, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { printReceipt } from '../utils/printReceipt';
import { auth } from '../lib/firebase';

import { usePrinterStore } from '../stores/usePrinterStore';

const getOrderStartDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000);
  }
  if (typeof timestamp._seconds === 'number') {
    return new Date(timestamp._seconds * 1000);
  }
  const parsed = new Date(timestamp);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};

const MenuScreen = () => {
  const { categories, items, loading: menuLoading, subscribe: subscribeMenu } = useMenuStore();
  const { tables, subscribe: subscribeTables } = useTableStore();
  const { profile } = useAuthStore();
  const { cart, currentTable, currentOrder, setCurrentOrder, addToCart, updateCartQuantity, updateItemNotes, confirmOrder, clearCart, activeOrders, subscribeActiveOrders, setCurrentTable } = useOrderStore();
  const { autoPrintKOT } = usePrinterStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartSearchQuery, setCartSearchQuery] = useState('');
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  useEffect(() => {
    if (!isSummaryOpen) {
      setCartSearchQuery('');
    }
  }, [isSummaryOpen]);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const navigate = useNavigate();

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!isSummaryOpen || !currentOrder?.timestamp) return;

    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [isSummaryOpen, currentOrder?.timestamp]);

  const getActiveDuration = () => {
    if (!currentOrder?.timestamp) return null;
    const startDate = getOrderStartDate(currentOrder.timestamp);
    if (!startDate) return null;

    const diffMs = now.getTime() - startDate.getTime();
    if (diffMs < 0) return '0s';

    const diffSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;

    let parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  };

  const getOrderStartTimeFormatted = () => {
    if (!currentOrder?.timestamp) return null;
    const startDate = getOrderStartDate(currentOrder.timestamp);
    if (!startDate) return null;
    return startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  useEffect(() => {
    if (!profile) return;

    const unsubMenu = subscribeMenu();
    const unsubTables = subscribeTables();
    const unsubOrders = subscribeActiveOrders();
    return () => {
      unsubMenu();
      unsubTables();
      unsubOrders();
    };
  }, [subscribeMenu, subscribeTables, subscribeActiveOrders, profile]);

  const runningTotal = currentOrder?.subtotal || 0;
  const runningItems = currentOrder?.items.reduce((sum, i) => sum + i.quantity, 0) || 0;

  const activeCategories = categories.filter(c => c.active);

  useEffect(() => {
    if (activeCategories.length > 0) {
      if (!selectedCategory || !activeCategories.find(c => c.id === selectedCategory)) {
        setSelectedCategory(activeCategories[0].id);
      }
    } else {
      setSelectedCategory(null);
    }
  }, [activeCategories, selectedCategory]);

  // cartTotal and cartCount derived here
  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory ? item.categoryId === selectedCategory : true;
    const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = async () => {
    if (cart.length === 0 && !currentOrder) {
      toast.error("Please add items before sending KOT");
      return;
    }

    try {
      const captainName = profile?.name || (auth.currentUser?.isAnonymous ? 'Guest Captain' : 'Captain');
      const { orderId, newKOTItems } = await confirmOrder(captainName, orderNotes);
      
      // KOT Printing is handled via printQueueService inside confirmOrder
      
      toast.success(currentOrder ? "KOT Updated & Sent!" : "Order confirmed successfully!");
      setIsSummaryOpen(false);
      navigate('/');
    } catch (error) {
      toast.error("Failed to confirm order");
    }
  };

  if (menuLoading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Loading Menu...</p>
    </div>
  );

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 text-center max-w-sm mx-auto">
      <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-400">
        <UtensilsCrossed size={32} />
      </div>
      <div>
        <h3 className="text-xl font-black text-slate-900 leading-tight">Your menu is empty</h3>
        <p className="text-slate-500 text-sm mt-2">Initialize your menu structure in the administration console to begin accepting orders.</p>
      </div>
      <button 
        onClick={() => navigate('/admin')} 
        className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-200 uppercase text-[10px] tracking-widest"
      >
        Open Admin Panel
      </button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-32">
      {/* Sticky Header & Navigation */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        <header className="px-4 md:px-8 py-4 flex items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (cartCount === 0 && !currentOrder) {
                  clearCart();
                  setCurrentTable(null);
                }
                navigate('/');
              }} 
              className="p-2.5 bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-900 leading-none tracking-tight">Main Menu</h2>
              <div className="flex items-center gap-2 mt-1">
                {currentTable ? (
                  <div className="flex items-center gap-2">
                    <p className="text-indigo-600 text-[9px] font-black uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded ring-1 ring-indigo-100">Table {currentTable.number}</p>
                    <button 
                      onClick={() => setIsTableModalOpen(true)}
                      className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsTableModalOpen(true)}
                    className="text-rose-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <LayoutGrid size={10} />
                    Select Table First
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="relative flex-1 max-w-xs md:max-w-md ml-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-indigo-100 text-sm font-medium transition-all"
            />
          </div>
        </header>

        {/* Sticky Categories Bar */}
        <nav className="px-4 md:px-8 py-3 flex gap-3 overflow-x-auto no-scrollbar scroll-smooth bg-white">
          {activeCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all uppercase tracking-widest flex items-center gap-2 ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </nav>
      </div>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
        {!currentTable && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-8 bg-indigo-600 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-indigo-100/50"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20">
                <LayoutGrid size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">Station Inactive</h3>
                <p className="text-indigo-100/80 text-[10px] font-bold uppercase tracking-[0.2em] max-w-[200px]">Select a table to begin taking orders on this device</p>
              </div>
            </div>
            <button 
              onClick={() => setIsTableModalOpen(true)} 
              className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-50 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Choose Table
            </button>
          </motion.div>
        )}

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredItems.map((item) => {
            const cartItem = cart.find(i => i.itemId === item.id);
            const isAvailable = item.available !== false;

            return (
              <motion.div
                key={item.id}
                layout
                className={`group bg-white p-3 rounded-[2rem] border border-slate-100 flex flex-col transition-all overflow-hidden ${
                  !isAvailable ? 'opacity-40 grayscale pointer-events-none' : 'hover:shadow-xl hover:border-indigo-100'
                }`}
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-50">
                  <img 
                    src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop'} 
                    alt={item.itemName} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                  />
                  
                  {/* Floating Add/Qty Controls directly on card */}
                  <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                    {isAvailable && cartItem ? (
                      <div className="flex items-center gap-4 bg-white/90 backdrop-blur-md p-1 rounded-xl shadow-2xl border border-white/50 w-full justify-between">
                        <button 
                          onClick={() => updateCartQuantity(item.id, -1)}
                          className="w-10 h-10 flex items-center justify-center text-slate-800 hover:text-rose-500 transition-colors"
                        >
                          <Minus size={18} strokeWidth={3} />
                        </button>
                        <span className="font-black text-slate-900 text-lg italic">{cartItem.quantity}</span>
                        <button 
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="w-10 h-10 flex items-center justify-center text-slate-800 hover:text-indigo-600 transition-colors"
                        >
                          <Plus size={18} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!currentTable) return setIsTableModalOpen(true);
                          addToCart({ itemId: item.id, itemName: item.itemName, price: item.price, quantity: 1 });
                        }}
                        className="w-full bg-white/90 backdrop-blur-md text-slate-900 font-black py-3 rounded-xl border border-white/50 shadow-xl shadow-black/5 hover:bg-slate-900 hover:text-white transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                      >
                        <Plus size={14} strokeWidth={3} />
                        Add Item
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3">
                   <h4 className="font-black text-slate-800 uppercase tracking-tight line-clamp-1 italic">{item.itemName}</h4>
                   <p className="text-xl font-black text-indigo-600 italic tracking-tighter mt-1">₹{item.price}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* FIXED BOTTOM ACTION BAR */}
      <AnimatePresence>
        {cartCount > 0 && !isSummaryOpen && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-40 p-4 md:p-6"
          >
            <div className="max-w-3xl mx-auto w-full bg-slate-900 rounded-[2.5rem] p-4 flex items-center justify-between shadow-2xl shadow-indigo-100/20">
               <div className="flex flex-col pl-4 flex-1 overflow-hidden mr-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-1.5 py-0.5">
                    {cart.map((item, cartIdx) => (
                      <div key={`${item.itemId}-${cartIdx}`} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5 whitespace-nowrap">
                        <span className="text-[10px] font-black text-indigo-400">{item.quantity}</span>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-300 truncate max-w-[120px] uppercase tracking-tight italic">{item.itemName} · ₹{item.price * item.quantity}</span>
                          {item.notes && <span className="text-[7px] text-slate-500 italic lowercase truncate max-w-[80px]">({item.notes})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black text-white italic tracking-tighter leading-none">₹{cartTotal}</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none italic">{cartCount} {cartCount === 1 ? 'Item' : 'Items'}</p>
                  </div>
               </div>
               <button 
                 onClick={() => setIsSummaryOpen(true)}
                 disabled={cartCount === 0}
                 className="bg-indigo-600 hover:bg-indigo-700 text-white pl-8 pr-5 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-4 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:grayscale shrink-0"
               >
                 NEXT
                 <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <ShoppingCart size={16} />
                 </div>
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ORDER SUMMARY FULLSCREEN OVERLAY */}
      <AnimatePresence>
        {isSummaryOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
          >
             {/* Summary Header */}
             <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100">
                <button 
                  onClick={() => setIsSummaryOpen(false)}
                  className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest"
                >
                   <ArrowLeft size={18} />
                   Back to Menu
                </button>
                <div className="text-center">
                   <h3 className="font-black text-slate-900 uppercase italic tracking-tighter">Order Summary</h3>
                   <div className="flex items-center justify-center gap-2 mt-1">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Table {currentTable?.number || '??'}</p>
                      {currentOrder?.timestamp && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping mr-0.5" />
                            {getActiveDuration()}
                          </span>
                        </>
                      )}
                   </div>
                </div>
                <button onClick={() => setIsSummaryOpen(false)} className="p-2 text-slate-300">
                   <X size={24} />
                </button>
             </header>

             {/* Summary Content */}
             <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-2xl mx-auto w-full">
                {/* Active Order Timer */}
                {currentOrder?.timestamp && (() => {
                  const duration = getActiveDuration();
                  const startTime = getOrderStartTimeFormatted();
                  if (!duration) return null;
                  return (
                    <motion.div 
                      key="active-order-timer"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-50 border border-amber-200/60 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center relative">
                          <span className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-ping" />
                          <Clock size={20} className="relative z-10" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Order Progress</p>
                          <h4 className="text-base font-black text-slate-800 uppercase tracking-tight italic">Active Session</h4>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end text-center sm:text-right">
                        <span className="text-2xl font-black text-amber-700 italic font-mono tracking-tight animate-pulse">
                          {duration}
                        </span>
                        {startTime && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Started at {startTime}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Cart Items */}
                <div className="space-y-4">
                   <div className="flex items-center justify-between px-1">
                     <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Selected Cart Items</h4>
                     {cart.length > 5 && (
                       <div className="relative w-48">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                         <input
                           type="text"
                           placeholder="Filter cart..."
                           value={cartSearchQuery}
                           onChange={(e) => setCartSearchQuery(e.target.value)}
                           className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-100 rounded-lg text-[9px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-slate-300"
                         />
                         {cartSearchQuery && (
                           <button onClick={() => setCartSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">
                             <X size={10} />
                           </button>
                         )}
                       </div>
                     )}
                   </div>

                   <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                      {cart.filter(item => item.itemName.toLowerCase().includes(cartSearchQuery.toLowerCase())).length === 0 ? (
                        <div className="p-12 text-center">
                           <UtensilsCrossed size={24} className="mx-auto text-slate-200 mb-2" />
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching items in cart</p>
                        </div>
                      ) : (
                        cart
                          .filter(item => item.itemName.toLowerCase().includes(cartSearchQuery.toLowerCase()))
                          .map((item, idx) => (
                            <div 
                              key={`${item.itemId}-${item.notes}`} 
                              className={`p-6 flex flex-col gap-4 group/cartitem transition-all duration-300 hover:bg-indigo-50/15 hover:shadow-[0_8px_24px_-6px_rgba(79,70,229,0.06)] hover:translate-x-1 border-l-4 border-l-transparent hover:border-l-indigo-500 rounded-r-2xl md:rounded-r-[1.5rem] ${idx !== 0 ? 'border-t border-slate-100/50' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h4 className="font-black text-slate-800 uppercase tracking-tight italic text-base truncate">
                                      {item.itemName}
                                    </h4>
                                    {item.notes && (
                                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-full border border-amber-200/50 animate-in fade-in duration-300">
                                        <MessageSquare size={10} className="stroke-[3]" />
                                        Customized
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-black text-indigo-600 italic">₹{item.price}</p>
                                </div>
                                
                                <div className="flex items-center gap-4 bg-slate-50 group-hover/cartitem:bg-white p-1.5 rounded-2xl border border-slate-100 group-hover/cartitem:border-slate-200/80 transition-all duration-300 shadow-sm">
                                  <button 
                                    onClick={() => {
                                      if (item.quantity === 1) {
                                        if (window.confirm('Are you sure you want to cancel this item?')) {
                                          updateCartQuantity(item.itemId, -1, item.notes);
                                        }
                                      } else {
                                        updateCartQuantity(item.itemId, -1, item.notes);
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                  >
                                    <Minus size={16} strokeWidth={2.5} />
                                  </button>
                                  <span className="font-black w-4 text-center text-sm text-slate-800">{item.quantity}</span>
                                  <button 
                                    onClick={() => updateCartQuantity(item.itemId, 1, item.notes)} 
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                  >
                                    <Plus size={16} strokeWidth={2.5} />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${item.notes ? 'text-amber-500' : 'text-slate-400'}`}>
                                  <MessageSquare size={13} />
                                </span>
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  onChange={(e) => updateItemNotes(item.itemId, item.notes || '', e.target.value)}
                                  placeholder="Add kitchen feedback (e.g., no onion, double cheese)..."
                                  className={`w-full bg-slate-50/70 border rounded-2xl pl-10 pr-4 py-2.5 text-[11px] font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-medium placeholder:text-[11px] focus:bg-white focus:ring-4 outline-none transition-all duration-300 ${
                                    item.notes 
                                      ? 'border-amber-200 bg-amber-50/10 focus:ring-amber-100 text-amber-900 font-extrabold' 
                                      : 'border-slate-100 focus:ring-indigo-100 focus:border-indigo-500'
                                  }`}
                                />
                              </div>
                            </div>
                          ))
                      )}
                   </div>
                </div>

                {/* Running Items (Already Sent) */}
                {currentOrder && currentOrder.items.length > 0 && (
                   <div className="space-y-4">
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">Active Table Items (Already Sent)</h4>
                      <div className="bg-slate-100/50 rounded-[2rem] border border-slate-200/50 p-6 space-y-4">
                         {currentOrder.items.map((item, idx) => (
                           <div key={`sent-${idx}`} className="flex justify-between items-center opacity-60 grayscale">
                              <div className="flex-1 pr-4">
                                 <p className="font-bold text-slate-800 text-sm">{item.itemName}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase">₹{item.price} x {item.quantity}</p>
                                 {item.notes && <p className="text-[10px] text-indigo-500 font-bold italic mt-0.5">"{item.notes}"</p>}
                              </div>
                              <span className={`text-[10px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${
                                item.status === 'cancelled' ? 'text-rose-600 bg-rose-50 border-rose-100' :
                                item.status === 'served' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                item.status === 'preparing' ? 'text-amber-600 bg-amber-50 border-amber-100' :
                                'text-slate-600 bg-slate-50 border-slate-100'
                              }`}>
                                {item.status}
                              </span>
                           </div>
                         ))}
                      </div>
                   </div>
                )}

                {/* Notes */}
                <div className="space-y-4">
                   <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">Special Instructions</h4>
                   <textarea
                     value={orderNotes}
                     onChange={(e) => setOrderNotes(e.target.value)}
                     placeholder="E.g. Extra spicy, No onions, Fast service..."
                     className="w-full h-32 bg-white border border-slate-100 rounded-[2rem] p-6 text-sm font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none italic placeholder:text-slate-200 shadow-sm"
                   />
                </div>

                {/* Totals Breakdown */}
                <div className="space-y-4 pb-12">
                   <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">Order Value Summary</h4>
                   <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-4 shadow-xl shadow-indigo-100">
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest opacity-60">
                         <span>Cart Subtotal</span>
                         <span>₹{cartTotal}</span>
                      </div>
                      {runningTotal > 0 && (
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest opacity-60">
                           <span>Table Running Amount</span>
                           <span>₹{runningTotal}</span>
                        </div>
                      )}
                      
                      <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Estimated Total</p>
                            <h3 className="text-4xl font-black italic tracking-tighter">₹{cartTotal + runningTotal}</h3>
                         </div>
                         <p className="text-[10px] font-bold text-indigo-400 uppercase italic opacity-60">GST (5%) calculated at billing</p>
                      </div>
                   </div>
                </div>
             </div>

             {/* Footer Buttons */}
             <div className="bg-white border-t border-slate-100 p-6 flex flex-col md:flex-row gap-4 max-w-2xl mx-auto w-full">
                <button 
                  onClick={() => setIsSummaryOpen(false)}
                  className="flex-1 py-5 bg-slate-50 text-slate-500 font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-slate-100 transition-colors"
                >
                   Add More Items
                </button>
                <button 
                  onClick={handleConfirmOrder}
                  disabled={currentOrder?.orderStatus === 'billed'}
                  className={`flex-1 py-5 ${cart.length === 0 && currentOrder ? 'bg-rose-600' : 'bg-indigo-600'} text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-indigo-100 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                   {currentOrder?.orderStatus === 'billed' ? 'Order Billed (Locked)' : 
                    (cart.length === 0 && currentOrder ? 'Clear Table & Cancel Order' : 
                    (currentOrder ? 'Update KOT & Send' : 'Confirm Order & Print KOT'))}
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Selection Modal (Keep same but match style) */}
      <AnimatePresence>
        {isTableModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTableModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl bg-white z-[70] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-10 pb-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-100">
                    <LayoutGrid size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Select Table</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mark active zone for this session</p>
                  </div>
                </div>
                <button onClick={() => setIsTableModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-300">
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {tables.map(table => {
                    const activeOrder = activeOrders.find(o => o.id === table.currentOrderId);
                    const isRunning = table.status === 'running';
                    const isAvailable = table.status === 'available';
                    const isCurrent = currentTable?.id === table.id;

                    return (
                      <button
                        key={table.id}
                        disabled={!isAvailable && !isRunning}
                        onClick={() => {
                          const activeOrder = activeOrders.find(o => o.id === table.currentOrderId);
                          if (activeOrder) {
                            useOrderStore.getState().loadOrderToCart(activeOrder);
                          } else {
                            setCurrentTable({ id: table.id, number: table.tableNumber });
                            if (currentOrder) setCurrentOrder(null);
                            clearCart();
                          }
                          setIsTableModalOpen(false);
                          toast.success(`Table ${table.tableNumber} Selected`);
                        }}
                        className={`aspect-square p-4 rounded-[2.5rem] border-2 transition-all flex flex-col items-center justify-center gap-2 group relative overflow-hidden ${
                          isCurrent ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200 ring-4 ring-indigo-500/20 z-10 scale-105' :
                          isAvailable ? 'bg-white border-slate-100 hover:border-indigo-200 text-slate-900 hover:shadow-xl hover:scale-105' :
                          isRunning ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm hover:scale-105' :
                          'bg-slate-100 border-slate-50 opacity-30 grayscale cursor-not-allowed'
                        }`}
                      >
                        {isCurrent && (
                          <div className="absolute inset-0 bg-white/10" />
                        )}

                        <span className={`text-4xl font-black italic tracking-tighter relative z-10 ${isCurrent ? 'text-white' : 'text-inherit'}`}>{table.tableNumber}</span>
                        
                        {isRunning && (
                          <div className={`flex flex-col items-center relative z-10 ${isCurrent ? 'text-indigo-100' : 'text-amber-600'}`}>
                            <div className="flex items-center gap-1 mb-1">
                               <UtensilsCrossed size={10} />
                               <span className="text-[10px] font-black uppercase tracking-tighter italic">Running</span>
                            </div>
                            <span className="text-[10px] font-black italic tracking-tighter leading-none">
                              ₹{activeOrder?.totalAmount || '...'}
                            </span>
                          </div>
                        )}
                        
                        {isAvailable && !isCurrent && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 relative z-10 px-3 py-1 border border-slate-100 rounded-full group-hover:border-indigo-100 group-hover:text-indigo-400 transition-colors">
                            Ready
                          </span>
                        )}
                        
                        {isCurrent && (
                          <div className="absolute top-4 right-4 z-20">
                            <CheckCircle size={16} className="text-white ring-4 ring-white/20 bg-indigo-500 rounded-full" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 flex items-center justify-between">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-md bg-white border border-slate-200" />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-md bg-amber-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-md bg-indigo-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selected</span>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/')}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                >
                  View Map
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenuScreen;
