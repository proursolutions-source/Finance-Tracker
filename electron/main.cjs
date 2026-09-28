/**
 * MoneyFlow desktop shell — loads the same built web app (dist/) that the
 * PWA and Capacitor Android build use, in a plain BrowserWindow. The build
 * uses root-absolute asset paths ("/assets/..."), which don't resolve under
 * a bare file:// origin, so a tiny local static server stands in for one —
 * no new runtime dependency, just Node's built-in http/fs modules.
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const MIME_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(DIST_DIR)) filePath = path.join(DIST_DIR, 'index.html');

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback: unknown paths (e.g. a deep-linked hash route reload) get index.html.
          fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, indexData) => {
            if (err2) { res.writeHead(404); res.end('Not found'); return; }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexData);
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  const port = await startStaticServer();

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 400,
    minHeight: 600,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'public', 'icons', 'icon-512x512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(`http://127.0.0.1:${port}/`);

  // Open external links (e.g. subscription/legal pages) in the user's real
  // browser instead of navigating the app window away from itself.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
