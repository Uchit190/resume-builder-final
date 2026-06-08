const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.FRONTEND_HOST || '0.0.0.0';
const PORT = Number(process.env.FRONTEND_PORT || 2928);
const ROOT = __dirname;

const routes = new Map([
  ['/', 'index.html'],
  ['/index', 'index.html'],
  ['/login', 'index.html'],
  ['/dashboard', 'dashboard.html'],
  ['/signup', 'signup.html'],
  ['/technical', 'technical.html'],
  ['/non-technical', 'non-technical.html'],
]);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function resolveRequestPath(url) {
  const requestUrl = new URL(url, `http://${HOST}:${PORT}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const routeFile = routes.get(pathname);
  const requestedFile = routeFile || pathname.replace(/^\/+/, '') || 'index.html';
  const absolutePath = path.resolve(ROOT, requestedFile);

  if (!absolutePath.startsWith(ROOT)) {
    return null;
  }

  return absolutePath;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.code === 'ENOENT' ? 'File not found.' : 'Server error.');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
    });
    res.end(content);
  });
}

http
  .createServer((req, res) => {
    const filePath = resolveRequestPath(req.url);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden.');
      return;
    }

    sendFile(res, filePath);
  })
  .listen(PORT, HOST, () => {
    console.log(`ResumeForge frontend running on http://${HOST}:${PORT}`);
  });
