import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { socketService } from './socketService';

export type PrintTaskType = 'KOT' | 'BILL' | 'SETTLEMENT';

interface PrintTask {
  type: PrintTaskType;
  orderId: string;
  tableNumber: string;
  restaurantId: string;
  items?: any[];
  total?: number;
  requestedBy: string;
  printerTarget?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: any;
}

class PrintQueueService {
  async queuePrint(task: Omit<PrintTask, 'status' | 'createdAt'>) {
    try {
      // 1. Add to Firestore for persistent tracking
      const docRef = await addDoc(collection(db, 'printQueue'), {
        ...task,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 2. Emit via Socket for immediate local action
      socketService.emitPrintRequest(task.restaurantId, {
        ...task,
        id: docRef.id
      });

      return docRef.id;
    } catch (error) {
      console.error("Failed to queue print:", error);
      throw error;
    }
  }
}

export const printQueueService = new PrintQueueService();
