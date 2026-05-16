import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { printerService, PrinterDevice } from '../services/printerService';
import { usbPrinterService, ConnectionStatus } from '../services/usbPrinterService';
import { toast } from 'sonner';

interface PrinterState {
  defaultPrinter: PrinterDevice | null;
  paperWidth: 58 | 80;
  autoPrintKOT: boolean;
  autoPrintBill: boolean;
  kotHeader?: string;
  kotFooter?: string;
  lastPrintData: any | null;
  isConnected: boolean;
  isScanning: boolean;
  pairedDevices: PrinterDevice[];
  usbStatus: ConnectionStatus;
  usbLogs: string[];

  setPaperWidth: (width: 58 | 80) => void;
  setAutoPrintKOT: (enabled: boolean) => void;
  setAutoPrintBill: (enabled: boolean) => void;
  setKOTHeader: (text: string) => void;
  setKOTFooter: (text: string) => void;
  setLastPrintData: (data: any) => void;
  scanAndConnect: () => Promise<void>;
  scanUSB: () => Promise<void>;
  resetUSB: () => Promise<void>;
  reconnect: () => Promise<void>;
  connectToDevice: (device: PrinterDevice) => Promise<void>;
  refreshPairedDevices: () => Promise<void>;
  autoConnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkConnection: () => void;
  init: () => void;
}

// Set up status callback early
printerService.setStatusCallback((connected) => {
  usePrinterStore.setState({ 
    isConnected: connected,
    usbStatus: printerService.getUSBStatus(),
    usbLogs: printerService.getUSBLogs()
  });
});

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set, get) => ({
      defaultPrinter: null,
      paperWidth: 80,
      autoPrintKOT: false,
      autoPrintBill: false,
      kotHeader: '',
      kotFooter: '',
      lastPrintData: null,
      isConnected: false,
      isScanning: false,
      pairedDevices: [],
      usbStatus: 'disconnected',
      usbLogs: [],

      setPaperWidth: (width) => set({ paperWidth: width }),
      setAutoPrintKOT: (enabled) => set({ autoPrintKOT: enabled }),
      setAutoPrintBill: (enabled) => set({ autoPrintBill: enabled }),
      setKOTHeader: (text) => set({ kotHeader: text }),
      setKOTFooter: (text) => set({ kotFooter: text }),
      setLastPrintData: (data) => set({ lastPrintData: data }),

      init: () => {
        get().refreshPairedDevices();
        get().autoConnect();
      },

      refreshPairedDevices: async () => {
        const devices = await printerService.getPairedDevices();
        set({ pairedDevices: devices });
      },

      autoConnect: async () => {
        const { defaultPrinter, isConnected, isScanning } = get();
        if (isScanning || isConnected) return;

        if (defaultPrinter) {
          console.log('Attempting auto-connect to:', defaultPrinter.name, '(', defaultPrinter.type, ')');
          try {
            // Check if it's USB and if we can get the device
            if (defaultPrinter.type === 'USB') {
              const paired = await printerService.getPairedDevices();
              const found = paired.find(d => d.id === defaultPrinter.id);
              if (found) {
                const success = await printerService.connect(found.id, 'USB');
                if (success) {
                  set({ isConnected: true, usbStatus: 'connected' });
                  console.log('Auto-connected to USB successfully');
                  return;
                }
              }
            } else {
              const success = await printerService.connect(defaultPrinter.id, defaultPrinter.type);
              if (success) {
                set({ isConnected: true });
                console.log('Auto-connected successfully');
              }
            }
          } catch (e) {
            console.warn('Auto-connect failed', e);
          }
        }
      },

      connectToDevice: async (device: PrinterDevice) => {
        set({ isScanning: true });
        try {
          const success = await printerService.connect(device.id, device.type);
          if (success) {
            set({ defaultPrinter: device, isConnected: true });
            toast.success(`Connected to ${device.name}`);
          } else {
            toast.error('Failed to connect to printer.');
          }
        } catch (error) {
          console.error('Connection operation failed:', error);
          const msg = error instanceof Error ? error.message : String(error);
          toast.error(`Connection failed: ${msg}`);
        } finally {
          set({ isScanning: false });
          get().refreshPairedDevices();
        }
      },

      scanAndConnect: async () => {
        set({ isScanning: true });
        try {
          const device = await printerService.scan();
          const success = await printerService.connect(device.id, 'BT');
          if (success) {
            set({ defaultPrinter: device, isConnected: true });
            toast.success(`Connected to ${device.name}`);
          } else {
            toast.error('Failed to connect to printer');
          }
        } catch (error) {
          if ((error as Error).message !== 'USER_CANCELLED') {
            console.error(error);
            toast.error('Bluetooth scan failed: ' + (error as Error).message);
          }
        } finally {
          set({ isScanning: false });
          get().refreshPairedDevices();
        }
      },

  scanUSB: async () => {
    set({ isScanning: true });
    try {
      // Force permission request on scan
      const device = await printerService.scanUSB();
      const success = await printerService.connect(device.id, 'USB');
      if (success) {
        set({ defaultPrinter: device, isConnected: true });
        toast.success(`Connected to ${device.name}`);
      } else {
        // Log status and potentially suggest fallback
        const logs = printerService.getUSBLogs();
        const lastLog = logs[logs.length - 1];
        if (lastLog.includes('SecurityError') || lastLog.includes('Access denied')) {
           toast.error('USB Access Denied. Check browser permissions.');
        } else {
           toast.error('Failed to connect to USB printer. See logs for details.');
        }
      }
    } catch (error: any) {
      if (error.message !== 'USER_CANCELLED') {
        console.error(error);
        if (error.message === 'USB_PERMISSION_DENIED') {
          toast.error('USB Permission Denied. Please enable USB access in your browser settings.');
        } else {
          toast.error('USB scan failed: ' + error.message);
        }
        
        // Suggest fallback for Android if it looks like a browser restriction
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
          toast.info('USB printing might be blocked on this browser. Try Bluetooth mode instead.', { duration: 5000 });
        }
      }
    } finally {
      set({ isScanning: false });
      get().refreshPairedDevices();
    }
  },

  resetUSB: async () => {
    try {
      await usbPrinterService.resetPermission();
      set({ 
        isConnected: false, 
        usbStatus: 'disconnected', 
        defaultPrinter: null,
        usbLogs: usbPrinterService.getLogs() 
      });
      toast.success('USB permissions reset. You can now re-pair your device.');
    } catch (e) {
      toast.error('Failed to reset permissions');
    }
  },

  reconnect: async () => {
    const { defaultPrinter } = get();
    if (!defaultPrinter) return;
    
    set({ isScanning: true });
    try {
      const success = await printerService.connect(defaultPrinter.id, defaultPrinter.type);
      if (success) {
        toast.success('Printer reconnected successfully');
      } else {
        toast.error('Reconnection failed. Ensure printer is ON and connected.');
      }
    } catch (e) {
      toast.error('Reconnection failed');
    } finally {
      set({ isScanning: false });
      get().checkConnection();
    }
  },

  disconnect: async () => {
    await printerService.disconnect();
    set({ isConnected: false });
    toast.info('Printer disconnected');
  },

      checkConnection: () => {
        set({ 
          isConnected: printerService.isConnected(),
          usbStatus: printerService.getUSBStatus(),
          usbLogs: printerService.getUSBLogs()
        });
      }
    }),
    {
      name: 'printer-storage',
      partialize: (state) => ({
        defaultPrinter: state.defaultPrinter,
        paperWidth: state.paperWidth,
        autoPrintKOT: state.autoPrintKOT,
        autoPrintBill: state.autoPrintBill,
        kotHeader: state.kotHeader,
        kotFooter: state.kotFooter,
        lastPrintData: state.lastPrintData
      })
    }
  )
);
