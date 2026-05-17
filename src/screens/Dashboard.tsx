import { useEffect, useState, useRef, useMemo } from 'react';
import { useTableStore, RestaurantTable } from '../stores/useTableStore';
import { useOrderStore } from '../stores/useOrderStore';
import { useAuthStore } from '../stores/useAuthStore';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useShiftStore } from '../stores/useShiftStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Loader2, Users, Clock, MoreVertical, Bell, LayoutGrid, 
  Filter, Trash2, Edit2, RotateCcw, Combine, X, ChevronRight, 
  Printer, Receipt, History, User, Minus, CreditCard, Wallet, 
  CheckCircle2, AlertCircle, ShoppingCart, Info, List
} from 'lucide-react';
import { printQueueService } from '../services/printQueueService';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const { tables, loading: tablesLoading, subscribe: subscribeTables, addTable, deleteTable, updateTable } = useTableStore();
  const { profile } = useAuthStore();
  const { setCurrentTable, setCurrentOrder, activeOrders, subscribeActiveOrders, startTableSession, loadOrderToCart } = useOrderStore();
  const { activeSession, checkActiveSession } = useShiftStore();
  const { isConnected, defaultPrinter } = usePrinterStore();
  
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>('Hall');
  const sections = useMemo(() => Array.from(new Set(tables.map(t => t.section || 'Hall'))), [tables]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showTableActions, setShowTableActions] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [viewingOrder, setViewingOrder] = useState<string | null>(null);
  const [isBilling, setIsBilling] = useState<string | null>(null);
  const [isShiftMode, setIsShiftMode] = useState<{ sourceId: string, orderId: string } | null>(null);
  const [isMergeMode, setIsMergeMode] = useState<{ sourceOrderId: string, sourceTableNumber: string } | null>(null);
  const [now, setNow] = useState(new Date());
  const longPressTimer = useRef<any>(null);
  const isLongPress = useRef(false);
  
  const navigate = useNavigate();

  const handleLongPress = (tableId: string) => {
    isLongPress.current = true;
    setShowTableActions(tableId);
  };

  const startPress = (tableId: string) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      handleLongPress(tableId);
    }, 600); // 600ms for long press
  };

  const cancelPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 's': setSearchQuery(''); document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus(); break;
          case 'h': setActiveSection('Hall'); break;
          case 'o': setActiveSection('Outside'); break;
          case 'u': setActiveSection('Outdoor'); break;
          case 'k': navigate('/kds'); break;
          case 'b': navigate('/pending-bills'); break;
          case 'd': navigate('/day-end'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    if (!profile) return;
    
    checkActiveSession();
    const unsubTables = subscribeTables();
    const unsubOrders = subscribeActiveOrders();

    const timer = setInterval(() => setNow(new Date()), 60000);

    return () => {
      unsubTables();
      unsubOrders();
      clearInterval(timer);
    };
  }, [subscribeTables, subscribeActiveOrders, profile, checkActiveSession]);

  const ordersMap = useMemo(() => {
    return activeOrders.reduce((acc, order) => {
      if (order.id) acc[order.id] = order;
      return acc;
    }, {} as Record<string, any>);
  }, [activeOrders]);

  const filteredTables = useMemo(() => {
    return tables.filter(table => {
      const tableSection = table.section || 'Hall';
      const matchesSection = tableSection === activeSection;
      const matchesSearch = table.tableNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || table.status === statusFilter;
      return matchesSection && matchesSearch && matchesStatus;
    });
  }, [tables, activeSection, searchQuery, statusFilter]);

  const handleAddTable = async () => {
    setProcessing(true);
    try {
      await addTable(activeSection);
      toast.success(`Table added to ${activeSection}`);
    } catch (error) {
      toast.error("Failed to add table");
    } finally {
      setProcessing(false);
    }
  };

  const handleTableClick = async (table: RestaurantTable) => {
    if (processing) return;

    // Handle shift/merge modes first
    if (isShiftMode) {
      const { sourceId, orderId } = isShiftMode;
      if (sourceId === table.id) {
        setIsShiftMode(null);
        return;
      }
      if (table.status !== 'available') {
        toast.error("Target table must be available");
        return;
      }
      
      await useOrderStore.getState().shiftTable(orderId, sourceId, table.id, table.tableNumber);
      setIsShiftMode(null);
      return;
    }

    if (isMergeMode) {
      const { sourceOrderId, sourceTableNumber } = isMergeMode;
      if (!table.currentOrderId || sourceOrderId === table.currentOrderId) {
        setIsMergeMode(null);
        return;
      }
      
      if (confirm(`Merge Table ${sourceTableNumber} into Table ${table.tableNumber}?`)) {
        await useOrderStore.getState().mergeTables(sourceOrderId, table.currentOrderId);
      }
      setIsMergeMode(null);
      return;
    }

    if (table.status === 'available') {
      if (!activeSession) {
        toast.error("Open Shift first in Day End");
        navigate('/day-end');
        return;
      }
      
      const toastId = toast.loading("Starting session...");
      setProcessing(true);
      try {
        await startTableSession({ id: table.id, number: table.tableNumber });
        toast.success("Table Ready", { id: toastId });
        navigate('/menu');
      } catch (e) {
        toast.error("Failed to start session", { id: toastId });
      } finally {
        setProcessing(false);
      }
    } else if (table.currentOrderId) {
      const activeOrder = activeOrders.find(o => o.id === table.currentOrderId);
      if (activeOrder) {
        if (activeOrder.orderStatus === 'billed') {
          navigate(`/billing/${table.currentOrderId}`);
        } else {
          loadOrderToCart(activeOrder);
          navigate('/menu');
        }
      } else {
        navigate(`/billing/${table.currentOrderId}`);
      }
    }
  };

  if (tablesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <div className="absolute inset-0 bg-indigo-600/10 rounded-full animate-ping"></div>
      </div>
      <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Syncing Floor Plan...</p>
    </div>
  );

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden pb-24 px-2 md:px-6">
      {/* Mobile Top Bar */}
      <header className="flex items-center justify-between py-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Dashboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500">
            <Bell size={18} />
          </button>
          <button 
            onClick={() => navigate('/restaurant-management')}
            className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </header>

      {/* Status Filters */}
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'available', 'running', 'billed', 'reserved'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${
                statusFilter === status 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${
                status === 'available' ? 'bg-emerald-500' :
                status === 'running' ? 'bg-amber-500' :
                status === 'billed' ? 'bg-purple-500' : 
                status === 'reserved' ? 'bg-blue-500' : 'bg-slate-300'
              }`} />
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-white p-1 rounded-2xl border border-slate-100 mb-4 overflow-x-auto no-scrollbar">
        {sections.map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            className={`flex-1 min-w-[70px] py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
              activeSection === sec 
                ? 'bg-indigo-50 text-indigo-600 shadow-sm font-black' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {sec}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mb-4 text-[8px] font-black uppercase text-slate-400 tracking-widest">
        {[
          { label: 'Available', color: 'bg-emerald-500' },
          { label: 'Running', color: 'bg-amber-500' },
          { label: 'Billed', color: 'bg-purple-500' },
          { label: 'Reserved', color: 'bg-blue-500' }
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Pending Bills Section */}
      {activeOrders.filter(o => o.orderStatus === 'billed').length > 0 && (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Receipt size={18} />
                 </div>
                 <h3 className="text-lg font-black text-slate-800 tracking-tight">Pending Bills</h3>
              </div>
              <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full">
                {activeOrders.filter(o => o.orderStatus === 'billed').length} Pending
              </span>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeOrders.filter(o => o.orderStatus === 'billed').map(order => (
                <div 
                  key={order.id}
                   onClick={() => navigate(`/billing/${order.id}`)}
                  className="bg-white p-4 rounded-3xl border border-indigo-100 shadow-sm flex items-center justify-between group hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                >
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black">
                        {order.tableNumber}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">₹{order.totalAmount}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">{order.captainName}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="text-right hidden sm:block">
                         <p className="text-[8px] font-black text-slate-400 uppercase">Status</p>
                         <p className="text-[9px] font-black text-indigo-600 uppercase">Unpaid</p>
                      </div>
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <ChevronRight size={18} />
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 sm:gap-4 md:gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTables.map((table) => {
            const activeOrder = table.currentOrderId ? ordersMap[table.currentOrderId] : null;
            const status = table.status;
            
            // Status specific styles
            const statusStyles = {
              available: { card: 'bg-white border-slate-100', dot: 'bg-emerald-500', text: 'text-emerald-600' },
              occupied: { card: 'bg-rose-50/30 border-rose-100', dot: 'bg-rose-500', text: 'text-rose-600' },
              running: { card: 'bg-amber-50/30 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-600' },
              billed: { card: 'bg-purple-50/50 border-purple-200', dot: 'bg-purple-500', text: 'text-purple-600' },
              reserved: { card: 'bg-blue-50/50 border-blue-200', dot: 'bg-blue-500', text: 'text-blue-600' },
            }[status] || { card: 'bg-white', dot: 'bg-slate-300', text: 'text-slate-400' };

            const runningTime = table.lastOrderAt?.toDate ? formatDistanceToNow(table.lastOrderAt.toDate()) : '';

            return (
              <motion.div
                layout
                key={table.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  if (!showTableActions) {
                    handleTableClick(table);
                  }
                }}
                whileTap={{ scale: 0.98 }}
                className={`relative group rounded-2xl p-2.5 border flex flex-col gap-1.5 cursor-pointer transition-all touch-manipulation min-h-[100px] items-center justify-center text-center ${statusStyles.card} shadow-sm backdrop-blur-sm`}
              >
                {/* Menu Toggle Icon */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTableActions(table.id);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <MoreVertical size={14} />
                </button>

                {/* Table Number & Status */}
                <div className="flex flex-col items-center">
                  <span className="text-lg font-black text-slate-800 tracking-tight leading-none mb-0.5">{table.tableNumber}</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1 h-1 rounded-full ${statusStyles.dot}`} />
                    <span className={`text-[6px] font-black uppercase tracking-widest ${statusStyles.text}`}>{status}</span>
                  </div>
                </div>

                {/* Data Section */}
                {activeOrder ? (
                  <div className="space-y-1 w-full">
                    {/* Amount Highlight */}
                    <div className="bg-white/60 py-0.5 px-1.5 rounded-lg flex items-center justify-between gap-0.5 border border-black/5">
                       <span className={`text-[10px] font-black tracking-tighter ${status === 'running' ? 'text-amber-600' : 'text-purple-600'}`}>₹{activeOrder.totalAmount}</span>
                       <div className="flex items-center gap-0.5 opacity-50">
                          <span className="text-[6px] font-black">{activeOrder.items.reduce((sum, i) => sum + i.quantity, 0)}</span>
                          <LayoutGrid size={6} strokeWidth={3} />
                       </div>
                    </div>
                    
                    {/* Info Badges */}
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                       <div className="flex items-center gap-0.5 text-[6px] font-black text-slate-400 bg-slate-50/50 px-1 py-0.5 rounded-md border border-slate-100">
                          <Users size={6} strokeWidth={3} />
                          <span>{table.guestCount || 0}</span>
                       </div>
                       <div className="flex items-center gap-0.5 text-[6px] font-black text-slate-400 bg-slate-50/50 px-1 py-0.5 rounded-md border border-slate-100">
                          <Clock size={6} strokeWidth={3} />
                          <span>{runningTime}</span>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-0.5 mt-auto">
                    <div className="flex items-center gap-0.5 text-[7px] font-bold text-slate-400 bg-slate-50/50 px-1.5 py-0.5 rounded-full border border-slate-100">
                      <Users size={7} />
                      <span className="uppercase tracking-[0.05em] font-black">{table.guestCount || 4} Pax</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Global Action Popup */}
      <AnimatePresence>
        {showTableActions && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTableActions(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed left-4 right-4 bottom-20 bg-white rounded-[2.5rem] shadow-2xl z-[101] overflow-hidden p-5 border border-slate-100 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const table = tables.find(t => t.id === showTableActions);
                if (!table) return null;
                const order = table.currentOrderId ? ordersMap[table.currentOrderId] : null;

                const ActionButton = ({ icon: Icon, label, color, onClick, disabled }: any) => (
                  <button
                    disabled={disabled}
                    onClick={onClick}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-95 ${color} disabled:opacity-30`}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20">
                      <Icon size={18} className="text-current" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-current text-left leading-tight">{label}</span>
                  </button>
                );

                return (
                  <div className="space-y-5 h-full flex flex-col">
                    <div className="flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg">
                           {table.tableNumber}
                         </div>
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Manage Table</p>
                            <p className={`text-[10px] font-black uppercase ${
                              table.status === 'available' ? 'text-emerald-500' : 
                              table.status === 'running' ? 'text-amber-500' : 'text-purple-500'
                            }`}>Status: {table.status}</p>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
                         <Users size={14} className="text-slate-400" />
                         <input 
                           type="number" 
                           defaultValue={table.guestCount || 4}
                           onChange={(e) => updateTable(table.id, { guestCount: parseInt(e.target.value) || 0 })}
                           className="bg-transparent w-10 text-xs font-black outline-none"
                         />
                      </div>

                      <button onClick={() => setShowTableActions(null)} className="p-2.5 bg-slate-50 text-slate-400 rounded-2xl active:bg-slate-100">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 overflow-y-auto no-scrollbar pb-2">
                      <ActionButton 
                        icon={Plus} 
                        label="Add Items" 
                        color="bg-indigo-50 text-indigo-600 border border-indigo-100"
                        onClick={() => {
                          if (order) {
                            loadOrderToCart(order);
                            navigate('/menu');
                          } else {
                            handleTableClick(table);
                          }
                          setShowTableActions(null);
                        }}
                      />
                      <ActionButton 
                        icon={Edit2} 
                        label="Edit Order" 
                        color="bg-slate-50 text-slate-600 border border-slate-100"
                        onClick={() => {
                          if (order) setViewingOrder(order.id!);
                          setShowTableActions(null);
                        }}
                        disabled={!order}
                      />
                      <ActionButton 
                        icon={Trash2} 
                        label="Cancel Order" 
                        color="bg-rose-50 text-rose-600 border border-rose-100"
                        onClick={() => {
                          if (order && confirm("Cancel full order and clear table?")) {
                            useOrderStore.getState().cancelOrder(order.id!, "Cancelled from Dashboard");
                          }
                          setShowTableActions(null);
                        }}
                        disabled={!order || !['owner', 'admin'].includes(profile?.role || '')}
                      />
                      <ActionButton 
                        icon={Printer} 
                        label="KOT" 
                        color="bg-amber-50 text-amber-600 border border-amber-100"
                        onClick={async () => {
                          try {
                            await printQueueService.queuePrint({
                              type: 'KOT',
                              orderId: order.id!,
                              tableNumber: order.tableNumber,
                              restaurantId: order.restaurantId,
                              items: order.items,
                              requestedBy: profile?.name || 'Captain'
                            });
                            toast.success("KOT Print request queued");
                          } catch (e) {
                            toast.error("Failed to queue KOT");
                          }
                          setShowTableActions(null);
                        }}
                        disabled={!order}
                      />
                      <ActionButton 
                        icon={Receipt} 
                        label="Bill" 
                        color="bg-indigo-50 text-indigo-600 border border-indigo-100"
                        onClick={() => {
                          if (order) useOrderStore.getState().generateBill(order.id!, { discountAmount: 0, serviceChargeAmount: 0 });
                          setShowTableActions(null);
                        }}
                        disabled={!order}
                      />
                      <ActionButton 
                        icon={CreditCard} 
                        label="Payment" 
                        color="bg-emerald-50 text-emerald-600 border border-emerald-100"
                        onClick={() => {
                          if (order) setIsBilling(order.id!);
                          setShowTableActions(null);
                        }}
                        disabled={!order}
                      />
                      <ActionButton 
                        icon={RotateCcw} 
                        label="Shift Table" 
                        color="bg-slate-50 text-slate-600 border border-slate-100"
                        onClick={() => {
                          if (order) {
                            setIsShiftMode({ sourceId: table.id, orderId: order.id! });
                            toast.info(`Shifting Table ${table.tableNumber}: Select target table`);
                          }
                          setShowTableActions(null);
                        }}
                        disabled={!order}
                      />
                      <ActionButton 
                        icon={History} 
                        label="Duplicate Bill" 
                        color="bg-slate-50 text-slate-600 border border-slate-100"
                        onClick={async () => {
                          try {
                            await printQueueService.queuePrint({
                              type: 'BILL',
                              orderId: order.id!,
                              tableNumber: order.tableNumber,
                              restaurantId: order.restaurantId,
                              total: order.finalAmount || order.totalAmount,
                              requestedBy: profile?.name || 'Captain'
                            });
                            toast.success("Bill Reprint request queued");
                          } catch (e) {
                            toast.error("Failed to queue Bill");
                          }
                          setShowTableActions(null);
                        }}
                        disabled={!order}
                      />
                      <ActionButton 
                        icon={Trash2} 
                        label="Delete Table" 
                        color="bg-rose-600 text-white"
                        onClick={() => {
                          if (confirm("Delete this table?")) deleteTable(table.id);
                          setShowTableActions(null);
                        }}
                        disabled={!['owner', 'admin'].includes(profile?.role || '')}
                      />
                      <button 
                        onClick={() => setShowTableActions(null)}
                        className="col-span-2 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest mt-2"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {filteredTables.length === 0 && !tablesLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-4">
            <LayoutGrid size={32} />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No Tables Found in {activeSection}</p>
          <p className="text-slate-300 text-[9px] mt-1 font-bold">Try changing your filters or add a new table</p>
        </div>
      )}

      {/* Floating Add Table Button */}
      {['owner', 'admin'].includes(profile?.role || '') && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleAddTable}
          className="fixed bottom-10 right-6 w-16 h-16 bg-rose-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-rose-600 transition-colors z-40"
        >
          {processing ? <Loader2 className="animate-spin" /> : <Plus size={32} />}
        </motion.button>
      )}

      {/* Recent Activity Section */}
      <div className="mt-16 space-y-6">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                  <History size={18} />
               </div>
               <h3 className="text-lg font-black text-slate-800 tracking-tight">Recent Activity</h3>
            </div>
            <button className="text-[10px] font-black uppercase text-indigo-600 hover:underline">View All</button>
         </div>

         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            {activeOrders.slice(0, 5).map(o => (
              <div key={o.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setViewingOrder(o.id!)}>
                 <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      o.orderStatus === 'billed' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {o.tableNumber}
                    </div>
                    <div>
                       <p className="text-xs font-black text-slate-800">₹{o.totalAmount} • {o.items.length} Items</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                         {o.captainName} • {o.orderStatus.toUpperCase()}
                       </p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                       {o.timestamp?.seconds ? formatDistanceToNow(o.timestamp.toDate(), { addSuffix: true }) : 'just now'}
                    </p>
                    <ChevronRight size={14} className="text-slate-300 ml-auto mt-1" />
                 </div>
              </div>
            ))}
            {activeOrders.length === 0 && (
              <div className="p-12 text-center">
                 <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No Recent Activity</p>
              </div>
            )}
         </div>
      </div>

      {/* Legend Footer (Only for Desktop/Tablet) */}
      <div className="hidden md:flex flex-wrap gap-8 items-center justify-center pt-12 mt-12 border-t border-slate-100 overflow-x-auto no-scrollbar">
          {[
            { label: 'Available', color: 'bg-emerald-500' },
            { label: 'Running', color: 'bg-amber-500' },
            { label: 'Billed', color: 'bg-purple-500' },
            { label: 'Reserved', color: 'bg-blue-500' }
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2 whitespace-nowrap">
              <div className={`w-2 h-2 rounded-full ${l.color}`}></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{l.label}</span>
            </div>
          ))}
      </div>

      {/* Mode Indicators */}
      <AnimatePresence>
        {(isShiftMode || isMergeMode) && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-24 left-4 right-4 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-50 border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                {isShiftMode ? <RotateCcw /> : <Combine />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">
                  {isShiftMode ? 'Shifting Mode Active' : 'Merging Mode Active'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold">
                  {isShiftMode ? 'Select target table to move order' : 'Select target table to combine orders'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => { setIsShiftMode(null); setIsMergeMode(null); }}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Viewer Drawer */}
      <AnimatePresence>
        {viewingOrder && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setViewingOrder(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl overflow-hidden flex flex-col"
            >
              <DashboardOrderViewer 
                orderId={viewingOrder} 
                onClose={() => setViewingOrder(null)} 
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Billing Drawer */}
      <AnimatePresence>
        {isBilling && (
           <DashboardBillingDrawer 
             orderId={isBilling} 
             onClose={() => setIsBilling(null)} 
           />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const DashboardOrderViewer = ({ orderId, onClose }: { orderId: string, onClose: () => void }) => {
  const { activeOrders, updateOrderItems, cancelOrder, generateBill } = useOrderStore();
  const order = activeOrders.find(o => o.id === orderId);
  const [processing, setProcessing] = useState(false);

  if (!order) return (
    <div className="p-8 flex flex-col items-center justify-center h-full">
      <Loader2 className="animate-spin text-indigo-500 mb-4" />
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Order...</p>
    </div>
  );

  const handleQtyChange = async (idx: number, delta: number) => {
    const items = [...order.items];
    const item = { ...items[idx] };
    const newQty = Math.max(0, item.quantity + delta);
    
    if (newQty === 0) {
      if (!confirm("Are you sure you want to remove this item?")) return;
      item.status = 'cancelled';
    } else {
      item.quantity = newQty;
    }
    
    items[idx] = item;
    setProcessing(true);
    await updateOrderItems(orderId, items);
    setProcessing(false);
  };

  const handleBillRequest = async () => {
    setProcessing(true);
    try {
      await generateBill(orderId, { discountAmount: 0, serviceChargeAmount: 0 });
      onClose();
    } catch (e) {
      toast.error("Billing failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Table {order.tableNumber}</h3>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
            Order: {orderId.slice(-6).toUpperCase()} • Captain: {order.captainName}
          </p>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100">
           <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
           <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-50">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Items</span>
              <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-tighter rounded-md">
                 {order.items.filter(i => i.status !== 'cancelled').length} Items
              </span>
           </div>

           <div className="space-y-4">
             {order.items.length === 0 ? (
               <p className="text-[10px] text-center text-slate-300 py-4 font-bold">No items ordered yet</p>
             ) : (
               order.items.map((item, idx) => (
                 <div key={idx} className={`flex items-center justify-between gap-4 ${item.status === 'cancelled' ? 'opacity-30' : ''}`}>
                    <div className="min-w-0">
                       <p className={`text-xs font-black text-slate-800 tracking-tight leading-tight ${item.status === 'cancelled' ? 'line-through' : ''}`}>
                         {item.itemName}
                       </p>
                       <p className="text-[9px] font-bold text-slate-400">₹{item.price} • {item.status.toUpperCase()}</p>
                    </div>
                    
                    {item.status !== 'cancelled' && (
                      <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                         <button 
                           onClick={() => handleQtyChange(idx, -1)}
                           className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-rose-500 shadow-sm"
                         >
                           <Minus size={14} />
                         </button>
                         <span className="text-xs font-black text-slate-800 w-6 text-center">{item.quantity}</span>
                         <button 
                           onClick={() => handleQtyChange(idx, 1)}
                           className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm"
                         >
                           <Plus size={14} />
                         </button>
                      </div>
                    )}
                 </div>
               ))
             )}
           </div>
        </div>

        {/* Timeline placeholder - in real app would use kotHistory */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-4">Order Timeline</span>
           <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
              <div className="relative pl-6">
                 <div className="absolute left-0 top-1 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                 </div>
                 <p className="text-[10px] font-black text-slate-800">Order Created</p>
                 <p className="text-[8px] font-bold text-slate-400">Initial session started</p>
              </div>
              {order.kotHistory?.map((kot, k) => (
                <div key={k} className="relative pl-6">
                 <div className="absolute left-0 top-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Printer size={8} className="text-white" />
                 </div>
                 <p className="text-[10px] font-black text-slate-800">KOT {k + 1} Sent</p>
                 <p className="text-[8px] font-bold text-slate-400">{kot.items.length} items printed</p>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
         <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Running Total</span>
            <span className="text-xl font-black text-slate-900">₹{order.totalAmount}</span>
         </div>
         <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                const { loadOrderToCart } = useOrderStore.getState();
                loadOrderToCart(order);
                // We'd need navigate here, but we pass it down or use a wrapper. 
                // For simplicity let's rely on Dashboard navigate but we are in sub-component.
                // Better to just notify Dashboard.
                window.location.hash = '/menu'; // Rough navigate
              }}
              className="py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Add Items
            </button>
            <button 
              onClick={handleBillRequest}
              disabled={processing}
              className="py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
            >
              {processing ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />} Generate Bill
            </button>
         </div>
      </div>
    </div>
  );
};

const DashboardBillingDrawer = ({ orderId, onClose }: { orderId: string, onClose: () => void }) => {
  const { activeOrders, generateBill, settlePayment } = useOrderStore();
  const { tables } = useTableStore();
  const { profile } = useAuthStore();
  const order = activeOrders.find(o => o.id === orderId);

  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [payments, setPayments] = useState<{method: 'CASH' | 'CARD' | 'UPI', amount: number}[]>([]);
  const [splitPax, setSplitPax] = useState<number>(1);

  useEffect(() => {
    if (order) {
      setDiscountValue(order.discountAmount || 0);
      setServiceCharge(order.serviceChargeAmount || 0);
      if (order.orderStatus === 'billed' || order.orderStatus === 'generated') {
         setPayments([{ method: 'CASH', amount: Math.round(order.finalAmount || order.totalAmount) }]);
      }
    }
  }, [order]);

  if (!order) return null;

  const subtotal = order.subtotal || order.totalAmount;
  const calculatedDiscount = discountType === 'PERCENT' ? Math.round((subtotal * discountValue) / 100) : discountValue;
  const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
  const gst = taxableAmount * 0.05;
  const grandTotal = taxableAmount + gst + serviceCharge;
  const roundedTotal = Math.round(grandTotal);

  const isSufficientPaid = payments.reduce((sum, p) => sum + p.amount, 0) >= roundedTotal;

  const handleGenerateBill = async () => {
    setProcessing(true);
    try {
      await generateBill(orderId, { discountAmount: calculatedDiscount, serviceChargeAmount: serviceCharge });
    } catch (e) {
      toast.error("Billing failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleSettle = async () => {
    setProcessing(true);
    try {
      const table = tables.find(t => t.id === order.tableId);
      await settlePayment(orderId, table?.id || order.tableId, payments);
      onClose();
    } catch (e) {
      toast.error("Settlement failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
           <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">Checkout</h3>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Table {order.tableNumber} • Invoice Draft</p>
           </div>
           <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100">
              <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
           <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Summary</span>
              {order.items.filter(i => i.status !== 'cancelled').map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs font-black text-slate-800">
                   <div className="flex items-center gap-2">
                      <span className="text-indigo-600">x{item.quantity}</span>
                      <span>{item.itemName}</span>
                   </div>
                   <span>₹{item.price * item.quantity}</span>
                </div>
              ))}
              <div className="pt-4 border-t border-slate-50 space-y-2">
                 <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-black text-emerald-500 uppercase">
                    <span>Discount</span>
                    <span>-₹{calculatedDiscount}</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                    <span>GST (5%)</span>
                    <span>₹{gst.toFixed(2)}</span>
                 </div>
              </div>
           </div>

           {(order.orderStatus === 'running' || order.orderStatus === 'pending') ? (
             <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adjustments</span>
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-2">
                      <p className="text-[8px] font-black uppercase text-slate-400">Discount</p>
                      <input 
                        type="number" 
                        value={discountValue} 
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs font-black outline-none"
                        placeholder="Amt"
                      />
                   </div>
                   <div className="space-y-2">
                      <p className="text-[8px] font-black uppercase text-slate-400">Srv Charge</p>
                      <input 
                        type="number" 
                        value={serviceCharge} 
                        onChange={(e) => setServiceCharge(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs font-black outline-none"
                        placeholder="Amt"
                      />
                   </div>
                </div>
             </div>
           ) : (
             <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Settlement</span>
                <div className="space-y-3">
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                       <select 
                         value={p.method}
                         onChange={(e) => {
                           const newPay = [...payments];
                           newPay[idx].method = e.target.value as any;
                           setPayments(newPay);
                         }}
                         className="bg-white px-2 py-1.5 rounded-lg text-[9px] font-black uppercase border border-slate-200 outline-none"
                       >
                         <option>CASH</option>
                         <option>CARD</option>
                         <option>UPI</option>
                       </select>
                       <input 
                         type="number"
                         value={p.amount}
                         onChange={(e) => {
                           const newPay = [...payments];
                           newPay[idx].amount = Number(e.target.value);
                           setPayments(newPay);
                         }}
                         className="flex-1 bg-white px-3 py-1.5 rounded-lg text-xs font-black border border-slate-200 outline-none"
                       />
                    </div>
                  ))}
                  <button onClick={() => setPayments([...payments, { method: 'CASH', amount: 0 }])} className="text-[9px] font-black uppercase text-indigo-600">+ Add Method</button>
                </div>
             </div>
           )}

           <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total Payable</span>
              <div className="flex items-end gap-2 mt-1">
                 <h2 className="text-4xl font-black italic tracking-tighter">₹{roundedTotal}</h2>
                 <p className="text-[10px] font-black opacity-60 mb-1.5 uppercase tracking-widest">Inclusive of taxes</p>
              </div>
           </div>

           <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pax Split (Quick Tool)</span>
              <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => setSplitPax(s => Math.max(1, s-1))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-400"><Minus size={14}/></button>
                    <span className="w-8 text-center text-xs font-black">{splitPax}</span>
                    <button onClick={() => setSplitPax(s => s+1)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-400"><Plus size={14}/></button>
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Per Guest</p>
                    <p className="text-lg font-black text-slate-900 italic">₹{Math.round(roundedTotal/splitPax)}</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-100 grid grid-cols-2 gap-3">
           { (order.orderStatus === 'running' || order.orderStatus === 'pending') ? (
             <button 
               onClick={handleGenerateBill}
               disabled={processing}
               className="col-span-2 py-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50"
             >
               {processing ? <Loader2 className="animate-spin inline mr-2" size={14}/> : <Receipt className="inline mr-2" size={14}/>} 
               Generate Bill
             </button>
           ) : (
             <>
               <button 
                 onClick={async () => {
                    try {
                      await printQueueService.queuePrint({
                        type: 'BILL',
                        orderId: order.id!,
                        tableNumber: order.tableNumber,
                        restaurantId: order.restaurantId,
                        total: roundedTotal,
                        requestedBy: profile?.name || 'Captain'
                      });
                      toast.success("Bill request sent to server");
                    } catch (e) {
                      toast.error("Print request failed");
                    }
                  }}
                 className="py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
               >
                 <Printer size={14} /> Print
               </button>
               <button 
                 onClick={handleSettle}
                 disabled={processing || !isSufficientPaid}
                 className="py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
               >
                 {processing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Settle
               </button>
             </>
           )}
        </div>
      </motion.div>
    </>
  );
};

export default Dashboard;

