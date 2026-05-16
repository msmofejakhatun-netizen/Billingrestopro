import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { Calendar, Users, Clock, Check, X, Plus } from 'lucide-react';
import { format, addDays, startOfToday, isSameDay } from 'date-fns';
import { toast } from 'sonner';

const Reservations = () => {
  const { profile } = useAuthStore();
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [showForm, setShowForm] = useState(false);
  
  // Basic booking form state
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    guestCount: 2,
    reservationTime: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });

  useEffect(() => {
    fetchReservations();
  }, [selectedDate]);

  const fetchReservations = async () => {
    // Basic fetch - would need better indexing
    const q = query(collection(db, 'reservations'), where('restaurantId', '==', profile?.restaurantId));
    const querySnapshot = await getDocs(q);
    setReservations(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'reservations'), {
        ...formData,
        restaurantId: profile?.restaurantId,
        status: 'pending',
        createdAt: serverTimestamp(),
        reservationTime: new Date(formData.reservationTime)
      });
      toast.success("Reservation request sent!");
      setShowForm(false);
      fetchReservations();
    } catch (error) {
      console.error(error);
      toast.error("Failed to book reservation");
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <header className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-800">Reservations</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">
          <Plus size={16} /> New Booking
        </button>
      </header>

      {/* Basic Date Picker */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[0, 1, 2, 3, 4, 5, 6].map(i => {
           const date = addDays(startOfToday(), i);
           return (
             <button key={i} onClick={() => setSelectedDate(date)} className={`p-3 rounded-xl border ${isSameDay(date, selectedDate) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent'}`}>
                <div className="text-[10px] font-bold uppercase">{format(date, 'EEE')}</div>
                <div className="text-lg font-black">{format(date, 'dd')}</div>
             </button>
           );
        })}
      </div>

      <div className="space-y-3">
        {reservations.length === 0 && <p className="text-center text-slate-400 py-10">No reservations for this period.</p>}
        {reservations.map(res => (
          <div key={res.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">{res.customerName}</p>
              <p className="text-xs text-slate-500">{format(res.reservationTime.toDate(), 'HH:mm')}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${res.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {res.status}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleBooking} className="bg-white p-6 rounded-3xl w-full max-w-sm space-y-4">
            <h3 className="font-black text-lg">New Reservation</h3>
            <input required placeholder="Customer Name" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, customerName: e.target.value})} />
            <input type="datetime-local" className="w-full p-3 border rounded-xl" onChange={e => setFormData({...formData, reservationTime: e.target.value})} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-slate-500">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white">Book</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Reservations;
