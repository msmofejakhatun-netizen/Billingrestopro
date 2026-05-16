import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XOctagon, Search, Filter, Calendar, Printer, 
  ChevronRight, ArrowDownRight, AlertTriangle, 
  User, MapPin, ClipboardList, Info, FileDown, 
  Trash2, XCircle, Ban
} from 'lucide-react';
import { format } from 'date-fns';
import { CancellationLog } from '../stores/useOrderStore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const CancellationReports: React.FC = () => {
  const { profile } = useAuthStore();
  const [logs, setLogs] = useState<CancellationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<string>('all');
  const [filterActor, setFilterActor] = useState<string>('all');

  useEffect(() => {
    if (!profile?.restaurantId) return;

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (dateRange === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (dateRange === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (dateRange === 'custom') {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const q = query(
      collection(db, 'cancellationLogs'),
      where('restaurantId', '==', profile.restaurantId),
      where('cancellationTime', '>=', Timestamp.fromDate(startDate)),
      where('cancellationTime', '<=', Timestamp.fromDate(endDate)),
      orderBy('cancellationTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CancellationLog));
      setLogs(logData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cancellationLogs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.restaurantId, dateRange]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.tableNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.cancelledByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.orderId?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || log.cancellationType === filterType;
      const matchesActor = filterActor === 'all' || log.cancelledById === filterActor;

      return matchesSearch && matchesType && matchesActor;
    });
  }, [logs, searchTerm, filterType, filterActor]);

  const stats = useMemo(() => {
    const totalAmount = filteredLogs.reduce((sum, log) => {
      const before = log.orderTotalBefore || 0;
      const after = log.orderTotalAfter || 0;
      return sum + (before - after);
    }, 0);
    const itemCancellations = filteredLogs.filter(l => l.cancellationType === 'Item Cancel').length;
    const billVoids = filteredLogs.filter(l => l.cancellationType === 'Bill Void').length;
    
    // Most cancelled item
    const itemCounts: Record<string, number> = {};
    filteredLogs.forEach(log => {
      if (log.itemName) {
        itemCounts[log.itemName] = (itemCounts[log.itemName] || 0) + 1;
      }
    });
    const mostCancelledItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Most active actor
    const actorCounts: Record<string, { name: string, count: number }> = {};
    filteredLogs.forEach(log => {
      if (log.cancelledById) {
        if (!actorCounts[log.cancelledById]) actorCounts[log.cancelledById] = { name: log.cancelledByName, count: 0 };
        actorCounts[log.cancelledById].count += 1;
      }
    });
    const mostActiveActor = Object.values(actorCounts).sort((a, b) => b.count - a.count)[0]?.name || 'N/A';

    return { totalAmount, itemCancellations, billVoids, mostCancelledItem, mostActiveActor };
  }, [filteredLogs]);

  const actors = useMemo(() => {
    const uniqueActorsMap = new Map();
    logs.forEach(log => {
      uniqueActorsMap.set(log.cancelledById, log.cancelledByName);
    });
    return Array.from(uniqueActorsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const headers = ['Time', 'Actor', 'Target', 'Item', 'Qty', 'Reason', 'Type', 'Amount Before', 'Amount After'];
    const csvData = filteredLogs.map(log => [
      log.cancellationTime ? format(log.cancellationTime.toDate(), 'yyyy-MM-dd HH:mm:ss') : '',
      log.cancelledByName,
      `T-${log.tableNumber}`,
      `"${log.itemName || 'Entire Order'}"`,
      log.cancelledQuantity || '',
      `"${log.cancellationReason}"`,
      log.cancellationType,
      log.orderTotalBefore,
      log.orderTotalAfter
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cancellation_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <XOctagon size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Cancellation Audit</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Security and Loss Prevention Logs</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer size={16} />
            Print Report
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
          >
            <FileDown size={16} />
            Export CSV / Excel
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Cancelled Amount', value: `₹${stats.totalAmount.toLocaleString()}`, icon: ArrowDownRight, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Total Cancelled Orders', value: filteredLogs.filter(l => l.cancellationType === 'Full Order Cancel' || l.cancellationType === 'Bill Void').length, icon: Ban, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Item Level Cancels', value: stats.itemCancellations, icon: Trash2, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Most Cancelled Item', value: stats.mostCancelledItem, icon: ClipboardList, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Most Active Captain', value: stats.mostActiveActor, icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${stat.bg} p-6 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden group`}
          >
            <div className={`w-10 h-10 ${stat.color} bg-white rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className={`text-xl font-black ${stat.color} truncate`}>{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by item, table, captain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-rose-500 transition-all"
            />
          </div>

          <div className="md:col-span-1">
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none appearance-none cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          {dateRange === 'custom' && (
            <>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-rose-500 transition-all"
                />
                <span className="absolute -top-2 left-4 bg-white px-1 text-[8px] font-bold text-slate-400 uppercase">From</span>
              </div>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-rose-500 transition-all"
                />
                <span className="absolute -top-2 left-4 bg-white px-1 text-[8px] font-bold text-slate-400 uppercase">To</span>
              </div>
            </>
          )}

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="Item Cancel">Item Cancel</option>
              <option value="Full Order Cancel">Full Order Cancel</option>
              <option value="Bill Void">Bill Void</option>
              <option value="Quantity Reduce">Quantity Reduce</option>
            </select>
          </div>

          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none appearance-none cursor-pointer uppercase"
            >
              <option value="all">All Personnel</option>
              {actors.map(actor => (
                <option key={actor.id} value={actor.id}>{actor.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Time / Actor</th>
                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Target / Info</th>
                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason</th>
                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {filteredLogs.map((log) => (
                  <motion.tr 
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`hover:bg-slate-50/50 transition-colors border-l-4 ${(log.cancellationType === 'Full Order Cancel' || log.cancellationType === 'Bill Void') ? 'bg-rose-50/30 border-l-rose-500' : 'border-l-transparent'}`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                          {log.cancelledByName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.cancelledByName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-0.5">
                            {log.cancellationTime ? format(log.cancellationTime.toDate(), 'HH:mm:ss') : 'Just now'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase">T-{log.tableNumber}</span>
                        <span className="text-[10px] font-bold text-slate-400">Order: {log.orderId?.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 uppercase">
                        {log.itemName ? `${log.itemName} (x${log.cancelledQuantity})` : 'Entire Order'}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                          <AlertTriangle size={12} />
                        </div>
                        <p className="text-xs font-bold text-slate-500">{log.cancellationReason}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        log.cancellationType === 'Item Cancel' ? 'bg-amber-100 text-amber-600' :
                        log.cancellationType === 'Bill Void' ? 'bg-indigo-100 text-indigo-600' :
                        'bg-rose-100 text-rose-600'
                      }`}>
                        {log.cancellationType}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="space-y-0.5">
                        <div className="flex flex-col items-end">
                          <p className={`text-xs font-black ${
                            (log.cancellationType === 'Full Order Cancel' || log.cancellationType === 'Bill Void' || log.cancellationType.includes('Cancel')) 
                            ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg' 
                            : 'text-rose-500'
                          }`}>
                            {log.orderTotalAfter === 0 && log.orderTotalBefore && log.orderTotalBefore > 0 ? 'TOTAL LOSS: ' : '-'}
                            ₹{((log.orderTotalBefore || 0) - (log.orderTotalAfter || 0)).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Before: ₹{log.orderTotalBefore?.toLocaleString() || 0}</span>
                            <ChevronRight size={8} className="text-slate-300" />
                            <span className="text-[9px] font-black text-slate-600 uppercase">After: ₹{log.orderTotalAfter?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="p-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-[1.5rem] flex items-center justify-center mx-auto">
              <ClipboardList size={32} />
            </div>
            <div>
              <p className="text-slate-900 font-black uppercase tracking-tight">No cancellations found</p>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Try adjusting your filters or date range</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CancellationReports;
