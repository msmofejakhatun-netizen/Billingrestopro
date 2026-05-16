import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export type AuditAction = 
  | 'BILL_GENERATED' 
  | 'ORDER_CANCELLED' 
  | 'PRICE_MODIFIED' 
  | 'SETTING_CHANGED' 
  | 'LOGIN_SUCCESS' 
  | 'SYNC_TRIGGERED'
  | 'KOT_PRINTED';

export interface AuditLog {
  id?: string;
  restaurantId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  details: string;
  metadata?: any;
  timestamp: any;
  ipAddress?: string;
  deviceInfo?: string;
}

class AuditService {
  async log(restaurantId: string, action: AuditAction, details: string, metadata?: any) {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await addDoc(collection(db, 'auditLogs'), {
        restaurantId,
        userId: user.uid,
        userName: user.displayName || user.email || 'Anonymous',
        action,
        details,
        metadata: metadata || {},
        timestamp: serverTimestamp(),
        deviceInfo: navigator.userAgent
      });
    } catch (error) {
      console.error("Audit Logging Failed:", error);
    }
  }

  subscribeToLogs(restaurantId: string, callback: (logs: AuditLog[]) => void) {
    const q = query(
      collection(db, 'auditLogs'),
      where('restaurantId', '==', restaurantId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
      callback(logs);
    });
  }
}

export const auditService = new AuditService();
