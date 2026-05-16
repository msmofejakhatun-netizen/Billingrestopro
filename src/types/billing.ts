import { Timestamp } from 'firebase/firestore';

export interface BillingConfiguration {
  id?: string;
  restaurantId: string;
  restaurantName: string;
  address: string;
  phone: string;
  email?: string;
  website?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  footerMessage?: string;
  thankYouMessage?: string;
  logoUrl?: string;
  qrCodeUrl?: string;
  upiId?: string;
  
  // Customization Options
  showLogo: boolean;
  showGst: boolean;
  showItemTax: boolean;
  showCaptainName: boolean;
  showTableName: boolean;
  showQrCode: boolean;
  showUpiQr: boolean;
  showCustomerCopy: boolean;
  showKitchenCopy: boolean;

  // Printer Settings
  paperWidth: '58mm' | '80mm';
  fontSize: 'small' | 'medium' | 'large';
  margin: number;
  autoCut: boolean;
  boldHeadings: boolean;

  // Tax Configuration
  gstPercentage: number;
  isGstInclusive: boolean;
  serviceChargePercentage: number;

  // Bill Numbering
  billNumberPrefix?: string;
  billNumberPattern?: string;

  updatedAt?: Timestamp;
}
