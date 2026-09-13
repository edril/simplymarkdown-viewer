const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');

const LOG_FILE = path.join(os.tmpdir(), 'markdown-viewer-debug.log');
function logToFile(message) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
  } catch {}
}

process.on('uncaughtException', (err) => {
  logToFile(`uncaughtException: ${err.stack || err}`);
});
process.on('unhandledRejection', (reason) => {
  logToFile(`unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});

const DIST_DIR = path.join(__dirname, 'dist');
const PORT = 47821;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const filePath = path.join(DIST_DIR, relativePath);

      if (!filePath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

let mainWindow;

async function createWindow() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    dialog.showErrorBox(
      'Build missing',
      'No web build found in electron/dist. Run "npm run build:web" in the electron folder first.'
    );
    app.quit();
    return;
  }

  try {
    await startServer();
  } catch (err) {
    logToFile(`server failed to start: ${err.stack || err}`);
    dialog.showErrorBox('Server error', String((err && err.stack) || err));
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    title: 'SimplyMarkdown Viewer',
    backgroundColor: '#faf9f7',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logToFile(`did-fail-load: code=${code} desc=${desc} url=${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logToFile(`render-process-gone: ${JSON.stringify(details)}`);
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
