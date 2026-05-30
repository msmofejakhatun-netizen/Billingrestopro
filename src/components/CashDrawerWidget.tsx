import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const CashDrawerWidget = ({ 
  restaurantId,
  openingCash, 
  cashSales, 
  cashDrops, 
  expenses 
}: { 
  restaurantId: string,
  openingCash: number, 
  cashSales: number, 
  cashDrops: number, 
  expenses: number 
}) => {
  const expectedCash = openingCash + cashSales - cashDrops - expenses;
  const [actualCash, setActualCash] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  
  // Periodically push expected cash balance to Firestore
  useEffect(() => {
    if (!restaurantId) return;
    const pushToLogs = async () => {
      try {
        await addDoc(collection(db, 'drawerLogs'), {
          restaurantId,
          expectedCash,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error('Failed to log drawer balance:', err);
        handleFirestoreError(err, OperationType.CREATE, 'drawerLogs');
      }
    };

    // Initial push and then every 60 seconds
    pushToLogs();
    const interval = setInterval(pushToLogs, 60000);
    return () => clearInterval(interval);
  }, [restaurantId, expectedCash]);
  
  // Fetch drawer balance logs for last 24 hours
  useEffect(() => {
    if (!restaurantId) return;
    const q = query(
      collection(db, 'drawerLogs'),
      where('restaurantId', '==', restaurantId),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const data: any[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      // filter last 24h safely
      const now = new Date().getTime();
      const last24h = data.filter(log => {
        if (!log.timestamp || typeof log.timestamp.toDate !== 'function') return false;
        try {
          return log.timestamp.toDate().getTime() > now - 24 * 60 * 60 * 1000;
        } catch (e) {
          return false;
        }
      });
      setLogs(last24h.map(log => {
        let timeLabel = '';
        try {
          timeLabel = log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          timeLabel = '--:--';
        }
        return {
          ...log,
          time: timeLabel
        };
      }));
    }, (err) => {
      console.error('Failed to fetch drawer balance logs:', err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'drawerLogs');
      } catch (e) {
        // Suppress nested exceptions in callback
      }
    });
  }, [restaurantId]);
  
  const actual = Number(actualCash) || 0;
  const diff = actual - expectedCash;
  const status = diff === 0 ? 'Balanced' : (diff < 0 ? 'Shortage' : 'Excess');
  const statusColor = diff === 0 ? 'text-emerald-600' : (diff < 0 ? 'text-rose-600' : 'text-amber-600');
  const bgStatusColor = diff === 0 ? 'bg-emerald-50' : (diff < 0 ? 'bg-rose-50' : 'bg-amber-50');

  return (
    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-black text-slate-800">Cash Drawer</h3>
        <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${bgStatusColor} ${statusColor}`}>
          {status}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-black">Expected</p>
          <p className="text-xl font-black text-slate-800">₹{expectedCash.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-black">Actual</p>
          <input 
            type="number"
            className="w-full text-xl font-black text-indigo-600 border-none bg-slate-50 rounded-lg p-1 outline-none focus:bg-indigo-50"
            value={actualCash}
            onChange={(e) => setActualCash(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      
      {/* Trend Chart */}
      <div className="h-32 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={logs}>
            <Tooltip />
            <Line type="monotone" dataKey="expectedCash" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {diff !== 0 && (
         <div className={`flex items-center gap-2 p-2 rounded-lg text-[10px] font-bold ${bgStatusColor} ${statusColor}`}>
            <AlertCircle size={12}/>
            <span>Difference: ₹{Math.abs(diff).toFixed(0)} ({status})</span>
         </div>
      )}
    </div>
  );
};
