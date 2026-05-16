import { create } from 'zustand';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BillingConfiguration } from '../types/billing';
import { useAuthStore } from './useAuthStore';
import { toast } from 'sonner';

interface ConfigState {
  config: BillingConfiguration | null;
  loading: boolean;
  fetchConfig: (restaurantId: string) => Promise<void>;
  saveConfig: (config: Partial<BillingConfiguration>) => Promise<void>;
  resetToDefaults: (restaurantId: string) => Promise<void>;
}

const DEFAULT_CONFIG: Omit<BillingConfiguration, 'restaurantId'> = {
  restaurantName: '',
  address: '',
  phone: '',
  showLogo: true,
  showGst: true,
  showItemTax: false,
  showCaptainName: true,
  showTableName: true,
  showQrCode: false,
  showUpiQr: false,
  showCustomerCopy: true,
  showKitchenCopy: true,
  paperWidth: '80mm',
  fontSize: 'medium',
  margin: 0,
  autoCut: true,
  boldHeadings: true,
  gstPercentage: 5,
  isGstInclusive: true,
  serviceChargePercentage: 0,
};

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,

  fetchConfig: async (restaurantId) => {
    set({ loading: true });
    try {
      const q = query(collection(db, 'billingConfigurations'), where('restaurantId', '==', restaurantId));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data() as BillingConfiguration;
        set({ config: { ...docData, id: snapshot.docs[0].id }, loading: false });
      } else {
        // Logically we might want to return default if none exists
        set({ config: null, loading: false });
      }
    } catch (e) {
      console.error("Error fetching config:", e);
      set({ loading: false });
    }
  },

  saveConfig: async (configUpdate) => {
    const currentConfig = get().config;
    const profile = useAuthStore.getState().profile;
    if (!profile?.restaurantId) return;

    try {
      if (currentConfig?.id) {
        await updateDoc(doc(db, 'billingConfigurations', currentConfig.id), {
          ...configUpdate,
          updatedAt: serverTimestamp()
        });
        set({ config: { ...currentConfig, ...configUpdate } });
      } else {
        const newDoc = await addDoc(collection(db, 'billingConfigurations'), {
          ...DEFAULT_CONFIG,
          ...configUpdate,
          restaurantId: profile.restaurantId,
          updatedAt: serverTimestamp()
        });
        set({ config: { ...DEFAULT_CONFIG, ...configUpdate, restaurantId: profile.restaurantId, id: newDoc.id } as BillingConfiguration });
      }
      toast.success("Settings saved successfully");
    } catch (e) {
      console.error("Error saving config:", e);
      toast.error("Failed to save settings");
    }
  },

  resetToDefaults: async (restaurantId) => {
    try {
      const currentConfig = get().config;
      if (currentConfig?.id) {
        await updateDoc(doc(db, 'billingConfigurations', currentConfig.id), {
          ...DEFAULT_CONFIG,
          updatedAt: serverTimestamp()
        });
        set({ config: { ...DEFAULT_CONFIG, restaurantId, id: currentConfig.id } as BillingConfiguration });
      } else {
        const newDoc = await addDoc(collection(db, 'billingConfigurations'), {
          ...DEFAULT_CONFIG,
          restaurantId,
          updatedAt: serverTimestamp()
        });
        set({ config: { ...DEFAULT_CONFIG, restaurantId, id: newDoc.id } as BillingConfiguration });
      }
      toast.success("Restored to default settings");
    } catch (e) {
      console.error("Error resetting defaults:", e);
      toast.error("Reset failed");
    }
  }
}));
