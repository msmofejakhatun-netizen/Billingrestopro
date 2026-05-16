# RestoPro Enterprise Deployment Guide

RestoPro is a full-stack restaurant operating system built with React, Vite, Express, and Firebase. It supports offline-first operation via local sync and real-time cloud updates.

## 1. Environment Setup

### Firebase Configuration
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com).
2. Enable Firestore (Enterprise edition recommended) and Authentication (Google & Email).
3. Create a Web App and copy the config to `firebase-applet-config.json`.
4. Deploy security rules from `firestore.rules`.

### Environment Variables (.env)
```env
# Server Side
GEMINI_API_KEY=your_key_here
PORT=3000

# Client Side (Vite)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

## 2. Docker Deployment (Recommended for VPS)

### Dockerfile
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Build & Run
```bash
docker build -t restopro-enterprise .
docker run -p 3000:3000 --env-file .env restopro-enterprise
```

## 3. Desktop Installation (Electron)

RestoPro includes an Electron interface for direct thermal printer access and offline stability.

1. Install dependencies: `npm install`
2. Run in dev: `npm run dev:electron` (if configured)
3. Build for Production:
   ```bash
   npx electron-builder build --win --publish never
   ```
This generates an `.exe` in the `dist_electron` folder.

## 4. Mobile Installation (Android/APK)

1. Sync Capacitor: `npx cap sync`
2. Open in Android Studio: `npx cap open android`
3. Generate Signed APK:
   - Build > Generate Signed Bundle / APK
   - Choose APK > Select your Keystore
   - Result: `app-release.apk`

## 5. Reverse Proxy (Nginx)

Example Nginx block for your domain:

```nginx
server {
    listen 80;
    server_name pos.yourbrand.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 6. Enterprise Health Check

- Monitor status at `/enterprise` (Owner Only).
- Ensure `authorizedDevices` are approved before staff can login.
- Daily backups are automated, but manual export is available in `Settings > Backup`.
