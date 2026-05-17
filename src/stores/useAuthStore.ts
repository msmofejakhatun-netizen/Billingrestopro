import { create } from 'zustand';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'captain';
  restaurantId?: string;
  createdBy?: string;
  active: boolean;
  phone?: string;
  defaultPrinterName?: string;
  printerAddress?: string;
  printerType?: 'BT' | 'USB';
  permissions?: {
    canEditOrder?: boolean;
    canCancelOrder?: boolean;
    canGenerateBill?: boolean;
    canApplyDiscount?: boolean;
    canReprintKOT?: boolean;
    canPrinterAccess?: boolean;
    canCancelBill?: boolean;
  };
}

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  subscribeProfile: () => () => void;
  setRestaurant: (restaurantId: string) => Promise<void>;
  signOut: () => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  signOut: async () => {
    try {
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      await firebaseSignOut(auth);
      
      // Clear all stores and state
      set({ user: null, profile: null, loading: false });
      
      // Clear all browser storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Force redirect to landing/login
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  },
  updateProfile: async (data: Partial<UserProfile>) => {
    const { user, profile } = get();
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, { ...profile, ...data }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));
    set({ profile: { ...profile, ...data } as UserProfile });
  },
  continueAsGuest: async () => {
    set({ loading: true });
    try {
      const { signInAnonymously } = await import('firebase/auth');
      await signInAnonymously(auth);
    } catch (error) {
      console.error(error);
      set({ loading: false });
      throw error;
    }
  },
  subscribeProfile: () => {
    const { user } = get();
    if (!user) return () => {};
    const docRef = doc(db, 'users', user.uid);
    
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          set({ profile: docSnap.data() as UserProfile });
        }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });
  },
  init: () => {
    if (get().initialized) return;
    
    onAuthStateChanged(auth, async (user) => {
      set({ user, loading: !!user });
      
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        // Use onSnapshot for real-time profile updates
        const unsubscribe = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            
            // AUTOMATIC RECOVERY: If owner/admin is missing restaurantId, try to find it
            if (!profileData.restaurantId && (profileData.role === 'owner' || profileData.role === 'admin')) {
               console.log('Attempting automatic restaurantId recovery for:', profileData.email);
               const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
               const resQuery = query(
                 collection(db, 'restaurants'), 
                 where('ownerId', '==', user.uid),
                 limit(1)
               );
               try {
                 const resSnap = await getDocs(resQuery);
                 if (!resSnap.empty) {
                    const foundId = resSnap.docs[0].id;
                    await setDoc(docRef, { restaurantId: foundId }, { merge: true });
                    profileData.restaurantId = foundId;
                    console.log('Recovered restaurantId:', foundId);
                 } else {
                    console.warn('No restaurant found under this owner account.');
                 }
               } catch (e) {
                 console.error('Migration failed:', e);
               }
            }
            
            set({ profile: profileData, loading: false });
          } else {
            // Auto-bootstrap for owner
            const devEmail = 'darbesh789@gmail.com';
            const defaultOwnerEmail = 'owner@captainpro.com';
            const demoEmail1 = 'demo@gmail.co';
            const demoEmail2 = 'demo@gmail.com';
            
            const isAutoBootstrapEmail = [devEmail, defaultOwnerEmail, demoEmail1, demoEmail2].includes(user.email?.toLowerCase() || '');

            if (isAutoBootstrapEmail) {
              const defaultProfile: UserProfile = {
                uid: user.uid,
                name: user.displayName || "Super Owner",
                email: user.email!,
                role: "owner",
                active: true
              };
              
              const resId = `RESTO-${Math.floor(1000 + Math.random() * 9000)}`;
              
              // Bootstrap restaurant if not exists
              const resDoc = doc(db, 'restaurants', resId);
              await setDoc(resDoc, {
                id: resId,
                restaurantName: "My RestoPro Enterprise",
                restaurantCode: resId,
                ownerId: user.uid,
                ownerEmail: user.email,
                active: true,
                subscriptionPlan: 'pro',
                subscriptionStatus: 'trial',
                licenseKey: `RP-TRIAL-${resId}`,
                captainLimit: 10,
                deviceLimit: 3,
                createdAt: serverTimestamp()
              }).catch(e => handleFirestoreError(e, OperationType.CREATE, `restaurants/${resId}`));

              defaultProfile.restaurantId = resId;
              await setDoc(docRef, defaultProfile).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`));
              set({ profile: defaultProfile, loading: false });
            } else {
              set({ loading: false });
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          set({ loading: false });
        });
      } else {
        set({ profile: null, loading: false });
      }
      set({ initialized: true });
    });
  },
  setRestaurant: async (restaurantId: string) => {
    const { profile, user } = get();
    if (user && profile) {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { ...profile, restaurantId }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));
    }
  },
}));
