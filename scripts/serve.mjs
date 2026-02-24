import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = normalize(join(__dirname, '..'));

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8000);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`);
    const rawPath = decodeURIComponent(url.pathname);
    const requestPath = rawPath === '/' ? '/index.html' : rawPath;

    const safePath = normalize(join(rootDir, `.${requestPath}`));
    if (!safePath.startsWith(rootDir)) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    let filePath = safePath;
    const info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      await access(filePath);
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } catch (_error) {
    sendText(res, 404, 'Not Found');
  }
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}
