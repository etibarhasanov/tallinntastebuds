// Full-page screenshots out of headless Chromium, with nothing to install:
// Node 22 has a WebSocket client, and Chromium speaks its DevTools protocol
// over one. Written to look at mockup.html beside this file, and useful for
// any page here — the environment a session runs in has Chromium at
// /opt/pw-browsers/chromium and no Playwright.
//
//   node .claude/skills/chess/shoot.mjs '[
//     {"url":"http://127.0.0.1:8000/.claude/skills/chess/mockup.html?state=house&style=green",
//      "out":"house.png","width":390,"height":844,"mobile":true}
//   ]'
//
// Each shot takes `url`, `out`, `width`, `height`, `mobile` (a phone's touch
// and scale), optionally `scale` (device pixels per CSS pixel, 2 by default),
// `wait` (an expression polled until truthy — a diagram drawn after a fetch),
// `prep` (an expression run once before measuring — lifting a scroll box's
// max-height so the capture holds the whole of it) and `full: false` to
// capture the viewport alone. The pages here scroll their <body>, not the
// document, so a full-page capture grows the viewport to the body's height
// rather than asking the protocol for one.
//
// CHROME in the environment names another binary.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const shots = JSON.parse(process.argv[2] || '[]');
if (!shots.length) { console.error('shoot.mjs: a JSON list of shots is the one argument'); process.exit(1); }
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--remote-debugging-port=0', '--font-render-hinting=none',
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on('exit', (code) => reject(new Error('chrome exited ' + code)));
  setTimeout(() => reject(new Error('no devtools url\n' + buf)), 20000);
});

const port = new URL(wsUrl).port;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));

let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    events.push(msg);
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
function waitFor(method) {
  return new Promise((resolve) => {
    const tick = () => {
      const i = events.findIndex((e) => e.method === method);
      if (i !== -1) { events.splice(i, 1); resolve(); } else setTimeout(tick, 20);
    };
    tick();
  });
}
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');

for (const shot of shots) {
  const scale = shot.scale || 2;
  const metrics = (height) => send('Emulation.setDeviceMetricsOverride',
    { width: shot.width, height, deviceScaleFactor: scale, mobile: !!shot.mobile });
  await metrics(shot.height);
  const nav = send('Page.navigate', { url: shot.url });
  await waitFor('Page.loadEventFired');
  await nav;
  await evaluate('document.fonts.ready.then(() => true)');
  if (shot.wait) {
    for (let i = 0; i < 100 && !(await evaluate(shot.wait)); i++) await new Promise((r) => setTimeout(r, 100));
  }
  if (shot.prep) await evaluate(shot.prep);
  await new Promise((r) => setTimeout(r, 250));
  const height = shot.full === false
    ? shot.height
    : Math.max(shot.height, await evaluate('Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))'));
  if (height !== shot.height) {
    await metrics(height);
    await new Promise((r) => setTimeout(r, 150));
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shot.out, Buffer.from(data, 'base64'));
  console.log('wrote', shot.out, shot.width + 'x' + height);
}

ws.close();
chrome.kill();
