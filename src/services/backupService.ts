import { dbLocal } from '../lib/db';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { toast } from 'sonner';

class BackupService {
  async exportLocalData() {
    try {
      const data: any = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: {}
      };

      // Export all Dexie tables
      const tableNames = dbLocal.tables.map(t => t.name);
      for (const name of tableNames) {
        data.tables[name] = await dbLocal.table(name).toArray();
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const filename = `RestoPro_Backup_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
      
      saveAs(blob, filename);
      toast.success('Local backup exported successfully');
    } catch (error) {
      console.error("Backup Export Failed:", error);
      toast.error('Backup failed to export');
    }
  }

  async importLocalData(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.version !== '1.0') throw new Error("Invalid backup version");

      // Batch clear and put
      for (const [tableName, rows] of Object.entries(data.tables)) {
        const table = dbLocal.table(tableName);
        await table.clear();
        await table.bulkPut(rows as any[]);
      }

      toast.success('Data restored successfully. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Backup Import Failed:", error);
      toast.error('Failed to restore backup: ' + (error as Error).message);
    }
  }
}

export const backupService = new BackupService();
