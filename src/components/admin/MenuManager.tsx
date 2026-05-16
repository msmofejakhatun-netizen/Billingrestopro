import React, { useState } from 'react';
import { useMenuStore, Category } from '../../stores/useMenuStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { Plus, Trash2, XCircle, Image as ImageIcon, RefreshCcw, CheckCircle, Search, Filter, X, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const MenuManager = () => {
  const { profile } = useAuthStore();
  const { categories, items, toggleItemAvailability, addMenuItem, deleteMenuItem, addCategory, deleteCategory, updateCategory } = useMenuStore();
  
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newItem, setNewItem] = useState({ itemName: '', price: 0, categoryId: '', image: '' });
  const [newCat, setNewCat] = useState({ name: '', image: '', active: true, displayOrder: 0 });

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    setLoading(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: newCat.name.trim(),
          image: newCat.image.trim(),
          active: newCat.active,
          displayOrder: newCat.displayOrder
        });
        toast.success("Category updated");
      } else {
        await addCategory({ 
          name: newCat.name.trim(), 
          image: newCat.image.trim() || 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=400',
          active: true,
          displayOrder: categories.length
        });
        toast.success("Category added");
      }
      setIsAddingCategory(false);
      setEditingCategory(null);
      setNewCat({ name: '', image: '', active: true, displayOrder: 0 });
    } catch (error) {
       toast.error("Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setNewCat({ 
      name: cat.name, 
      image: cat.image, 
      active: cat.active, 
      displayOrder: cat.displayOrder 
    });
    setIsAddingCategory(true);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMenuItem({ ...newItem, image: newItem.image.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' });
      toast.success("Item added");
      setIsAddingItem(false);
      setNewItem({ itemName: '', price: 0, categoryId: '', image: '' });
    } catch (error) {
      toast.error("Failed to add item");
    }
  };

  const filteredItems = items.filter(i => i.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Culinaria Inventory</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage your digital menu and stock availability</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => setIsAddingCategory(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-500 transition-all"
          >
            <Plus size={16} />
            Category
          </button>
          <button 
            onClick={() => setIsAddingItem(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all"
          >
            <Plus size={18} />
            New Menu Item
          </button>
        </div>
      </div>

      {/* Category List */}
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {categories.length === 0 && !loading && (
          <div className="w-full flex flex-col items-center justify-center p-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No categories found</p>
          </div>
        )}
        {categories.map(cat => (
          <div key={cat.id} className="flex-shrink-0 group relative">
             <div 
               onClick={() => handleEditCategory(cat)}
               className={`w-28 h-28 rounded-3xl bg-white border shadow-sm flex flex-col items-center justify-center gap-2 hover:border-indigo-500 transition-all overflow-hidden p-2 cursor-pointer ${!cat.active ? 'opacity-50 grayscale' : 'border-slate-100'}`}
             >
                <img src={cat.image} alt="" className="w-12 h-12 rounded-full object-cover bg-slate-50" />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter truncate w-full text-center px-2">{cat.name}</span>
                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${cat.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {cat.active ? 'Active' : 'Inactive'}
                </span>
             </div>
             <button 
                onClick={(e) => { e.stopPropagation(); if(confirm('Delete Category?')) deleteCategory(cat.id); }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-rose-100 z-10"
             >
                <X size={12} />
             </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAddingCategory && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">{editingCategory ? 'Edit Category' : 'New Culinary Category'}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Organize your menu for better discovery</p>
                </div>
                <button onClick={() => { setIsAddingCategory(false); setEditingCategory(null); }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Category Label</label>
                  <input 
                    required 
                    placeholder="e.g. Italian Pasta, Street Food..." 
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700" 
                    value={newCat.name}
                    onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Display Order</label>
                    <input 
                      type="number" 
                      placeholder="Order" 
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700" 
                      value={newCat.displayOrder}
                      onChange={e => setNewCat({ ...newCat, displayOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Status</label>
                    <button
                      type="button"
                      onClick={() => setNewCat({ ...newCat, active: !newCat.active })}
                      className={`w-full px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${newCat.active ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100' : 'bg-rose-50 text-rose-600 border-2 border-rose-100'}`}
                    >
                      {newCat.active ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Visual Representation</label>
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-slate-50 rounded-3xl border-2 border-slate-100 overflow-hidden flex-shrink-0">
                      {newCat.image ? <img src={newCat.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={32} className="text-slate-200" /></div>}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input 
                        placeholder="Image URL" 
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700 text-xs" 
                        value={newCat.image}
                        onChange={e => setNewCat({ ...newCat, image: e.target.value })}
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          const kw = ['pizza','burger','dessert','coffee','drink','pasta'][Math.floor(Math.random()*6)];
                          setNewCat({ ...newCat, image: `https://images.unsplash.com/photo-${Math.floor(Math.random()*1000)}?w=400&h=400&fit=crop&q=80&food=${kw}` });
                        }}
                        className="text-[10px] font-black uppercase text-indigo-500 flex items-center gap-2 px-1 hover:text-indigo-600"
                      >
                        <RefreshCcw size={12} /> Auto-select visual
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsAddingCategory(false); setEditingCategory(null); }}
                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCcw size={16} className="animate-spin" /> : (editingCategory ? 'Update Changes' : 'Publish Category')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isAddingItem && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
             <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative">
                <button onClick={() => setIsAddingItem(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><XCircle size={24} /></button>
                <h4 className="text-white font-black uppercase text-sm tracking-widest mb-8">New Culinary Offering</h4>
                <form onSubmit={handleAddItem} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Identity</label>
                        <input 
                            required 
                            placeholder="Item Name" 
                            className="w-full px-6 py-4 bg-slate-800 border border-slate-700 text-white rounded-2xl outline-none focus:border-indigo-500" 
                            value={newItem.itemName}
                            onChange={e => setNewItem({ ...newItem, itemName: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <input 
                                required 
                                type="number" 
                                placeholder="Price" 
                                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 text-white rounded-2xl outline-none focus:border-indigo-500" 
                                value={newItem.price || ''}
                                onChange={e => setNewItem({ ...newItem, price: Number(e.target.value) })}
                            />
                            <select 
                                required 
                                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 text-white rounded-2xl outline-none"
                                value={newItem.categoryId}
                                onChange={e => setNewItem({ ...newItem, categoryId: e.target.value })}
                            >
                                <option value="">Category</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Visual Branding</label>
                        <input 
                            placeholder="Image URL" 
                            className="w-full px-6 py-4 bg-slate-800 border border-slate-700 text-white rounded-2xl outline-none focus:border-indigo-500" 
                            value={newItem.image}
                            onChange={e => setNewItem({ ...newItem, image: e.target.value })}
                        />
                        <button 
                            type="button" 
                            onClick={() => {
                                const kw = ['burger','pizza','pasta'][Math.floor(Math.random()*3)];
                                setNewItem({ ...newItem, image: `https://images.unsplash.com/photo-${Math.floor(Math.random()*1000)}?w=400&h=400&fit=crop&food=${kw}` });
                            }}
                            className="text-xs font-black uppercase text-indigo-400 flex items-center gap-2"
                        >
                            <RefreshCcw size={14} /> Generate Smart Image
                        </button>
                    </div>
                    <div className="bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 relative flex items-center justify-center">
                        {newItem.image ? <img src={newItem.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={48} className="text-slate-700" />}
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button type="submit" className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-indigo-900/40">Launch Item</button>
                  </div>
                </form>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] italic">Department Management</h4>
          <span className="text-[10px] font-mono text-slate-300 font-bold uppercase">{categories.length} Total Departments</span>
        </div>
        
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <AnimatePresence mode="popLayout">
              {categories.slice().sort((a,b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((cat) => (
                <motion.div 
                  key={cat.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`group relative aspect-square rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden ${!cat.active ? 'opacity-40 grayscale' : ''}`}
                >
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent p-5 flex flex-col justify-end">
                    <p className="text-[11px] font-black text-white uppercase tracking-tighter leading-none mb-1">{cat.name}</p>
                    <div className="flex items-center gap-2">
                       <div className={`w-1.5 h-1.5 rounded-full ${cat.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                       <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{cat.active ? 'Live' : 'Hidden'}</span>
                    </div>
                  </div>
                  
                  {/* Actions Overlay */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                    <button 
                      onClick={() => handleEditCategory(cat)}
                      className="p-2 bg-white/90 backdrop-blur text-slate-700 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-lg"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={() => { if(confirm('Delete Category?')) deleteCategory(cat.id); }}
                      className="p-2 bg-white/90 backdrop-blur text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-lg"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 py-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-200 mb-4 shadow-sm">
              <RefreshCcw size={32} />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">No categories listed yet</p>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter mt-1 italic">Click "+ Category" to begin inventory structure</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center">
           <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                placeholder="Search menu items..." 
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-100 outline-none transition-all font-bold text-slate-700"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
           <button className="p-3 px-6 bg-slate-100 text-slate-400 rounded-2xl flex items-center gap-2 hover:bg-slate-200 transition-all font-black text-[10px] uppercase tracking-widest">
              <Filter size={14} />
              Filter
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Ingredient Details</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Line</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Cost</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Cloud Sync</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-black text-slate-700 leading-tight">{item.itemName}</p>
                        <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-tighter">SKU: {item.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{categories.find(c => c.id === item.categoryId)?.name || 'Misc'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-black text-slate-800 italic">₹{item.price}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center">
                       <button 
                        onClick={() => toggleItemAvailability(item.id, !item.available)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${item.available ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'bg-rose-50 text-rose-600'}`}
                       >
                         {item.available ? 'Available' : 'Paused'}
                       </button>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => { if(confirm('Delete Menu Item?')) deleteMenuItem(item.id); }} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MenuManager;
