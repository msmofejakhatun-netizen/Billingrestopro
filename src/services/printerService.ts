import EscPosEncoder from 'esc-pos-encoder';
import { usbPrinterService, ConnectionStatus } from './usbPrinterService';

interface USBDevice {
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  vendorId: number;
  productId: number;
  opened: boolean;
}

interface Navigator {
  bluetooth: {
    requestDevice: (options: any) => Promise<BluetoothDevice>;
    getDevices: () => Promise<BluetoothDevice[]>;
  };
  usb: {
    requestDevice: (options: any) => Promise<USBDevice>;
    getDevices: () => Promise<USBDevice[]>;
  };
}
interface BluetoothDevice {
  name: string;
  id: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGATTServer>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTService>;
  getPrimaryServices: () => Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
  uuid: string;
  getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue: (value: Uint8Array) => Promise<void>;
}

declare let navigator: Navigator;

export interface PrinterDevice {
  name: string;
  id: string;
  type: 'BT' | 'USB';
}

export class PrinterService {
  private btDevice: BluetoothDevice | null = null;
  private btServer: BluetoothRemoteGATTServer | null = null;
  private btCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

  private connectionType: 'BT' | 'USB' | null = null;

  // Standard Bluetooth GATT Service and Characteristic for most thermal printers
  private readonly SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
  ];
  private readonly SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
  private readonly CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

  async scan(): Promise<PrinterDevice> {
    if (!navigator.bluetooth) {
      throw new Error('Bluetooth is not supported in this browser.');
    }
    try {
      this.btDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.SERVICE_UUIDS
      });

      this.connectionType = 'BT';
      return {
        name: this.btDevice.name || 'Unknown Printer',
        id: this.btDevice.id,
        type: 'BT'
      };
    } catch (error) {
      if (error instanceof Error && (error.name === 'NotFoundError' || error.message.includes('User cancelled'))) {
        throw new Error('USER_CANCELLED');
      }
      console.error('Bluetooth scan failed:', error);
      throw error;
    }
  }

  async scanUSB(): Promise<PrinterDevice> {
    try {
      const device = await usbPrinterService.scan();
      this.connectionType = 'USB';

      return {
        name: device.productName || 'USB Printer',
        id: device.serialNumber || `USB-${device.vendorId}-${device.productId}`,
        type: 'USB'
      };
    } catch (error) {
      throw error;
    }
  }

  async getPairedDevices(): Promise<PrinterDevice[]> {
    const btDevicesList: PrinterDevice[] = [];
    const usbDevicesList: PrinterDevice[] = [];

    if (navigator.bluetooth && 'getDevices' in navigator.bluetooth) {
      try {
        // @ts-ignore
        const devices: BluetoothDevice[] = await navigator.bluetooth.getDevices();
        devices.forEach(d => btDevicesList.push({
          name: d.name || 'Unknown BT Printer',
          id: d.id,
          type: 'BT'
        }));
      } catch (e) { console.warn('BT getDevices failed', e); }
    }

    try {
      const usbDevices = await usbPrinterService.getPairedDevices();
      usbDevices.forEach(d => usbDevicesList.push({
        name: d.productName || 'USB Printer',
        id: d.serialNumber || `USB-${d.vendorId}-${d.productId}`,
        type: 'USB'
      }));
    } catch (e) { console.warn('USB getDevices failed', e); }

    return [...btDevicesList, ...usbDevicesList];
  }

  async connect(deviceId?: string, type: 'BT' | 'USB' = 'BT'): Promise<boolean> {
    this.connectionType = type;
    if (type === 'BT') {
      return this.connectBT(deviceId);
    } else {
      return this.connectUSB(deviceId);
    }
  }

  private async connectBT(deviceId?: string): Promise<boolean> {
    try {
      if (deviceId && navigator.bluetooth && 'getDevices' in navigator.bluetooth) {
        // @ts-ignore
        const devices: BluetoothDevice[] = await navigator.bluetooth.getDevices();
        const found = devices.find(d => d.id === deviceId);
        if (found) this.btDevice = found;
      }

      if (!this.btDevice) return false;

      if (this.btDevice.gatt?.connected && this.btCharacteristic) return true;

      this.btDevice.removeEventListener('gattserverdisconnected', this.handleDisconnection);
      this.btDevice.addEventListener('gattserverdisconnected', this.handleDisconnection);

      this.btServer = await this.btDevice.gatt?.connect() as BluetoothRemoteGATTServer;
      
      let service: BluetoothRemoteGATTService | null = null;
      for (const uuid of this.SERVICE_UUIDS) {
        try {
          service = await this.btServer.getPrimaryService(uuid);
          if (service) break;
        } catch (e) {}
      }

      if (!service) {
        const services = await this.btServer.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          const writeChar = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
          if (writeChar) {
            service = s;
            this.btCharacteristic = writeChar;
            break;
          }
        }
      } else {
        this.btCharacteristic = await service.getCharacteristic(this.CHARACTERISTIC_UUID);
      }

      if (this.onStatusChange) this.onStatusChange(true);
      return true;
    } catch (error) {
      console.error('BT connect failed:', error);
      return false;
    }
  }

  private async connectUSB(deviceId?: string): Promise<boolean> {
    try {
      let deviceToConnect: any = null;
      if (deviceId) {
        const devices = await usbPrinterService.getPairedDevices();
        deviceToConnect = devices.find(d => (d.serialNumber || `USB-${d.vendorId}-${d.productId}`) === deviceId);
      }
      
      const success = await usbPrinterService.connect(deviceToConnect);
      if (success && this.onStatusChange) {
        this.onStatusChange(true);
      }
      return success;
    } catch (error) {
      console.error('USB Connect failed', error);
      return false;
    }
  }

  private onStatusChange: ((connected: boolean) => void) | null = null;

  setStatusCallback(callback: (connected: boolean) => void) {
    this.onStatusChange = callback;
  }

  private handleDisconnection = () => {
    console.log('Printer disconnected');
    this.btServer = null;
    this.btCharacteristic = null;
    if (this.onStatusChange) this.onStatusChange(false);
  };

  async disconnect() {
    if (this.connectionType === 'BT') {
      if (this.btDevice?.gatt?.connected) {
        this.btDevice.gatt.disconnect();
      }
    } else {
      await usbPrinterService.disconnect();
    }
    
    this.btServer = null;
    this.btCharacteristic = null;
    if (this.onStatusChange) this.onStatusChange(false);
  }

  isConnected(): boolean {
    if (this.connectionType === 'BT') {
      return !!this.btDevice?.gatt?.connected && !!this.btCharacteristic;
    } else if (this.connectionType === 'USB') {
      return usbPrinterService.getStatus() === 'connected';
    }
    return false;
  }

  getUSBStatus(): ConnectionStatus {
    return usbPrinterService.getStatus();
  }

  getUSBLogs(): string[] {
    return usbPrinterService.getLogs();
  }

  async print(data: Uint8Array) {
    if (this.connectionType === 'BT') {
      if (!this.btCharacteristic) throw new Error('Bluetooth printer not connected');
      const chunkSize = 512;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await this.btCharacteristic.writeValue(chunk);
      }
    } else if (this.connectionType === 'USB') {
      await usbPrinterService.printRaw(data);
    } else {
      throw new Error('No printer connected');
    }
  }

  encodeReceipt(data: any, config?: any | null, kotHeader?: string, kotFooter?: string): Uint8Array {
    const encoder = new EscPosEncoder();
    const isBill = data.type === 'BILL';
    const now = new Date().toLocaleString();
    const paperWidth = config?.paperWidth === '58mm' ? 58 : 80;
    const printWidth = paperWidth === 80 ? 32 : 24;

    let result = encoder
      .initialize()
      .codepage('cp850')
      .align('center')
      .size(config?.fontSize === 'large' ? 'double' : 'normal')
      .bold(config?.boldHeadings ?? true);

    if (!isBill && kotHeader) {
      result.line(kotHeader);
    }

    if (data.isCancelled) {
      result.align('center').size('double').bold(true).line('*** CANCELLED ***').size('normal').bold(false);
    }

    // Header info
    if (isBill) {
      if (config?.restaurantName) result.line(config.restaurantName);
      else result.line('RESTOPRO POS');

      result.size('normal').bold(false);
      if (config?.address) result.line(config.address);
      if (config?.phone) result.line(`Ph: ${config.phone}`);
      if (config?.gstNumber && config?.showGst) result.line(`GST: ${config.gstNumber}`);
      if (config?.fssaiNumber) result.line(`FSSAI: ${config.fssaiNumber}`);
    } else {
      result.line('RestoPro POS');
    }

    result
      .line('-'.repeat(printWidth))
      .align('left')
      .line(`Table: ${data.tableNumber}`)
      .line(`Captain: ${data.captainName}`)
      .line(`Date: ${now}`)
      .line(`Bill No: ${data.billNumber || data.orderId.slice(-8).toUpperCase()}`)
      .line('-'.repeat(printWidth))
      .bold(true)
      .table(
        [
          { width: paperWidth === 80 ? 20 : 12, align: 'left' },
          { width: 4, align: 'center' },
          { width: paperWidth === 80 ? 8 : 8, align: 'right' }
        ],
        [
          ['Item', 'Qty', isBill ? 'Price' : '']
        ]
      )
      .bold(false);

    data.items.forEach((item: any) => {
      const price = isBill ? `${(item.price * item.quantity).toFixed(0)}` : '';
      result.table(
        [
          { width: paperWidth === 80 ? 20 : 12, align: 'left' },
          { width: 4, align: 'center' },
          { width: paperWidth === 80 ? 8 : 8, align: 'right' }
        ],
        [
          [item.itemName, item.quantity.toString(), price]
        ]
      );
    });

    result.line('-'.repeat(printWidth));

    if (isBill) {
      const subtotal = data.subtotal || data.totalAmount || 0;
      const discount = data.discountAmount || 0;
      const serviceCharge = data.serviceChargeAmount || 0;
      const taxable = Math.max(0, subtotal - discount);
      const gst = data.gstAmount ?? Math.round(taxable * (config?.gstPercentage || 5) / 100);
      const grandTotal = data.finalAmount ?? (taxable + gst + serviceCharge);

      result
        .align('right')
        .line(`Subtotal: ${subtotal.toFixed(0)}`)
        if (discount > 0) result.line(`Discount: -${discount.toFixed(0)}`);
        if (config?.showGst !== false) result.line(`GST: ${gst.toFixed(0)}`);
        if (serviceCharge > 0) result.line(`Srv Charge: ${serviceCharge.toFixed(0)}`);
        
      result
        .bold(true)
        .size('double')
        .line(`TOTAL: ${Math.round(grandTotal).toFixed(0)}`)
        .bold(false)
        .size('normal')
        .line('-'.repeat(printWidth));
    }

    result
      .align('center')
      .line(isBill ? (config?.footerMessage || 'Thank You Visit Again') : (kotFooter || 'Kitchen Copy'))
      .line(isBill ? (config?.thankYouMessage || 'RestoPro Enterprise') : 'RestoPro KOT')
      .feed(3);

    if (config?.autoCut ?? true) {
      result.cut();
    }

    return result.encode();
  }
}

export const printerService = new PrinterService();
