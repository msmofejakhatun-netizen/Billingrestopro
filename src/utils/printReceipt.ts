
import { printerService } from '../services/printerService';
import { usePrinterStore } from '../stores/usePrinterStore';
import { useConfigStore } from '../stores/useConfigStore';
import { toast } from 'sonner';

export interface PrintData {
  title: string;
  type: 'KOT' | 'BILL';
  tableNumber: string;
  captainName: string;
  items: { itemName: string; quantity: number; price?: number; notes?: string }[];
  totalAmount?: number;
  discountAmount?: number;
  gstAmount?: number;
  serviceChargeAmount?: number;
  finalAmount?: number;
  orderId: string;
  isCancelled?: boolean;
}

export const printReceipt = async (data: PrintData) => {
  // Save to last print data for reprinting
  usePrinterStore.getState().setLastPrintData(data);

  const config = useConfigStore.getState().config;
  const { isConnected, kotHeader, kotFooter } = usePrinterStore.getState();
  
  if (isConnected) {
    try {
      const encoded = printerService.encodeReceipt(data, config, kotHeader, kotFooter);
      await printerService.print(encoded);
      toast.success(`${data.type} printed to Bluetooth printer`);
      return;
    } catch (error) {
      console.error('Bluetooth print failed, falling back to window print:', error);
      toast.error('Bluetooth print failed, using standard print');
    }
  }

  // Fallback to Window Print
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const now = new Date().toLocaleString();
  const isBill = data.type === 'BILL';
  const subtotal = data.totalAmount || 0;
  const discount = data.discountAmount || 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const totalGst = data.gstAmount || Math.round(taxableAmount * (config?.gstPercentage || 5) / 100);
  const serviceCharge = data.serviceChargeAmount || 0;
  const cgst = (totalGst / 2).toFixed(2);
  const sgst = (totalGst / 2).toFixed(2);
  const grandTotal = data.finalAmount || (taxableAmount + totalGst + serviceCharge);

  const html = `
    <html>
      <head>
        <title>${data.title}</title>
        <style>
          @page { size: auto; margin: 0mm; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            width: ${config?.paperWidth === '58mm' ? '58mm' : '80mm'}; 
            margin: 0; 
            padding: 5mm; 
            font-size: ${config?.fontSize === 'large' ? '14px' : config?.fontSize === 'small' ? '10px' : '12px'};
            position: relative;
          }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 10px; }
          .title { font-size: 18px; font-weight: bold; margin: 5px 0; }
          .custom-kot-header { font-size: 14px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 10px; }
          .table-num { font-size: 24px; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; }
          td { padding: 5px 0; border-bottom: 1px dotted #ccc; }
          .total-section { margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 30px;
            color: rgba(255, 0, 0, 0.2);
            font-weight: 900;
            z-index: -1;
            white-space: nowrap;
            letter-spacing: 5px;
            border: 2px solid rgba(255, 0, 0, 0.2);
            padding: 10px;
          }
        </style>
      </head>
      <body>
        ${data.isCancelled ? '<div class="watermark">CANCELLED</div>' : ''}
        <div class="header">
          ${!isBill && kotHeader ? `<div class="custom-kot-header">${kotHeader}</div>` : ''}
          <div class="title">${isBill ? (config?.restaurantName || 'RestoPro POS') : 'KOT - Kitchen Copy'}</div>
          ${isBill && config?.address ? `<div style="font-size: 9px;">${config.address}</div>` : ''}
          ${isBill && config?.phone ? `<div style="font-size: 9px;">Ph: ${config.phone}</div>` : ''}
          <div class="table-num">TABLE ${data.tableNumber}</div>
          <div style="font-weight: bold; margin-top: 5px;">${data.type} ${data.isCancelled ? '(CANCELLED)' : ''}</div>
        </div>
        
        <div class="meta">
          <span>Date: ${now}</span>
          <span>Order: #${data.orderId.slice(-5)}</span>
        </div>
        <div class="meta">
          <span>Captain: ${data.captainName}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="${isBill ? 'width: 60%;' : ''}">Item</th>
              <th style="text-align: center;">Qty</th>
              ${isBill ? '<th style="text-align: right;">Amount</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${(data.items || []).map(item => `
              <tr>
                <td>
                  <div style="font-weight: bold;">${item.itemName}</div>
                  ${item.notes ? `<div style="font-size: 10px; font-style: italic;">* ${item.notes}</div>` : ''}
                  ${isBill ? `<div style="font-size: 9px; color: #555;">₹${item.price} x ${item.quantity}</div>` : ''}
                </td>
                <td style="text-align: center; vertical-align: top;">${item.quantity}</td>
                ${isBill ? `<td style="text-align: right; vertical-align: top;">₹${((item.price || 0) * item.quantity).toFixed(2)}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${isBill ? `
          <div class="total-section">
            <div class="total-row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
            ${discount > 0 ? `<div class="total-row" style="color: #666;"><span>Discount:</span><span>-₹${discount.toFixed(2)}</span></div>` : ''}
            ${serviceCharge > 0 ? `<div class="total-row" style="font-weight: normal; font-size: 10px;"><span>Service Charge:</span><span>₹${serviceCharge.toFixed(2)}</span></div>` : ''}
            ${config?.showGst !== false ? `
              <div class="total-row" style="font-weight: normal; font-size: 10px;"><span>CGST (${((config?.gstPercentage || 5) / 2).toFixed(1)}%):</span><span>₹${cgst}</span></div>
              <div class="total-row" style="font-weight: normal; font-size: 10px;"><span>SGST (${((config?.gstPercentage || 5) / 2).toFixed(1)}%):</span><span>₹${sgst}</span></div>
            ` : ''}
            <div class="total-row" style="font-size: 16px; margin-top: 5px;"><span>TOTAL:</span><span>₹${grandTotal.toFixed(2)}</span></div>
          </div>
        ` : ''}

        <div class="footer">
          ${isBill ? (config?.footerMessage || 'Thank you for dining with us!') : (kotFooter || 'Kitchen Copy')}
          ${isBill && config?.thankYouMessage ? `<br>${config.thankYouMessage}` : ''}
          <br>Powered by RestoPro
        </div>

        <script>
          window.onload = () => {
             window.print();
             setTimeout(() => window.close(), 100);
          }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
