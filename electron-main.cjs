const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "RestoPro Billing PC",
    icon: path.join(__dirname, 'public/favicon.ico')
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    // Correctly load local production build
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Fullscreen for POS machines
  // win.setFullScreen(true);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
