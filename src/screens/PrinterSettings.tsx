import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bluetooth, Printer, Settings, CheckCircle2, XCircle, RefreshCw, Smartphone, Power, Info, History, Usb, Trash2 } from 'lucide-react';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useAuthStore } from '../stores/useAuthStore';
import { printerService } from '../services/printerService';
import { toast } from 'sonner';

const PrinterSettings = () => {
  const { updateProfile, profile, loading: authLoading } = useAuthStore();
  const [activeType, setActiveType] = useState<'BT' | 'USB'>('BT');
  const [troubleshootTab, setTroubleshootTab] = useState<'windows' | 'mac' | 'linux' | 'general'>('windows');

  const { 
    defaultPrinter, 
    paperWidth, 
    autoPrintKOT, 
    autoPrintBill,
    isConnected,
    isScanning,
    setPaperWidth,
    setAutoPrintKOT,
    setAutoPrintBill,
    kotHeader,
    kotFooter,
    setKOTHeader,
    setKOTFooter,
    scanAndConnect,
    scanUSB,
    disconnect,
    checkConnection,
    lastPrintData,
    pairedDevices,
    refreshPairedDevices,
    connectToDevice,
    usbStatus,
    usbLogs,
    reconnect,
    resetUSB
  } = usePrinterStore();

  useEffect(() => {
    refreshPairedDevices();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, [checkConnection, refreshPairedDevices]);

  if (authLoading) return null;
  if (profile?.role === 'captain') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto">
            <XCircle size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Access Restricted</h2>
            <p className="text-slate-500 text-sm mt-2 font-medium">Standard staff accounts do not have authorization to modify infrastructure settings like Printer configurations.</p>
          </div>
          <button 
            onClick={() => window.history.back()}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-slate-100"
          >
            Return to Safety
          </button>
        </div>
      </div>
    );
  }

  // Attempt to load settings from profile if local store is empty
  useEffect(() => {
    if (!defaultPrinter && profile?.defaultPrinterName) {
      usePrinterStore.setState({ 
        defaultPrinter: { 
          name: profile.defaultPrinterName, 
          id: profile.printerAddress || '',
          type: profile.printerType || 'BT'
        } 
      });
    }
  }, [profile, defaultPrinter]);

  const handleScanAndConnect = async () => {
    try {
      // In a real scenario, scanAndConnect in the store handles this.
      // We wrap it here to add the Firebase persistence.
      await scanAndConnect();
      
      // Get the newly connected device from the state
      const { defaultPrinter: connectedDevice } = usePrinterStore.getState();
      
      if (connectedDevice) {
        await updateProfile({
          defaultPrinterName: connectedDevice.name,
          printerAddress: connectedDevice.id,
          printerType: connectedDevice.type
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUSBScan = async () => {
    try {
      await scanUSB();
      const { defaultPrinter: connectedDevice } = usePrinterStore.getState();
      if (connectedDevice) {
        await updateProfile({
          defaultPrinterName: connectedDevice.name,
          printerAddress: connectedDevice.id,
          printerType: connectedDevice.type
        });
      }
    } catch (error) {
       console.error(error);
    }
  };

  const handleTestPrint = async () => {
    let currentIsConnected = isConnected;

    if (!currentIsConnected) {
      if (defaultPrinter) {
        const tid = toast.loading(`Attempting to connect to ${defaultPrinter.name}...`);
        try {
          await connectToDevice(defaultPrinter);
          toast.dismiss(tid);
          // Wait for connection to fully stabilize before printing
          await new Promise(r => setTimeout(r, 800));
          currentIsConnected = usePrinterStore.getState().isConnected;
        } catch (e) {
          toast.error("Failed to connect for test print", { id: tid });
          return;
        }
      } else {
        toast.error('Please connect or select a printer first');
        return;
      }
    }

    if (!currentIsConnected) {
      toast.error('Printer is not connected.');
      return;
    }

    try {
      const data = {
        title: 'TEST PRINT',
        type: 'BILL',
        tableNumber: 'TEST',
        captainName: profile?.name || 'Admin',
        items: [{ itemName: 'Test Communication', quantity: 1, price: 0 }],
        totalAmount: 0,
        discountAmount: 0,
        orderId: 'TEST-' + Math.random().toString(36).substring(7).toUpperCase()
      };
      const encoded = printerService.encodeReceipt(data, paperWidth);
      await printerService.print(encoded);
      toast.success('Test print command sent successfully');
    } catch (error) {
      toast.error('Print failed. Ensure printer is ON and in range.');
    }
  };

  const handleReprint = async () => {
    if (!lastPrintData) {
      toast.error('No recent receipt to reprint');
      return;
    }
    if (!isConnected) {
      toast.error('Connect printer first');
      return;
    }

    try {
      const encoded = printerService.encodeReceipt(lastPrintData, paperWidth);
      await printerService.print(encoded);
      toast.success('Reprinting last receipt...');
    } catch (error) {
      toast.error('Reprint failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="p-6 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Printer size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">PRINTER SETTINGS</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Manage Bluetooth Thermal Printers</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        {/* Status Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm overflow-hidden relative"
        >
          <div className={`absolute top-0 right-0 p-3 px-6 rounded-bl-3xl font-black text-[10px] uppercase tracking-widest transition-colors ${isConnected ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>

          <div className="space-y-6">
            {/* Connection Type Switch */}
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => setActiveType('BT')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeType === 'BT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
              >
                <Bluetooth size={14} />
                Bluetooth
              </button>
              <button
                onClick={() => setActiveType('USB')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeType === 'USB' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
              >
                <Usb size={14} />
                USB Connection
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                {isConnected ? <CheckCircle2 size={32} /> : (activeType === 'BT' ? <Bluetooth size={32} /> : <Usb size={32} />)}
              </div>
              <div className="flex-1">
                <h3 className="font-black text-xl text-slate-900">
                  {defaultPrinter ? defaultPrinter.name : 'No Printer Paired'}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                    {isConnected ? `Connected via ${defaultPrinter?.type}` : 'Ready to pair new device'}
                  </p>
                  {activeType === 'USB' && usbStatus !== 'disconnected' && (
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${
                      usbStatus === 'connecting' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                      usbStatus === 'connected' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {usbStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* USB Logs Section */}
            {activeType === 'USB' && usbLogs.length > 0 && (
              <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[9px] text-emerald-400/80 max-h-48 overflow-y-auto space-y-1">
                <div className="flex items-center justify-between sticky top-0 bg-slate-900 py-1 border-b border-slate-800 mb-2">
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">USB Connection Sequence</p>
                  <button 
                    onClick={() => usePrinterStore.setState({ usbLogs: [] })}
                    className="text-[8px] font-black text-rose-500 uppercase tracking-widest"
                  >
                    Clear
                  </button>
                </div>
                {usbLogs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600 shrink-0">[{i}]</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Connection Sequence Status Hint */}
            {activeType === 'USB' && usbStatus === 'connecting' && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                 <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">
                   Sequence: Open → Configure → Claim ...
                 </p>
              </div>
            )}

            {/* Paired Devices List */}
            {!isConnected && (
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{activeType} Devices</h4>
                  <button 
                    onClick={refreshPairedDevices}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-indigo-600"
                    title="Reload paired devices"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                
                {pairedDevices.filter(d => d.type === activeType).length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {pairedDevices.filter(d => d.type === activeType).map(device => (
                      <button
                        key={device.id}
                        onClick={() => connectToDevice(device)}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${defaultPrinter?.id === device.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-indigo-100 bg-white shadow-sm'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${defaultPrinter?.id === device.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {device.type === 'USB' ? <Usb size={20} /> : <Printer size={20} />}
                          </div>
                          <div className="text-left">
                            <span className="font-black text-slate-700 block leading-tight">{device.name}</span>
                            <span className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter">
                              {device.type} Address: {device.id}
                            </span>
                          </div>
                        </div>
                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${defaultPrinter?.id === device.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-600'}`}>
                          {defaultPrinter?.id === device.id ? 'Saved' : 'Connect'}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
                      {activeType === 'BT' ? <Bluetooth size={28} className="text-slate-300" /> : <Usb size={28} className="text-slate-300" />}
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 font-bold">No {activeType} printer found.</p>
                      <p className="text-[10px] text-slate-400 font-medium max-w-[200px] mx-auto mt-1">
                        {activeType === 'BT' 
                          ? "Pair your printer in Android Bluetooth settings first." 
                          : "Connect your USB printer to your device and click scan."}
                      </p>
                    </div>
                    {activeType === 'BT' && (
                      <button 
                        onClick={() => {
                          window.location.href = 'intent://android.settings.BLUETOOTH_SETTINGS#Intent;scheme=android.intent.action.VIEW;package=com.android.settings;end';
                        }}
                        className="mt-2 bg-white border border-slate-200 text-indigo-600 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                      >
                        <Smartphone size={14} />
                        Bluetooth Settings
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {!isConnected ? (
                <>
                  <button
                    onClick={activeType === 'BT' ? handleScanAndConnect : handleUSBScan}
                    disabled={isScanning}
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-slate-100 hover:bg-black active:scale-[0.98] transition-all uppercase tracking-widest text-[10px]"
                  >
                    {isScanning ? <RefreshCw className="animate-spin" size={16} /> : (activeType === 'BT' ? <Bluetooth size={16} /> : <Usb size={16} />)}
                    {isScanning ? 'Requesting Permission...' : `Scan for ${activeType} Printers`}
                  </button>
                  
                  {activeType === 'USB' && (
                    <button
                      onClick={resetUSB}
                      className="w-full bg-rose-50 text-rose-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 border border-rose-100 hover:bg-rose-100 transition-all uppercase tracking-widest text-[10px] mb-2"
                    >
                      <Trash2 size={16} />
                      Reset USB Permissions
                    </button>
                  )}
                  
                  {activeType === 'BT' && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col gap-2">
                      <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                        Bluetooth printers usually require pairing via System Settings first on Android.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleTestPrint}
                    className="flex-1 bg-slate-100 text-slate-900 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]"
                  >
                    <RefreshCw size={16} />
                    Test Print
                  </button>
                  <button
                    onClick={handleReprint}
                    disabled={!lastPrintData}
                    className="flex-1 bg-indigo-50 text-indigo-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50"
                  >
                    <History size={16} />
                    Reprint Last
                  </button>
                  <button
                    onClick={reconnect}
                    className="w-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center hover:bg-amber-100 transition-all"
                    title="Quick Reconnect"
                  >
                    <RefreshCw size={20} />
                  </button>
                  <button
                    onClick={disconnect}
                    className="w-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-100 transition-all"
                  >
                    <Power size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Interactive OS Driver Troubleshooting Panel */}
        {activeType === 'USB' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[2.5rem] p-7 border-2 ${
              usbStatus === 'failed' 
                ? 'border-rose-200 bg-rose-50/20' 
                : 'border-amber-100 bg-amber-50/5'
            }`}
          >
            <div className="flex items-start gap-3.5 mb-5">
              <div className={`p-2.5 rounded-2xl shrink-0 ${
                usbStatus === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
              }`}>
                <Info size={20} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                  {usbStatus === 'failed' 
                    ? '⚠️ Access Blocked: USB Driver Limitation Detected' 
                    : 'USB Connection & Driver Assistant'}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-1">
                  Browsers (via WebUSB) cannot interface with printers claimed by native OS spoolers. Choose your platform below to resolve:
                </p>
              </div>
            </div>

            {/* Tabs selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 mb-4">
              {(['windows', 'mac', 'linux', 'general'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTroubleshootTab(tab)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all h-[36px] cursor-pointer flex items-center justify-center ${
                    troubleshootTab === tab 
                      ? 'bg-slate-950 text-white shadow-sm font-black' 
                      : 'text-slate-400 hover:text-slate-600 font-bold'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="space-y-3 pb-2 text-slate-700 text-[10px] font-semibold leading-relaxed">
              {troubleshootTab === 'windows' && (
                <div className="space-y-2">
                  <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50 text-[9.5px]">
                    <span className="font-extrabold text-amber-800">Why it fails:</span> Windows automatically locks the TM-m30II printer under its system <code className="font-mono bg-amber-100/50 px-1 py-0.2 rounded font-black text-rose-600">usbprint.sys</code> driver which denies WebUSB permission.
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 font-medium text-left">
                    <li>Download the free utility <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-black underline hover:text-indigo-800 inline-flex items-center gap-1">Zadig (zadig.akeo.ie) 🔗</a>.</li>
                    <li>Connect the USB printer to your PC and switch it <span className="font-extrabold text-slate-900">ON</span>.</li>
                    <li>Open Zadig, click <span className="font-extrabold text-slate-900">Options</span> &gt; check <span className="font-extrabold text-slate-900">List All Devices</span>.</li>
                    <li>Select <span className="font-extrabold text-slate-900">TM-m30II</span> (VID: <code className="font-mono bg-slate-100 px-0.5">1208</code>, PID: <code className="font-mono bg-slate-100 px-0.5">3626</code>) from the main drop-down menu.</li>
                    <li>For target driver (right-side of driver replacement arrow), select <span className="font-extrabold text-indigo-600">WinUSB</span>.</li>
                    <li>Click <span className="font-extrabold text-emerald-600 uppercase">Replace Driver</span> (or Reinstall Driver) and wait 30 seconds.</li>
                    <li>Turn your printer OFF and ON again, then scan below to connect successfully!</li>
                  </ol>
                </div>
              )}

              {troubleshootTab === 'mac' && (
                <div className="space-y-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl text-[9.5px]">
                    <span className="font-extrabold text-indigo-900">Why it fails:</span> macOS delegates printer control to CUPS spoolers automatically.
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 font-medium text-left">
                    <li>Navigate to <span className="font-extrabold text-slate-900">System Settings &gt; Printers & Scanners</span>.</li>
                    <li>Ensure there are no pending or active print jobs inside the queue.</li>
                    <li>Try deleting/pausing the active print queue referencing TM-m30II.</li>
                    <li>Disconnect and reconnect your USB cable.</li>
                    <li>Restart Chrome/Edge to release system handles, and scan again below.</li>
                  </ol>
                </div>
              )}

              {troubleshootTab === 'linux' && (
                <div className="space-y-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl text-[9.5px]">
                    <span className="font-extrabold text-slate-800">Why it fails:</span> Linux systems default USB dev permission limits for non-root users.
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 font-medium text-left">
                    <li>Create your custom rules file: <code className="bg-slate-100 font-mono text-[9px] px-1 py-0.5 rounded text-indigo-600">sudo nano /etc/udev/rules.d/99-epson.rules</code></li>
                    <li>Paste the following exact string rule: <br/><code className="bg-slate-900 text-teal-400 font-mono text-[8.5px] block my-1 p-2 rounded select-all font-bold">{"SUBSYSTEM==\"usb\", ATTR{idVendor}==\"1208\", MODE=\"0666\""}</code></li>
                    <li>Save, exit, and reload: <code className="bg-slate-100 font-mono text-[9px] px-1 py-0.5 rounded block my-1 text-slate-600 font-mono">sudo udevadm control --reload-rules && sudo udevadm trigger</code></li>
                    <li>Replug the USB connection cable and try again!</li>
                  </ol>
                </div>
              )}

              {troubleshootTab === 'general' && (
                <div className="space-y-2 text-slate-600 font-medium text-left">
                  <ul className="list-disc list-inside space-y-1.5">
                    <li><span className="font-extrabold text-slate-900">Only One Claim Allowed:</span> WebUSB is exclusive. Ensure no other browser tabs, POS apps, or test tools are open or claiming the device.</li>
                    <li><span className="font-extrabold text-slate-900">Port Check:</span> Desktop computer towers often prefer direct rear motherboard ports over unstable USB front-panel hubs.</li>
                    <li><span className="font-extrabold text-slate-900">Hardware Level Reset:</span> Click the <span className="font-extrabold text-rose-600">Reset USB Permissions</span> button below to wipe cached preferences and start afresh.</li>
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Browser Support Warning */}
        {activeType === 'USB' && !(navigator as any).usb && (
          <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] text-center">
            <XCircle size={32} className="text-rose-500 mx-auto mb-2" />
            <h4 className="font-black text-rose-900 text-sm uppercase">USB Not Supported</h4>
            <p className="text-[10px] text-rose-700 font-bold mt-1">
              Your browser doesn't support WebUSB. On Android, use Chrome or a PWA-installed version.
            </p>
            <div className="mt-4 flex flex-col gap-2">
               <p className="text-[9px] font-black uppercase text-rose-400">Alternative Options:</p>
               <button onClick={() => setActiveType('BT')} className="bg-white border border-rose-200 p-3 rounded-xl text-[10px] font-black uppercase text-indigo-600 flex items-center justify-center gap-2">
                 <Bluetooth size={14} /> Switch to Bluetooth
               </button>
            </div>
          </div>
        )}

        {/* Test Section */}
        {defaultPrinter && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-6 border-2 border-indigo-50 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <Settings size={22} className="animate-pulse" />
              </div>
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Diagnostics</p>
                <p className="text-sm font-black text-slate-800 leading-tight">Test your {defaultPrinter.name}</p>
                <p className="text-[9px] font-bold text-slate-400">Validate the hardware connection</p>
              </div>
            </div>
            <button 
              onClick={handleTestPrint}
              disabled={isScanning}
              className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-100 flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Printer size={14} />
              Run Test Print
            </button>
          </motion.div>
        )}

        {/* Configurations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Settings size={14} /> Paper Width
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setPaperWidth(58)}
                className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${paperWidth === 58 ? 'bg-indigo-600 text-white border-none' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
              >
                58mm
              </button>
              <button 
                onClick={() => setPaperWidth(80)}
                className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${paperWidth === 80 ? 'bg-indigo-600 text-white border-none' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
              >
                80mm
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <RefreshCw size={14} /> Auto-Print
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs">Print KOT on Confirm</span>
                <button 
                  onClick={() => setAutoPrintKOT(!autoPrintKOT)}
                  className={`w-10 h-6 rounded-full transition-all relative ${autoPrintKOT ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoPrintKOT ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs">Print Bill on Settle</span>
                <button 
                  onClick={() => setAutoPrintBill(!autoPrintBill)}
                  className={`w-10 h-6 rounded-full transition-all relative ${autoPrintBill ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoPrintBill ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KOT Text Customization */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Settings size={14} /> KOT Ticket Branding
          </h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Custom KOT Header</label>
              <input 
                type="text"
                value={kotHeader || ''}
                onChange={(e) => setKOTHeader(e.target.value)}
                placeholder="e.g. KITCHEN COPY #1"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
              />
              <p className="text-[9px] text-slate-400 font-medium ml-1">Optional. Appears at the very top of KOT tickets.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Custom KOT Footer</label>
              <input 
                type="text"
                value={kotFooter || ''}
                onChange={(e) => setKOTFooter(e.target.value)}
                placeholder="e.g. Process Fast - Hot & Fresh"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
              />
              <p className="text-[9px] text-slate-400 font-medium ml-1">Optional. Appears at the bottom of KOT tickets.</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100/50 flex gap-4">
          <div className="text-amber-500 mt-1">
            <Info size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-amber-900 font-bold text-xs uppercase tracking-tight">Requirement Check</p>
            <p className="text-amber-700/80 text-[10px] leading-relaxed font-medium">
              Web Bluetooth requires a modern browser (Chrome, Edge) and must be served over HTTPS. Ensure your printer is in pairing mode before scanning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterSettings;
