#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, 'dist');

// 1. Ensure dist directory exists; build automatically if needed
if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('\n[Lumina City Launcher] Production build not found. Running "npm run build" first...\n');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
    console.log('\n[Lumina City Launcher] Build completed successfully!\n');
  } catch (err) {
    console.error('[Lumina City Launcher] Error running build:', err.message);
    process.exit(1);
  }
}

// 2. MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

// 3. Create HTTP Server
const server = http.createServer((req, res) => {
  // Normalize URL and remove query strings or hash
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Security check: prevent directory traversal
  let safePath = path.normalize(path.join(distDir, pathname));
  if (!safePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end('Access Denied');
    return;
  }

  // If path is a directory, look for index.html
  if (fs.existsSync(safePath) && fs.statSync(safePath).isDirectory()) {
    safePath = path.join(safePath, 'index.html');
  }

  // SPA fallback: if file does not exist, fallback to dist/index.html
  if (!fs.existsSync(safePath)) {
    const ext = path.extname(pathname);
    if (!ext || ext === '.html') {
      safePath = path.join(distDir, 'index.html');
    }
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('File Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    // Offline caching headers
    res.setHeader('Cache-Control', 'no-cache');

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

// 4. Function to start server with fallback ports
function startServer(port = 8080, maxRetries = 10) {
  server.listen(port, () => {
    const localUrl = `http://localhost:${port}`;
    console.log('================================================================');
    console.log(' 🏙️  LUMINA CITY — Autonomous Intelligent City Showcase');
    console.log('    100% Offline Local Experience');
    console.log('================================================================');
    console.log(`\n  Local Server:  ${localUrl}`);
    console.log(`  Serving From:  ${distDir}`);
    console.log('\n  Features active:');
    console.log('  ✔ WebGL 3D City & Procedural Canvases');
    console.log('  ✔ Web Audio Synthesizer (Zero External Dependencies)');
    console.log('  ✔ Crisis Commander Game, Pointer Lock & Fullscreen');
    console.log('  ✔ All 5 AI Protocols & Urban Simulation Suite');
    console.log('\n  Press Ctrl+C anytime to stop.\n');
    console.log('================================================================\n');

    // Automatically open user browser
    const startCmd =
      process.platform === 'win32'
        ? `start "" "${localUrl}"`
        : process.platform === 'darwin'
        ? `open "${localUrl}"`
        : `xdg-open "${localUrl}"`;

    exec(startCmd, () => {});
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxRetries > 0) {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1, maxRetries - 1);
    } else {
      console.error('Failed to start local server:', err);
      process.exit(1);
    }
  });
}

startServer(8080);
