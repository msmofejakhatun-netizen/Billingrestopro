import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yallayalla.captain',
  appName: 'YallaYalla Captain',
  webDir: 'dist',
  server: {
    // Allows the app to connect to the local billing server or cloud
    allowNavigation: ['*'],
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
