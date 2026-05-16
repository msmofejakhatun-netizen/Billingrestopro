import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, limit, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export interface Customer {
  id?: string;
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
  lastVisit?: any;
}

class CustomerService {
  async getOrCreateCustomer(restaurantId: string, phone: string, name: string) {
    try {
      const q = query(
        collection(db, 'customers'),
        where('restaurantId', '==', restaurantId),
        where('phone', '==', phone)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Customer;
      }

      const newCustomer: Customer = {
        restaurantId,
        name,
        phone,
        loyaltyPoints: 0,
        totalSpent: 0,
        visitCount: 0
      };

      const docRef = await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        createdAt: serverTimestamp()
      });

      return { id: docRef.id, ...newCustomer };
    } catch (error) {
      console.error("Customer Lookup Failed:", error);
      return null;
    }
  }

  async recordVisit(customerId: string, amount: number) {
    const pointsToAdd = Math.floor(amount / 100); // 1 point per 100 rupees
    try {
      const customerRef = doc(db, 'customers', customerId);
      await updateDoc(customerRef, {
        loyaltyPoints: increment(pointsToAdd),
        totalSpent: increment(amount),
        visitCount: increment(1),
        lastVisit: serverTimestamp()
      });
      toast.success(`Loyalty Points Updated: +${pointsToAdd}`);
    } catch (e) {
      console.error(e);
    }
  }

  async redeemPoints(customerId: string, points: number) {
    try {
      const customerRef = doc(db, 'customers', customerId);
      await updateDoc(customerRef, {
        loyaltyPoints: increment(-points)
      });
      toast.success(`${points} points redeemed!`);
    } catch (e) {
      toast.error("Failed to redeem points");
    }
  }

  getWhatsAppLink(phone: string, message: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
}

export const customerService = new CustomerService();
