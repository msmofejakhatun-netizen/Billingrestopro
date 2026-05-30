import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  enableIndexedDbPersistence 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// @ts-ignore - firestoreDatabaseId is in the config but may not be in the type
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Firestore persistence failed-precondition: Multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.warn("Firestore persistence unimplemented in this browser.");
  }
});

// Custom lightweight Mock Auth that behaves exactly like Firebase Auth but backs to localStorage and REST
class MockAuth {
  private listeners: ((user: any) => void)[] = [];

  get currentUser() {
    const stored = localStorage.getItem('restopro_profile');
    if (!stored) return null;
    try {
      const profile = JSON.parse(stored);
      return {
        uid: profile.uid,
        email: profile.email || `${profile.username || 'staff'}@restopro.com`,
        displayName: profile.name,
        role: profile.role,
        isAnonymous: false,
        getIdToken: async (force?: boolean) => {
          return localStorage.getItem('restopro_token') || '';
        }
      };
    } catch {
      return null;
    }
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    // Immediately invoke callback with the current state to bootstrap the app instantly!
    setTimeout(() => {
      callback(this.currentUser);
    }, 0);

    // Return an unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Trigger when auth state changes
  notifyStateChange() {
    const user = this.currentUser;
    this.listeners.forEach(cb => {
      try {
        cb(user);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const auth = new MockAuth() as any;
export const secondaryAuth = new MockAuth() as any;

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    } else {
      console.warn("Firebase connection test yielded a typical response or expected error:", error);
    }
  }
}

testConnection();
