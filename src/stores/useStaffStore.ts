import { create } from 'zustand';
import { db, auth, secondaryAuth } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, updateDoc, 
  deleteDoc, doc, serverTimestamp, orderBy, setDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { toast } from 'sonner';

export interface StaffUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'captain' | 'owner';
  restaurantId: string;
  active: boolean;
  phone?: string;
  createdAt: any;
}

interface StaffState {
  staff: StaffUser[];
  loading: boolean;
  subscribe: (restaurantId?: string) => () => void;
  createStaff: (data: any) => Promise<void>;
  updateStaff: (uid: string, data: Partial<StaffUser>) => Promise<void>;
  deleteStaff: (uid: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  toggleStatus: (uid: string, active: boolean) => Promise<void>;
}

export const useStaffStore = create<StaffState>((set, get) => ({
  staff: [],
  loading: true,

  subscribe: (restaurantId) => {
    set({ loading: true });
    
    // If restaurantId is provided, filter by it (requested for Admins/Captains)
    // If not (Owner view), fetch all
    const q = restaurantId 
      ? query(collection(db, 'users'), where('restaurantId', '==', restaurantId), orderBy('createdAt', 'desc'))
      : query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const staff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffUser));
      set({ staff, loading: false });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      set({ loading: false });
    });
  },

  createStaff: async (data) => {
    try {
      // Create auth user using secondary auth instance to avoid logout
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
      const uid = userCredential.user.uid;
      
      await secondaryAuth.signOut();

      const userData = {
        uid: uid,
        name: data.name,
        email: data.email.toLowerCase(),
        role: data.role,
        restaurantId: data.restaurantId,
        phone: data.phone || '',
        active: true,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', uid), userData);
      toast.success(`${data.role} created successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      throw error;
    }
  },

  updateStaff: async (uid, data) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success('User updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      throw error;
    }
  },

  deleteStaff: async (uid) => {
    try {
      // Safety check: Don't allow deleting super owners via store
      const superOwners = ['darbesh789@gmail.com', 'owner@captainpro.com'];
      const staffList = get().staff;
      const targetUser = staffList.find(u => u.uid === uid);
      
      if (targetUser && superOwners.includes(targetUser.email.toLowerCase())) {
        throw new Error('SUPER_OWNER_PROTECTION: Root authority accounts cannot be deleted through the orchestration console.');
      }

      await deleteDoc(doc(db, 'users', uid));
      toast.success('User record removed from database');
    } catch (error) {
      if (error instanceof Error && error.message.includes('SUPER_OWNER_PROTECTION')) {
        toast.error(error.message);
        return;
      }
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      throw error;
    }
  },

  toggleStatus: async (uid, active) => {
    try {
      await updateDoc(doc(db, 'users', uid), { active });
      toast.success(`User ${active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      throw error;
    }
  },

  resetPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset link sent to email');
    } catch (error) {
      console.error(error);
      toast.error('Failed to send reset email');
    }
  }
}));
