import { auth, db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';

class SecurityService {
  private deviceId: string;

  constructor() {
    this.deviceId = localStorage.getItem('restopro_device_id') || this.generateDeviceId();
    localStorage.setItem('restopro_device_id', this.deviceId);
  }

  private generateDeviceId() {
    return 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  getDeviceId() {
    return this.deviceId;
  }

  async authorizeDevice(userId: string, restaurantId: string) {
    try {
      const deviceRef = doc(db, 'authorizedDevices', this.deviceId);
      const snap = await getDoc(deviceRef);

      if (!snap.exists()) {
        await setDoc(deviceRef, {
          deviceId: this.deviceId,
          restaurantId,
          authorizedBy: userId,
          lastUsedAt: serverTimestamp(),
          status: 'pending', // Enterprise devices must be approved by owner
          metadata: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
          }
        });
        return false; // Needs approval
      }

      if (snap.data().status !== 'active') {
        return false;
      }

      await updateDoc(deviceRef, { lastUsedAt: serverTimestamp() });
      return true;
    } catch (error) {
      console.error("Device Auth Failed:", error);
      return false;
    }
  }
}

export const securityService = new SecurityService();
