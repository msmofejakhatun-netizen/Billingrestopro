import { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { Settings as SettingsIcon, Save, Key } from 'lucide-react';
import { toast } from 'sonner';

const SettingsScreen = () => {
  const { profile, updateProfile } = useAuthStore();
  const [name, setName] = useState(profile?.name || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateProfile({ name });
      toast.success('Profile updated successfully');
    } catch (e) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-6">
      <header>
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
          <SettingsIcon size={32} className="text-indigo-600" />
          Settings
        </h2>
      </header>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Display Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-black uppercase py-4 rounded-2xl hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : <><Save size={16}/> Save Profile</>}
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="font-bold">Security</h3>
          <button className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase underline">
              <Key size={14}/> Change Password
          </button>
      </div>
    </div>
  );
};

export default SettingsScreen;
