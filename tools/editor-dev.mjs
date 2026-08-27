#!/usr/bin/env node
/**
 * Tallinn Tastebuds — the editor, running on your own machine.
 *
 *   node tools/editor-dev.mjs        then open http://localhost:8787/admin/
 *
 * Cloudflare runs /admin/ against functions/api/[[path]].js, which commits to
 * GitHub. That is the right thing in production and a nuisance while working
 * on the editor itself: every trial run would be a commit, and you would need
 * a token to try anything at all.
 *
 * So this stands in for it. Same three endpoints, same shapes, but it reads
 * and writes the files in this checkout instead — a save lands in your working
 * tree, where `git diff` can look at it before you commit anything. The
 * password is whatever ADMIN_PASSWORD is set to, or "dev" if it is not.
 *
 * Zero dependencies, like everything else here.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, normalize } from 'node:path';
import { validateAll, serialise } from '../admin/place-rules.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const PASSWORD = process.env.ADMIN_PASSWORD || 'dev';
const COOKIE = 'ttb_admin=local';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'cache-control': 'no-store', ...headers });
  res.end(body);
};
const sendJSON = (res, status, body, headers = {}) =>
  send(res, status, JSON.stringify(body), { 'content-type': 'application/json; charset=utf-8', ...headers });

const readBody = (req) => new Promise((done, fail) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try { done(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
    catch (err) { fail(err); }
  });
  req.on('error', fail);
});

const signedIn = (req) => String(req.headers.cookie || '').includes(COOKIE);

async function photosOnDisk() {
  const base = join(ROOT, 'photos');
  const out = {};
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    out[entry.name] = (await readdir(join(base, entry.name))).filter((name) => !name.startsWith('.')).sort();
  }
  return out;
}

const readJSON = async (relative) => JSON.parse(await readFile(join(ROOT, relative), 'utf8'));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    /* ---------------------------------------------------------------- api */

    if (path === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      if (body.password !== PASSWORD) return sendJSON(res, 401, { error: 'Wrong password' });
      return sendJSON(res, 200, { ok: true }, { 'set-cookie': `${COOKIE}; Path=/; SameSite=Strict` });
    }

    if (path === '/api/logout' && req.method === 'POST') {
      return sendJSON(res, 200, { ok: true }, { 'set-cookie': 'ttb_admin=; Path=/; Max-Age=0' });
    }

    if (path.startsWith('/api/')) {
      if (!signedIn(req)) return sendJSON(res, 401, { error: 'Not signed in' });

      if (path === '/api/state' && req.method === 'GET') {
        return sendJSON(res, 200, {
          repo: 'your working tree',
          branch: 'local',
          sha: 'local',
          places: await readJSON('data/restaurants.json'),
          types: (await readJSON('data/taxonomy.json')).types || [],
          languages: Object.keys(await readJSON('data/ui.json')),
          photosById: await photosOnDisk()
        });
      }

      if (path === '/api/save' && req.method === 'POST') {
        const body = await readBody(req);
        const languages = Object.keys(await readJSON('data/ui.json'));
        const check = validateAll(body.places, {
          typeIds: ((await readJSON('data/taxonomy.json')).types || []).map((t) => t.id),
          languages,
          photosById: await photosAfter(body)
        });
        if (check.errors.length) return sendJSON(res, 422, { error: 'The data is not valid', errors: check.errors });

        for (const upload of body.uploads || []) {
          const target = safeJoin(upload.path);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, Buffer.from(upload.base64, 'base64'));
        }
        for (const gone of body.deletions || []) {
          const target = safeJoin(gone);
          if (existsSync(target)) await unlink(target);
        }
        await writeFile(join(ROOT, 'data/restaurants.json'), serialise(body.places, languages));

        console.log(`saved — ${body.places.length} places, ${(body.uploads || []).length} photos in, ${(body.deletions || []).length} out`);
        return sendJSON(res, 200, { ok: true, sha: 'local', warnings: check.warnings });
      }

      return sendJSON(res, 404, { error: 'No such endpoint' });
    }

    /* ------------------------------------------------------------- static */

    let file = path.endsWith('/') ? `${path}index.html` : path;
    const target = safeJoin(file.replace(/^\//, ''));
    if (!existsSync(target)) return send(res, 404, 'Not here');

    return send(res, 200, await readFile(target), { 'content-type': TYPES[extname(target)] || 'application/octet-stream' });
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: err.message });
  }
});

/** Nothing outside the checkout, whatever the path says. */
function safeJoin(relative) {
  const target = join(ROOT, normalize(relative).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(ROOT)) throw new Error('Outside the repository');
  return target;
}

async function photosAfter(body) {
  const photos = await photosOnDisk();
  for (const upload of body.uploads || []) {
    const [, id, file] = upload.path.split('/');
    (photos[id] = photos[id] || []).push(file);
  }
  for (const gone of body.deletions || []) {
    const [, id, file] = String(gone).split('/');
    if (photos[id]) photos[id] = photos[id].filter((name) => name !== file);
  }
  return photos;
}

server.listen(PORT, () => {
  console.log(`Editor:  http://localhost:${PORT}/admin/   (password: ${PASSWORD})`);
  console.log(`Map:     http://localhost:${PORT}/`);
  console.log('Saves are written to this checkout, not committed. Nothing reaches GitHub.');
});
