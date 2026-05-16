
interface USBEndpoint {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
}

interface USBAlternateInterface {
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  endpoints: USBEndpoint[];
}

interface USBInterface {
  interfaceNumber: number;
  alternates: USBAlternateInterface[];
}

interface USBConfiguration {
  interfaces: USBInterface[];
}

interface USBDevice {
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  configuration?: USBConfiguration;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (configValue: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  releaseInterface: (interfaceNumber: number) => Promise<void>;
  selectAlternateInterface: (interfaceNumber: number, alternateSetting: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<USBOutTransferResult>;
  reset: () => Promise<void>;
}

interface USBOutTransferResult {
  bytesWritten: number;
  status: "ok" | "stall" | "babble";
}

interface NavigatorUSB {
  requestDevice: (options: any) => Promise<USBDevice>;
  getDevices: () => Promise<USBDevice[]>;
}

interface Navigator {
  usb?: NavigatorUSB;
}

declare const navigator: Navigator;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

export class USBPrinterService {
  private device: USBDevice | null = null;
  private endpointOut: number | null = null;
  private interfaceNumber: number | null = null;
  private status: ConnectionStatus = 'disconnected';
  private logs: string[] = [];
  private isConnecting = false;

  private readonly EPSON_VENDOR_ID = 1208; // 0x04b8

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    console.log(`[USB-Printer] ${message}`);
    if (this.logs.length > 50) this.logs.shift();
  }

  getLogs() {
    return this.logs;
  }

  getStatus() {
    return this.status;
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.log(`Status changed to: ${status}`);
  }

  async scan(): Promise<USBDevice> {
    if (!navigator.usb) {
      throw new Error('WebUSB is not supported in this browser.');
    }
    
    try {
      this.log('Requesting USB device permission...');
      const device = await navigator.usb.requestDevice({ 
        filters: [
          { vendorId: this.EPSON_VENDOR_ID },
          { classCode: 7 } // Printer class
        ] 
      });
      this.device = device as unknown as USBDevice;
      this.log(`Permission granted: ${device.productName || 'Printer'} (VID: ${device.vendorId}, PID: ${device.productId})`);
      return this.device;
    } catch (error) {
      if (error instanceof Error && (error.name === 'NotFoundError' || error.message.includes('User cancelled'))) {
        throw new Error('USER_CANCELLED');
      }
      if (error instanceof Error && error.name === 'SecurityError') {
        this.log('SecurityError: Permission denied or blocked by browser.');
        throw new Error('USB_PERMISSION_DENIED');
      }
      this.log(`Scan error: ${error}`);
      throw error;
    }
  }

  async connect(device?: any, forcePermission = false): Promise<boolean> {
    if (this.isConnecting) {
      this.log('Already attempting to connect, skipping...');
      return false;
    }

    try {
      this.isConnecting = true;
      let targetDevice = device || this.device;

      // Ensure we have a device and permission
      if (!targetDevice || forcePermission) {
        this.log('No device selected or force permission requested, scanning...');
        targetDevice = await this.scan();
      }

      this.device = targetDevice;
      this.setStatus('connecting');
      this.log(`Connecting to ${this.device?.productName || 'USB Printer'} (VID: ${this.device?.vendorId})...`);

      const connectionTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('CONNECTION_TIMEOUT')), 15000)
      );

      const connectionProcess = (async () => {
        try {
          // 1. Open device
          this.log('Executing step: device.open()...');
          await this.device?.open();
          this.log('Device detected and opened.');

          // 2. Select configuration (usually 1)
          this.log('Executing step: device.selectConfiguration(1)...');
          try {
            await this.device?.selectConfiguration(1);
            this.log('Configuration selected: 1');
          } catch (configErr) {
            this.log(`Configuration 1 selection warning (may already be selected): ${configErr}`);
          }

          // 3. Find correct interface and endpoint
          const found = this.findInterfaceAndEndpoint();
          
          // 4. Claim interface
          // Use interface 0 as standard for Epson TM-m30II as requested, fallback to discovered if 0 fails or is different
          const claimTarget = found?.interfaceNumber ?? 0;
          this.log(`Executing step: device.claimInterface(${claimTarget})...`);
          
          try {
            await this.device?.claimInterface(claimTarget);
            this.interfaceNumber = claimTarget;
            this.log(`Interface ${claimTarget} claimed successfully.`);
          } catch (claimErr) {
            this.log(`Initial claim on ${claimTarget} failed: ${claimErr}. Attempting discovery/reset...`);
            await this.device?.reset();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (found && found.interfaceNumber !== claimTarget) {
               this.log(`Attempting discovered interface ${found.interfaceNumber}...`);
               await this.device?.claimInterface(found.interfaceNumber);
               this.interfaceNumber = found.interfaceNumber;
            } else {
               await this.device?.claimInterface(claimTarget);
               this.interfaceNumber = claimTarget;
            }
            this.log(`Interface ${this.interfaceNumber} claimed.`);
          }

          if (found) {
            this.endpointOut = found.endpointNumber;
            this.log(`Selected Out-Endpoint: ${found.endpointNumber}`);
          } else {
            // Default endpoint fallback if discovery failed but claim succeeded
            this.endpointOut = 1; 
            this.log('Endpoint discovery failed, falling back to default (1)');
          }

          // 5. Success
          this.setStatus('connected');
          this.log('Printer connected and ready for printing.');
          
          // Optional: Initialize
          await this.initializePrinter();
          
          return true;
        } catch (error: any) {
          this.log(`Connection step failed: ${error.message || error}`);
          
          if (error.name === 'SecurityError') throw new Error('ACCESS_DENIED_SEC_ERR');
          if (error.name === 'NetworkError') throw new Error('DEVICE_UNPLUGGED_ERROR');
          
          throw error;
        }
      })();

      return await Promise.race([connectionProcess, connectionTimeout]) as boolean;

    } catch (error: any) {
      this.log(`Connection failed: ${error.message || error}`);
      this.setStatus('failed');
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  private findInterfaceAndEndpoint() {
    if (!this.device?.configuration) return null;

    // Preference: Epson / Standard Printer class (7)
    for (const iface of this.device.configuration.interfaces) {
      for (const alt of iface.alternates) {
        if (alt.interfaceClass === 7) {
          const outEndpoint = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
          if (outEndpoint) {
            return { interfaceNumber: iface.interfaceNumber, endpointNumber: outEndpoint.endpointNumber };
          }
        }
      }
    }

    // Generic fallback for some EPSON models that might not report as class 7
    for (const iface of this.device.configuration.interfaces) {
      for (const alt of iface.alternates) {
        const outEndpoint = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
        if (outEndpoint) {
          return { interfaceNumber: iface.interfaceNumber, endpointNumber: outEndpoint.endpointNumber };
        }
      }
    }

    return null;
  }

  async initializePrinter() {
    try {
      // ESC @ (Initialize)
      const initCmd = new Uint8Array([0x1B, 0x40]);
      await this.printRaw(initCmd, false);
      this.log('Printer initialized (ESC @)');
    } catch (e) {
      this.log(`Initialization failed: ${e}`);
    }
  }

  async printRaw(data: Uint8Array, prependInit = true) {
    if (this.status !== 'connected' || !this.device || !this.endpointOut) {
      this.log('Print failed: Not connected');
      throw new Error('NOT_CONNECTED');
    }

    try {
      let payload = data;
      if (prependInit) {
        const initCmd = new Uint8Array([0x1B, 0x40]);
        payload = new Uint8Array(initCmd.length + data.length);
        payload.set(initCmd);
        payload.set(data, initCmd.length);
      }

      const result = await this.device.transferOut(this.endpointOut, payload);
      if (result.status !== 'ok') {
        throw new Error(`TRANSFER_FAILED_${result.status.toUpperCase()}`);
      }
      return result;
    } catch (error: any) {
      this.log(`USB Print Error: ${error.message || error}`);
      if (error.name === 'NetworkError') {
        this.setStatus('disconnected');
        throw new Error('DEVICE_LOST');
      }
      throw error;
    }
  }

  async disconnect() {
    this.log('Disconnecting USB printer...');
    try {
      if (this.device?.opened) {
        if (this.interfaceNumber !== null) {
          try {
            await this.device.releaseInterface(this.interfaceNumber);
          } catch(e) {}
        }
        await this.device.close();
      }
    } catch (e) {
      this.log(`Closure error: ${e}`);
    } finally {
      this.device = null;
      this.endpointOut = null;
      this.interfaceNumber = null;
      this.setStatus('disconnected');
    }
  }

  async resetPermission() {
    this.log('Resetting USB printer permissions and disconnecting...');
    await this.disconnect();
    this.device = null;
    localStorage.removeItem('usb_printer_config');
    this.log('Permission cache cleared. Please re-scan.');
  }

  async getPairedDevices() {
    if (!navigator.usb) return [];
    try {
      return await navigator.usb.getDevices();
    } catch (e) {
      this.log(`Error getting paired devices: ${e}`);
      return [];
    }
  }
}

export const usbPrinterService = new USBPrinterService();
