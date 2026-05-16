import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export interface Branch {
  id?: string;
  restaurantId: string;
  branchName: string;
  branchCode: string;
  address: string;
  city: string;
  phone: string;
  managerId: string;
  active: boolean;
}

class BranchService {
  async createBranch(restaurantId: string, branchData: Partial<Branch>) {
    try {
      const docRef = await addDoc(collection(db, 'branches'), {
        ...branchData,
        restaurantId,
        active: true,
        createdAt: serverTimestamp()
      });
      toast.success("New branch successfully integrated");
      return docRef.id;
    } catch (e) {
      toast.error("Failed to create branch");
      return null;
    }
  }

  async getBranches(restaurantId: string) {
    const q = query(collection(db, 'branches'), where('restaurantId', '==', restaurantId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
  }
}

export const branchService = new BranchService();
