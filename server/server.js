const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.PIXEL_DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.PIXEL_UPLOAD_DIR || path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'rooms.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let rooms = {};
try { rooms = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (_) {}
let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const next = DB_FILE + '.tmp';
    fs.writeFileSync(next, JSON.stringify(rooms, null, 2));
    fs.renameSync(next, DB_FILE);
  }, 80);
}
function validCode(c) { return /^[A-Z0-9]{6}$/.test(String(c || '')); }
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do c = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); while (rooms[c]);
  return c;
}
function normalizeRoom(r) {
  r.world ||= {};
  r.world.layout ||= {};
  r.memory ||= {};
  r.memory.mementos ||= [];
  r.memory.notes ||= [];
  r.memory.photos ||= [];
  r.memory.activity ||= [];
  r.quest ||= { items: [] };
  r.quest.items ||= [];
  r.music ||= null;
  r.meta ||= {};
  r.revisions ||= [];
  r.meta.revision ||= 1;
  r.meta.createdAt ||= r.createdAt || Date.now();
  r.meta.updatedAt ||= r.updatedAt || r.meta.createdAt;
  r.meta.lastVisitedAt ||= r.meta.updatedAt;
  return r;
}
function roomToken() { return crypto.randomBytes(24).toString('base64url'); }
function tokenHash(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function isOwner(req, r) {
  if (!r.ownerHash) return false;
  const token = req.headers['x-room-owner'] || '';
  if (!token) return false;
  const a = Buffer.from(tokenHash(token));
  const b = Buffer.from(r.ownerHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function publicRoom(r) {
  normalizeRoom(r);
  const { ownerHash, revisions, ...safe } = r;
  return safe;
}
function recordRevision(r, kind, data, label='') {
  normalizeRoom(r);
  const payload = JSON.stringify(data ?? null);
  const last = r.revisions[r.revisions.length - 1];
  if (last && last.kind === kind && JSON.stringify(last.data ?? null) === payload) return last;
  const rev = {
    id: crypto.randomBytes(8).toString('hex'),
    kind,
    label: String(label || kind),
    data: JSON.parse(payload),
    createdAt: Date.now()
  };
  r.revisions.push(rev);
  if (r.revisions.length > 30) r.revisions = r.revisions.slice(-30);
  return rev;
}
function touchRoom(r) {
  normalizeRoom(r);
  r.updatedAt = Date.now();
  r.meta.updatedAt = r.updatedAt;
  r.meta.revision = (r.meta.revision || 0) + 1;
  saveDB();
}
Object.values(rooms).forEach(normalizeRoom);

function json(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': b.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Room-Owner',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
  });
  res.end(b);
}
function readBody(req, limit = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', c => {
      n += c.length;
      if (n > limit) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function safeJoin(base, target) {
  const p = path.resolve(base, '.' + target);
  return p.startsWith(path.resolve(base)) ? p : null;
}
const mimes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.wav': 'audio/wav', '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml'
};

function parseMultipart(body, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return null;
  const boundary = '--' + (m[1] || m[2]);
  const all = body.toString('latin1');
  const parts = all.split(boundary).slice(1, -1);
  for (const raw of parts) {
    const idx = raw.indexOf('\r\n\r\n');
    if (idx < 0) continue;
    const head = raw.slice(0, idx);
    if (!/name="file"/i.test(head)) continue;
    const fn = /filename="([^"]*)"/i.exec(head)?.[1] || 'upload.bin';
    let dataStr = raw.slice(idx + 4);
    if (dataStr.endsWith('\r\n')) dataStr = dataStr.slice(0, -2);
    return { filename: path.basename(fn), data: Buffer.from(dataStr, 'latin1') };
  }
  return null;
}

function addUnique(arr, item) {
  if (!item?.id) return;
  const i = arr.findIndex(x => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
}
function applyMemoryOp(r, op) {
  normalizeRoom(r);
  if (!op?.kind) return;
  if (op.kind === 'memento:add') addUnique(r.memory.mementos, op.item);
  if (op.kind === 'note:add') addUnique(r.memory.notes, op.item);
  if (op.kind === 'photo:add') addUnique(r.memory.photos, op.item);
  if (op.kind === 'activity:add') {
    addUnique(r.memory.activity, op.item);
    r.memory.activity = r.memory.activity.slice(-60);
  }
  if (op.kind === 'world:patch' && op.patch) r.world = { ...r.world, ...op.patch };
  touchRoom(r);
}
function applyQuestOp(r, op) {
  normalizeRoom(r);
  if (!op?.kind) return;
  if (op.kind === 'add' && op.item) addUnique(r.quest.items, op.item);
  if (op.kind === 'move') {
    const item = r.quest.items.find(x => x.id === op.id);
    if (item) { item.x = op.x; item.y = op.y; }
  }
  if (op.kind === 'clear') r.quest.items = [];
  if (op.kind === 'set' && Array.isArray(op.items)) r.quest.items = op.items;
  touchRoom(r);
}

const channels = new Map();
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function chset(key) { if (!channels.has(key)) channels.set(key, new Set()); return channels.get(key); }
function connectionCount() { let n = 0; for (const s of channels.values()) n += s.size; return n; }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Room-Owner', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' });
    return res.end();
  }
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = u.pathname;
  try {
    if (pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, version: 'v15.1', rooms: Object.keys(rooms).length, connections: connectionCount(), durableDataDir: !!process.env.PIXEL_DATA_DIR, durableUploadDir: !!process.env.PIXEL_UPLOAD_DIR, time: Date.now() });
    if (pathname === '/api/rooms' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const code = String(body.code || randomCode()).toUpperCase();
      if (!validCode(code)) return json(res, 400, { error: 'invalid_room_code' });
      if (rooms[code]) return json(res, 409, { error: 'room_exists' });
      const ownerToken = roomToken();
      rooms[code] = normalizeRoom({ code, world: body.world || {}, memory: body.memory || {}, quest: { items: [] }, music: null, ownerHash: tokenHash(ownerToken), createdAt: Date.now(), updatedAt: Date.now() });
      saveDB();
      return json(res, 200, { ...publicRoom(rooms[code]), ownerToken });
    }
    const claimm = /^\/api\/rooms\/([A-Z0-9]{6})\/claim$/.exec(pathname);
    if (claimm && req.method === 'POST') {
      const r = rooms[claimm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      if (r.ownerHash) return json(res, 409, { error: 'owner_already_claimed' });
      const ownerToken = roomToken();
      r.ownerHash = tokenHash(ownerToken);
      touchRoom(r);
      return json(res, 200, { ok: true, ownerToken, meta: r.meta });
    }
    const revisionsm = /^\/api\/rooms\/([A-Z0-9]{6})\/revisions$/.exec(pathname);
    if (revisionsm && req.method === 'GET') {
      const r = rooms[revisionsm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      if (!isOwner(req, r)) return json(res, 403, { error: 'owner_required' });
      normalizeRoom(r);
      const items = r.revisions.slice().reverse().map(({ id, kind, label, createdAt }) => ({ id, kind, label, createdAt }));
      return json(res, 200, { ok: true, revisions: items, meta: r.meta });
    }
    const restorem = /^\/api\/rooms\/([A-Z0-9]{6})\/revisions\/([a-f0-9]{16})\/restore$/.exec(pathname);
    if (restorem && req.method === 'POST') {
      const r = rooms[restorem[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      if (!isOwner(req, r)) return json(res, 403, { error: 'owner_required' });
      normalizeRoom(r);
      const rev = r.revisions.find(x => x.id === restorem[2]);
      if (!rev) return json(res, 404, { error: 'revision_not_found' });
      if (rev.kind !== 'layout') return json(res, 400, { error: 'unsupported_revision_kind' });
      recordRevision(r, 'layout', r.world.layout || {}, '恢复前自动备份');
      r.world = { ...r.world, layout: JSON.parse(JSON.stringify(rev.data || {})) };
      touchRoom(r);
      return json(res, 200, { ok: true, layout: r.world.layout, restoredRevision: rev.id, meta: r.meta });
    }
    const layoutm = /^\/api\/rooms\/([A-Z0-9]{6})\/layout$/.exec(pathname);
    if (layoutm && req.method === 'PUT') {
      const r = rooms[layoutm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      if (!isOwner(req, r)) return json(res, 403, { error: 'owner_required' });
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const layout = b.layout && typeof b.layout === 'object' ? b.layout : {};
      const before = JSON.parse(JSON.stringify(r.world.layout || {}));
      if (JSON.stringify(before) !== JSON.stringify(layout)) recordRevision(r, 'layout', before, b.label || '房间布置');
      r.world = { ...r.world, layout };
      touchRoom(r);
      return json(res, 200, { ok: true, layout: r.world.layout, meta: r.meta });
    }
    const opm = /^\/api\/rooms\/([A-Z0-9]{6})\/ops$/.exec(pathname);
    if (opm && req.method === 'POST') {
      const r = rooms[opm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (b.scope === 'memory') applyMemoryOp(r, b.op);
      else if (b.scope === 'quest') applyQuestOp(r, b.op);
      else if (b.scope === 'world' && b.op?.patch) {
        const { layout, ...safePatch } = b.op.patch;
        applyMemoryOp(r, { kind: 'world:patch', patch: safePatch });
      }
      else return json(res, 400, { error: 'invalid_op' });
      return json(res, 200, { ok: true, updatedAt: r.updatedAt });
    }
    const rm = /^\/api\/rooms\/([A-Z0-9]{6})$/.exec(pathname);
    if (rm && req.method === 'GET') {
      const r = rooms[rm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      normalizeRoom(r);
      r.meta.lastVisitedAt = Date.now();
      saveDB();
      return json(res, 200, publicRoom(r));
    }
    if (rm && req.method === 'PUT') {
      const r = rooms[rm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (b.world) {
        const { layout, ...safeWorld } = b.world;
        r.world = { ...r.world, ...safeWorld };
      }
      if (b.memory) r.memory = b.memory;
      if (b.quest) r.quest = b.quest;
      if ('music' in b) r.music = b.music;
      normalizeRoom(r);
      touchRoom(r);
      return json(res, 200, publicRoom(r));
    }
    if (pathname === '/api/uploads' && req.method === 'POST') {
      const body = await readBody(req, 18 * 1024 * 1024);
      const part = parseMultipart(body, req.headers['content-type']);
      if (!part) return json(res, 400, { error: 'missing_file' });
      const ext = (path.extname(part.filename) || '.bin').replace(/[^.a-zA-Z0-9]/g, '');
      const name = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), part.data);
      const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
      const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
      return json(res, 200, { ok: true, url: `${proto}://${host}/uploads/${name}`, name: part.filename, size: part.data.length });
    }
    if (pathname.startsWith('/uploads/')) {
      const file = safeJoin(UPLOAD_DIR, pathname.replace('/uploads', ''));
      if (!file || !fs.existsSync(file)) return json(res, 404, { error: 'not_found' });
      const st = fs.statSync(file);
      res.writeHead(200, { 'Content-Type': mimes[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' });
      return fs.createReadStream(file).pipe(res);
    }
    const target = pathname === '/' ? '/index.html' : pathname;
    const file = safeJoin(ROOT, target);
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    const st = fs.statSync(file);
    res.writeHead(200, { 'Content-Type': mimes[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: e.message === 'too_large' ? 'file_too_large' : 'server_error' });
  }
});

function wsFrame(text, opcode = 0x1) {
  const p = Buffer.isBuffer(text) ? text : Buffer.from(text);
  let h;
  if (p.length < 126) { h = Buffer.alloc(2); h[0] = 0x80 | opcode; h[1] = p.length; }
  else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | opcode; h[1] = 126; h.writeUInt16BE(p.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | opcode; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
  return Buffer.concat([h, p]);
}
function wsSend(socket, obj) { if (!socket.destroyed) socket.write(wsFrame(JSON.stringify(obj))); }
function wsBroadcast(key, obj, except) { for (const s of (channels.get(key) || [])) if (s !== except && !s.destroyed) wsSend(s, obj); }
function parseFrames(socket, chunk, onText) {
  socket._wsbuf = Buffer.concat([socket._wsbuf || Buffer.alloc(0), chunk]);
  while (socket._wsbuf.length >= 2) {
    const b = socket._wsbuf;
    const fin = !!(b[0] & 0x80);
    const op = b[0] & 0x0f;
    const masked = !!(b[1] & 0x80);
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; const n = Number(b.readBigUInt64BE(2)); if (!Number.isSafeInteger(n)) return socket.destroy(); len = n; off = 10; }
    let mask;
    if (masked) { if (b.length < off + 4) return; mask = b.subarray(off, off + 4); off += 4; }
    if (b.length < off + len) return;
    let payload = Buffer.from(b.subarray(off, off + len));
    socket._wsbuf = b.subarray(off + len);
    if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    if (op === 0x8) { socket.end(); return; }
    if (op === 0x9) { if (!socket.destroyed) socket.write(wsFrame(payload, 0xA)); continue; }
    if (op === 0x1 && fin) { onText(payload.toString('utf8')); continue; }
    if ((op === 0x1 || op === 0x2) && !fin) { socket._fragOp = op; socket._fragChunks = [payload]; continue; }
    if (op === 0x0 && socket._fragChunks) {
      socket._fragChunks.push(payload);
      if (fin) {
        const all = Buffer.concat(socket._fragChunks);
        const fragOp = socket._fragOp;
        socket._fragChunks = null; socket._fragOp = null;
        if (fragOp === 0x1) onText(all.toString('utf8'));
      }
    }
  }
}

server.on('upgrade', (req, socket) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (u.pathname !== '/ws') return socket.destroy();
  const room = String(u.searchParams.get('room') || '').toUpperCase();
  const channel = u.searchParams.get('channel') || 'room';
  const player = u.searchParams.get('player') || 'anon';
  if (!validCode(room)) return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  const ck = `${room}::${channel}`;
  chset(ck).add(socket);
  socket._meta = { room, channel, player, ck };

  const r = rooms[room];
  if (r) {
    normalizeRoom(r);
    if (channel.includes('quest')) wsSend(socket, { type: 'quest-update', sender: 'server', items: r.quest.items });
    else {
      wsSend(socket, { type: 'room-snapshot', sender: 'server', memory: r.memory, world: r.world, music: r.music });
      if (r.music) wsSend(socket, { type: 'music-sync', sender: 'server', music: r.music });
    }
  }

  socket.on('data', chunk => parseFrames(socket, chunk, text => {
    let m;
    try { m = JSON.parse(text); } catch (_) { return; }
    const rr = rooms[room];
    if (m.type === 'ping') return wsSend(socket, { type: 'pong', sender: 'server', t: m.t, serverTime: Date.now() });
    if (rr) {
      normalizeRoom(rr);
      if (m.type === 'memory' && m.memory) { rr.memory = m.memory; normalizeRoom(rr); rr.updatedAt = Date.now(); saveDB(); }
      if (m.type === 'memory-op' && m.op) applyMemoryOp(rr, m.op);
      if (m.type === 'world-patch' && m.patch) {
        const { layout, ...safePatch } = m.patch;
        applyMemoryOp(rr, { kind: 'world:patch', patch: safePatch });
      }
      if (m.type === 'music-sync' && m.music) { rr.music = m.music; rr.world = { ...rr.world, music: m.music.track || rr.world.music, customMusicName: m.music.name || rr.world.customMusicName, customMusicUrl: m.music.url || rr.world.customMusicUrl }; rr.updatedAt = Date.now(); saveDB(); }
      if (m.type === 'quest-update' && Array.isArray(m.items)) { rr.quest = { items: m.items }; rr.updatedAt = Date.now(); saveDB(); }
      if (m.type === 'quest-op' && m.op) applyQuestOp(rr, m.op);
    }
    wsBroadcast(ck, m, socket);
  }));
  const close = () => { const s = channels.get(ck); s?.delete(socket); if (s && !s.size) channels.delete(ck); };
  socket.on('close', close); socket.on('end', close); socket.on('error', close);
});

server.listen(PORT, () => console.log(`Pixel Memory V15.1 server: http://localhost:${PORT}`));
