// Tiny static server for playing Solara Bay locally:
//   node serve.ts [--port 8080]
// Serves game/ at the root, so http://localhost:8080 opens index.html.
// Also answers /health and /version for the playtest and shot tools.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url).pathname;
const gameDir = join(here, 'game');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};

function portFromArgs() {
  const idx = process.argv.indexOf('--port');
  if (idx >= 0 && process.argv[idx + 1]) {
    const port = Number(process.argv[idx + 1]);
    if (Number.isInteger(port) && port > 0) return port;
  }
  return 8080;
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, game: 'solara-bay' }));
    return;
  }
  if (url.pathname === '/version') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ game: 'solara-bay', version: '0.4.0', difficulties: ['chill', 'normal', 'hardcore'] }));
    return;
  }
  let rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = join(gameDir, normalize(rel));
  if (!file.startsWith(gameDir) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff' });
  res.end(readFileSync(file));
});

const port = portFromArgs();
server.listen(port, () => {
  console.log('Solara Bay at http://localhost:' + port + '/');
});
