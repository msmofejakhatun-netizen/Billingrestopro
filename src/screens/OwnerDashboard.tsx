import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, TrendingUp, Users, Building2, Store } from 'lucide-react';
import { useRestaurantStore, Restaurant } from '../stores/useRestaurantStore';
import { useAuthStore } from '../stores/useAuthStore';
import RestaurantCard from '../components/RestaurantCard';
import RestaurantForm from '../components/RestaurantForm';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const OwnerDashboard = () => {
  const { restaurants, subscribe, createRestaurant, updateRestaurant, loading } = useRestaurantStore();
  const { setRestaurant, profile } = useAuthStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = subscribe();
    return () => unsub();
  }, [subscribe]);

  const stats = [
    { label: 'Total Restaurants', value: restaurants.length, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Total Revenue', value: `₹${restaurants.reduce((acc, r) => acc + (r.earnings || 0), 0).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Active', value: restaurants.filter(r => r.active).length, icon: Store, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const filteredRestaurants = restaurants.filter(r => 
    r.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.restaurantCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRestaurant = async (restaurantData: Partial<Restaurant>, adminData: any) => {
    await createRestaurant(restaurantData, adminData);
    setIsFormOpen(false);
  };

  const handleUpdateRestaurant = async (data: Partial<Restaurant>) => {
    if (editingRestaurant) {
      await updateRestaurant(editingRestaurant.id, data);
      setEditingRestaurant(null);
    }
  };

  const handleEnterRestaurant = async (id: string) => {
    await setRestaurant(id);
    navigate('/');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Enterprise System...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Owner Central</h1>
              <p className="text-[10px] font-mono text-indigo-600 uppercase font-bold tracking-widest">Multi-Tenant Management</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-medium"
              />
            </div>
            <button 
              onClick={() => setIsFormOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all text-xs font-black uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" />
              Create New
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5"
            >
              <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{stat.label}</p>
                <div className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Grid Area */}
        {filteredRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard 
                  key={restaurant.id}
                  restaurant={restaurant}
                  onSelect={() => handleEnterRestaurant(restaurant.id)}
                  onEdit={() => setEditingRestaurant(restaurant)}
                  onToggleActive={() => updateRestaurant(restaurant.id, { active: !restaurant.active })}
                  isActive={restaurant.active}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <div>
              <p className="text-lg font-black text-slate-400 uppercase tracking-tight">No restaurants found</p>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Try adjusting your search or create a new one</p>
            </div>
            <button 
              onClick={() => setIsFormOpen(true)}
              className="px-8 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all"
            >
              Configure First Restaurant
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isFormOpen && (
          <RestaurantForm 
            onClose={() => setIsFormOpen(false)}
            onSubmit={handleCreateRestaurant}
          />
        )}
        {editingRestaurant && (
          <RestaurantForm 
            initialData={editingRestaurant}
            onClose={() => setEditingRestaurant(null)}
            onSubmit={handleUpdateRestaurant}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OwnerDashboard;
