import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { 
  Utensils, 
  Menu as MenuIcon, 
  Star, 
  ChevronRight, 
  Search,
  ShoppingCart,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const QRMenu = () => {
  const { restaurantId } = useParams();
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  useEffect(() => {
    if (!restaurantId) return;

    const fetchData = async () => {
      try {
        const catSnap = await getDocs(query(collection(db, 'categories'), where('restaurantId', '==', restaurantId), orderBy('order', 'asc')));
        const itemSnap = await getDocs(query(collection(db, 'menuItems'), where('restaurantId', '==', restaurantId), where('active', '==', true)));
        
        setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setMenuItems(itemSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId]);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
       <div className="w-16 h-16 bg-white rounded-3xl shadow-xl shadow-slate-200 flex items-center justify-center text-indigo-600 animate-bounce mb-4">
          <Utensils size={32} />
       </div>
       <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Setting the table...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-900 font-sans pb-24">
      {/* Brand Header */}
      <header className="bg-white px-6 py-10 rounded-b-[3rem] shadow-sm shadow-slate-100 border-b border-slate-50">
         <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-indigo-400 shadow-xl shadow-slate-200">
               <Utensils size={24} />
            </div>
            <div>
               <h1 className="text-2xl font-black tracking-tighter italic uppercase text-slate-900 leading-tight">Gourmet <span className="text-indigo-600">Resto</span></h1>
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">Digital Dining Experience</p>
            </div>
         </div>

         {/* Search */}
         <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600">
               <Search size={18} />
            </div>
            <input 
              type="text"
              placeholder="Hungry for something?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 py-4 pl-12 pr-6 rounded-2xl text-sm font-bold placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-200 transition-all"
            />
         </div>
      </header>

      {/* Category Pills */}
      <div className="px-6 py-8 overflow-x-auto flex gap-3 no-scrollbar shrink-0">
         <button 
           onClick={() => setActiveCategory('all')}
           className={`px-6 py-3 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap transition-all ${
             activeCategory === 'all' ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-400 border border-slate-100'
           }`}
         >
           Everything
         </button>
         {categories.map((cat) => (
           <button 
             key={cat.id}
             onClick={() => setActiveCategory(cat.id)}
             className={`px-6 py-3 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap transition-all ${
               activeCategory === cat.id ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-400 border border-slate-100'
             }`}
           >
             {cat.name}
           </button>
         ))}
      </div>

      {/* Product Grid */}
      <div className="px-6 space-y-6">
         {filteredItems.length === 0 ? (
           <div className="py-20 text-center">
              <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No delicacies found</p>
           </div>
         ) : (
           filteredItems.map((item) => (
             <motion.div 
               layout
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               key={item.id} 
               className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-4 group"
             >
                <div className="w-24 h-24 bg-slate-50 rounded-[2rem] overflow-hidden shrink-0 border border-slate-50">
                   {item.image ? (
                     <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-200">
                        <Utensils size={32} />
                     </div>
                   )}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                   <div className="flex items-start justify-between mb-1">
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.name}</h3>
                      {item.isSpicy && <span className="text-rose-500 text-[10px]">🌶️</span>}
                   </div>
                   <p className="text-[10px] font-medium text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {item.description || 'Artisanally prepared with the finest seasonal ingredients.'}
                   </p>
                   <div className="flex items-center justify-between mt-auto">
                      <span className="text-lg font-black italic text-slate-900 tracking-tighter">₹{item.price}</span>
                      <button className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-110 active:scale-95 transition-all">
                         <Plus size={20} />
                      </button>
                   </div>
                </div>
             </motion.div>
           ))
         )}
      </div>

      {/* Floating Call to Action */}
      <div className="fixed bottom-6 left-6 right-6">
         <button className="w-full bg-slate-900 text-white py-5 rounded-[2rem] shadow-2xl shadow-slate-400 flex items-center justify-center gap-4 hover:bg-slate-800 transition-all border border-white/10 group">
            <div className="relative">
               <ShoppingCart size={20} />
               <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-500 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-slate-900">0</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">View Bill Details</span>
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
         </button>
      </div>
    </div>
  );
};

export default QRMenu;
