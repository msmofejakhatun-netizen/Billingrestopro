import { create } from 'zustand';

export type UserRole = 'SUPER_OWNER' | 'OWNER' | 'ADMIN' | 'CASHIER' | 'CAPTAIN' | 'KITCHEN' | 'MANAGER' | 'super_owner' | 'owner' | 'admin' | 'cashier' | 'captain' | 'kitchen' | 'manager';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  restaurantId?: string;
  createdBy?: string;
  active: boolean;
  phone?: string;
  defaultPrinterName?: string;
  printerAddress?: string;
  printerType?: 'BT' | 'USB';
  permissions?: Record<string, boolean>;
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_OWNER: ['all'],
  super_owner: ['all'],
  OWNER: ['reports', 'billing', 'day_end', 'staff_management', 'menu', 'printer_settings'],
  owner: ['reports', 'billing', 'day_end', 'staff_management', 'menu', 'printer_settings'],
  ADMIN: ['table_management', 'running_orders', 'billing', 'kot', 'settlement', 'customer_management'],
  admin: ['table_management', 'running_orders', 'billing', 'kot', 'settlement', 'customer_management'],
  MANAGER: ['table_management', 'running_orders', 'billing', 'kot', 'settlement', 'customer_management', 'reports', 'day_end', 'staff_management', 'menu'],
  manager: ['table_management', 'running_orders', 'billing', 'kot', 'settlement', 'customer_management', 'reports', 'day_end', 'staff_management', 'menu'],
  CASHIER: ['settlement', 'payment_processing', 'pending_bills'],
  cashier: ['settlement', 'payment_processing', 'pending_bills'],
  CAPTAIN: ['tables', 'add_order', 'kot', 'running_orders'],
  captain: ['tables', 'add_order', 'kot', 'running_orders'],
  KITCHEN: ['kot_view', 'ready_status_update'],
  kitchen: ['kot_view', 'ready_status_update'],
};

export const hasPermission = (profile: UserProfile | null, requiredPermission: string): boolean => {
  if (!profile || !profile.role) return false;
  const normalizedRole = profile.role.toUpperCase() as UserRole;
  if (normalizedRole === 'SUPER_OWNER') return true;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  if (permissions.includes('all')) return true;
  return permissions.includes(requiredPermission);
};

interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  impersonatedProfile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  setUser: (user: any | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setImpersonatedProfile: (profile: UserProfile | null) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  subscribeProfile: () => () => void;
  setRestaurant: (restaurantId: string) => Promise<void>;
  signOut: () => Promise<void>;
  loginREST: (restaurantCode: string, usernameStr: string, passwordStr: string) => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  impersonatedProfile: null,
  loading: true,
  initialized: false,
  error: null,
  setError: (error) => set({ error }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setImpersonatedProfile: (impersonatedProfile) => set({ impersonatedProfile }),
  signOut: async () => {
    try {
      set({ user: null, profile: null, loading: false });
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  },
  updateProfile: async (data: Partial<UserProfile>) => {
    const { profile } = get();
    if (!profile) return;
    const updated = { ...profile, ...data };
    set({ profile: updated });
    localStorage.setItem('restopro_profile', JSON.stringify(updated));
  },
  subscribeProfile: () => {
    return () => {}; // No Firestore subscription needed for static JWT profile
  },
  loginREST: async (restaurantCode, username, password) => {
    set({ loading: true, error: null });
    const payload = { restaurantCode, username, email: username, password };
    console.log("LOGIN_REQUEST:", JSON.stringify(payload));
    try {
      const response = await fetch('/api/captain/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      console.log("LOGIN_RESPONSE:", JSON.stringify(data));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials or connection issue.');
      }

      const captain = data.captain;
      const restaurant = data.restaurant;
      const token = data.accessToken || data.token;
      const refreshToken = data.refreshToken;

      const profileData: UserProfile = {
        uid: data.userId || captain.id,
        name: captain.name,
        email: `${captain.username}@restopro.com`,
        role: (data.role || captain.role) as UserRole,
        restaurantId: data.restaurantId || restaurant.id,
        active: true,
        permissions: data.permissions 
          ? data.permissions.reduce((acc: any, p: string) => ({ ...acc, [p]: true }), {}) 
          : (captain.permissions ? captain.permissions.reduce((acc: any, p: string) => ({ ...acc, [p]: true }), {}) : {})
      };

      set({ 
        user: { uid: profileData.uid, email: profileData.email }, 
        profile: profileData, 
        loading: false 
      });

      localStorage.setItem('restopro_token', token);
      if (refreshToken) {
        localStorage.setItem('restopro_refresh_token', refreshToken);
      }
      localStorage.setItem('restopro_profile', JSON.stringify(profileData));
    } catch (e: any) {
      console.error("LOGIN_ERROR:", e.message || e);
      set({ loading: false, error: e.message });
      throw e;
    }
  },
  init: () => {
    if (get().initialized) return;
    
    const token = localStorage.getItem('restopro_token');
    const storedProfile = localStorage.getItem('restopro_profile');

    if (token && storedProfile) {
      try {
        const profileData = JSON.parse(storedProfile);
        set({ 
          user: { uid: profileData.uid, email: profileData.email }, 
          profile: profileData, 
          loading: false, 
          initialized: true 
        });
        return;
      } catch (e) {
        console.error("Failed to parse stored profile", e);
      }
    }
    
    set({ user: null, profile: null, loading: false, initialized: true });
  },
  setRestaurant: async (restaurantId: string) => {
    const { profile } = get();
    if (profile) {
      const updated = { ...profile, restaurantId };
      set({ profile: updated });
      localStorage.setItem('restopro_profile', JSON.stringify(updated));
    }
  },
}));
