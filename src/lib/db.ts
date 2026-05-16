import Dexie, { Table } from 'dexie';

export interface LocalOrder {
  id: string; // Firestore ID if synced, or local temp ID
  localId?: number; // Auto-incrementing local ID
  restaurantId: string;
  tableId: string;
  tableName: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  orderStatus: 'running' | 'billed' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid';
  createdAt: any;
  updatedAt: any;
  synced: 0 | 1; // 0 = pending, 1 = synced
  syncError?: string;
}

export interface LocalTransaction {
  id: string;
  restaurantId: string;
  orderId: string;
  amount: number;
  method: string;
  timestamp: any;
  synced: 0 | 1;
}

export class POSDatabase extends Dexie {
  orders!: Table<LocalOrder>;
  transactions!: Table<LocalTransaction>;

  constructor() {
    super('POSDatabase');
    this.version(1).stores({
      orders: '++localId, id, restaurantId, tableId, orderStatus, synced',
      transactions: '++localId, id, restaurantId, orderId, synced'
    });
  }
}

export const dbLocal = new POSDatabase();
