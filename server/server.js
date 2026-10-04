const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRoomStore } = require('./storage-adapter');
const { createBlobStore } = require('./blob-adapter');

const PORT = Number(process.env.PORT || 8787);
const ARCHIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.PIXEL_DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.PIXEL_UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const roomStore = createRoomStore({ dataDir: DATA_DIR });
const blobStore = createBlobStore({ uploadDir: UPLOAD_DIR });

let rooms = roomStore.load();
function saveDB() { roomStore.saveSoon(rooms); }
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
  r.actors ||= {};
  r.revisions ||= [];
  r.meta.revision ||= 1;
  r.meta.createdAt ||= r.createdAt || Date.now();
  r.meta.updatedAt ||= r.updatedAt || r.meta.createdAt;
  r.meta.lastVisitedAt ||= r.meta.updatedAt;
  if (!('archivedAt' in r.meta)) r.meta.archivedAt = null;
  if (!('purgeAfter' in r.meta)) r.meta.purgeAfter = null;
  r.meta.uploads ||= [];
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
function actorCredential(req) {
  return {
    id: String(req.headers['x-actor-id'] || '').trim(),
    token: String(req.headers['x-actor-token'] || '')
  };
}
function verifyActor(req, r, { allowRegister=false } = {}) {
  normalizeRoom(r);
  const { id, token } = actorCredential(req);
  if (!id || !token || id.length > 120 || token.length > 240) return { ok:false, error:'actor_required' };
  const hash = tokenHash(token);
  const known = r.actors[id];
  if (!known) {
    if (!allowRegister) return { ok:false, error:'actor_unknown' };
    r.actors[id] = hash;
    return { ok:true, id, registered:true };
  }
  const a = Buffer.from(hash), b = Buffer.from(known);
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return { ok:false, error:'actor_invalid' };
  return { ok:true, id };
}
function canCurate(req, r, item, { allowRegister=false } = {}) {
  if (isOwner(req,r)) return { ok:true, role:'owner', actorId:actorCredential(req).id || '' };
  const actor = verifyActor(req,r,{allowRegister});
  if (!actor.ok) return actor;
  if (!item || item.authorId === actor.id) return { ok:true, role:'author', actorId:actor.id };
  return { ok:false, error:'not_author' };
}
function publicRoom(r) {
  normalizeRoom(r);
  const { ownerHash, actors, revisions, ...safe } = r;
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
function isArchived(r) { normalizeRoom(r); return !!r.meta.archivedAt; }
function collectRoomUploadKeys(r) {
  const keys=new Set(r?.meta?.uploads || []);
  const visit=v=>{
    if (typeof v === 'string') {
      const m=/\/uploads\/([^?#"'\s]+)/.exec(v);
      if (m?.[1]) keys.add(decodeURIComponent(m[1]));
      return;
    }
    if (Array.isArray(v)) return v.forEach(visit);
    if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(r?.world); visit(r?.memory); visit(r?.quest); visit(r?.music);
  return [...keys];
}
function closeRoomConnections(room, reason='room-archived') {
  for (const [key,set] of channels) {
    if (!key.startsWith(room+'::')) continue;
    for (const socket of [...set]) {
      try { wsSend(socket,{type:reason,sender:'server',room}); } catch(_){}
      try { socket.end(); } catch(_){}
    }
    channels.delete(key);
  }
}
function purgeRoom(code, reason='permanent-delete') {
  const r=rooms[code];
  if (!r) return {removed:false,blobs:0};
  normalizeRoom(r);
  const keys=collectRoomUploadKeys(r);
  closeRoomConnections(code,'room-deleted');
  delete rooms[code];
  const blobs=blobStore.removeMany?.(keys) || 0;
  roomStore.saveNow(rooms);
  return {removed:true,blobs,reason};
}
function sweepExpiredArchives() {
  const now=Date.now(); let removed=0;
  for (const [code,r] of Object.entries(rooms)) {
    normalizeRoom(r);
    if (r.meta.archivedAt && r.meta.purgeAfter && Number(r.meta.purgeAfter) <= now) {
      purgeRoom(code,'retention-expired'); removed++;
    }
  }
  return removed;
}
Object.values(rooms).forEach(normalizeRoom);

function json(res, status, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': b.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Room-Owner, X-Actor-Id, X-Actor-Token, X-Room-Code',
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
  if (op.kind === 'memento:move') {
    const item = r.memory.mementos.find(x => x.id === op.id);
    if (item) { item.x = Number(op.x); item.y = Number(op.y); }
  }
  if (op.kind === 'memento:update') {
    const item = r.memory.mementos.find(x => x.id === op.id);
    if (item) {
      if (typeof op.title === 'string') item.title = op.title.slice(0,80);
      if (typeof op.meaning === 'string') item.meaning = op.meaning.slice(0,500);
      if (typeof op.type === 'string') item.type = op.type.slice(0,8);
    }
  }
  if (op.kind === 'memento:hide') {
    const item = r.memory.mementos.find(x => x.id === op.id);
    if (item) item.hidden = !!op.hidden;
  }
  if (op.kind === 'memento:remove') r.memory.mementos = r.memory.mementos.filter(x => x.id !== op.id);
  if (op.kind === 'note:add') addUnique(r.memory.notes, op.item);
  if (op.kind === 'note:remove') r.memory.notes = r.memory.notes.filter(x => x.id !== op.id);
  if (op.kind === 'photo:add') addUnique(r.memory.photos, op.item);
  if (op.kind === 'photo:remove') r.memory.photos = r.memory.photos.filter(x => x.id !== op.id);
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
    if (item) { item.x = Number(op.x); item.y = Number(op.y); }
  }
  if (op.kind === 'update') {
    const item = r.quest.items.find(x => x.id === op.id);
    if (item) {
      if (typeof op.title === 'string') item.title = op.title.slice(0,100);
      if (typeof op.text === 'string') item.text = op.text.slice(0,800);
    }
  }
  if (op.kind === 'hide') {
    const item = r.quest.items.find(x => x.id === op.id);
    if (item) item.hidden = !!op.hidden;
  }
  if (op.kind === 'remove') r.quest.items = r.quest.items.filter(x => x.id !== op.id);
  if (op.kind === 'clear') r.quest.items = [];
  if (op.kind === 'set' && Array.isArray(op.items)) r.quest.items = op.items;
  touchRoom(r);
}
function itemForOp(r, scope, op) {
  if (scope === 'memory') {
    if (op.kind?.startsWith('memento:')) return r.memory.mementos.find(x=>x.id===op.id) || null;
    if (op.kind === 'note:remove') return r.memory.notes.find(x=>x.id===op.id) || null;
    if (op.kind === 'photo:remove') return r.memory.photos.find(x=>x.id===op.id) || null;
  }
  if (scope === 'quest' && ['move','hide','remove'].includes(op.kind)) return r.quest.items.find(x=>x.id===op.id) || null;
  return null;
}
function authorizeOp(req, r, scope, op) {
  normalizeRoom(r);
  const addKinds = scope === 'memory'
    ? new Set(['memento:add','note:add','photo:add','activity:add'])
    : new Set(['add']);
  if (addKinds.has(op?.kind)) {
    const actor = verifyActor(req,r,{allowRegister:true});
    if (!actor.ok) return actor;
    if (op.item && typeof op.item === 'object') op.item.authorId = actor.id;
    return { ok:true, role:'author', actorId:actor.id };
  }
  if (scope === 'memory' && op?.kind === 'memento:update') {
    const item=itemForOp(r,scope,op);
    if (!item) return { ok:false, error:'item_not_found', status:404 };
    const actor=verifyActor(req,r);
    if (!actor.ok) return actor;
    return item.authorId === actor.id ? {ok:true,role:'author',actorId:actor.id} : {ok:false,error:'not_author'};
  }
  if (scope === 'quest' && op?.kind === 'update') {
    const item=r.quest.items.find(x=>x.id===op.id) || null;
    if (!item) return { ok:false, error:'item_not_found', status:404 };
    const actor=verifyActor(req,r);
    if (!actor.ok) return actor;
    return item.authorId === actor.id ? {ok:true,role:'author',actorId:actor.id} : {ok:false,error:'not_author'};
  }
  const privilegedMemory = scope === 'memory' && new Set(['memento:move','memento:hide','memento:remove','note:remove','photo:remove']).has(op?.kind);
  const privilegedQuest = scope === 'quest' && new Set(['move','hide','remove']).has(op?.kind);
  if (privilegedMemory || privilegedQuest) {
    const item=itemForOp(r,scope,op);
    if (!item) return { ok:false, error:'item_not_found', status:404 };
    return canCurate(req,r,item);
  }
  if (scope === 'quest' && ['clear','set'].includes(op?.kind)) return isOwner(req,r) ? {ok:true,role:'owner'} : {ok:false,error:'owner_required'};
  if (scope === 'world') return {ok:true};
  return {ok:false,error:'invalid_op'};
}

const channels = new Map();
function broadcastRoomScope(room, scope, payload) {
  const wantQuest = scope === 'quest';
  for (const [key,set] of channels) {
    if (!key.startsWith(room+'::')) continue;
    const isQuest = key.toLowerCase().includes('quest');
    if (isQuest !== wantQuest) continue;
    for (const socket of set) if (!socket.destroyed) wsSend(socket,payload);
  }
}
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function chset(key) { if (!channels.has(key)) channels.set(key, new Set()); return channels.get(key); }
function connectionCount() { let n = 0; for (const s of channels.values()) n += s.size; return n; }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Room-Owner, X-Actor-Id, X-Actor-Token, X-Room-Code', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' });
    return res.end();
  }
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = u.pathname;
  try {
    sweepExpiredArchives();
    if (pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, version: 'v15.5', rooms: Object.keys(rooms).length, archivedRooms: Object.values(rooms).filter(r=>isArchived(r)).length, retentionDays:30, connections: connectionCount(), roomStore: roomStore.info().kind, blobStore: blobStore.info().kind, durableDataDir: !!process.env.PIXEL_DATA_DIR, durableUploadDir: !!process.env.PIXEL_UPLOAD_DIR, time: Date.now() });
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

    const recoveryVerify = /^\/api\/rooms\/([A-Z0-9]{6})\/recovery\/verify$/.exec(pathname);
    if (recoveryVerify && req.method === 'POST') {
      const r = rooms[recoveryVerify[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      normalizeRoom(r);

      const owner = isOwner(req, r);
      const actor = actorCredential(req);
      let actorStatus = 'missing';
      if (actor.id || actor.token) {
        if (!actor.id || !actor.token || actor.id.length > 120 || actor.token.length > 240) actorStatus = 'invalid';
        else {
          const known = r.actors[actor.id];
          if (!known) actorStatus = 'unknown';
          else {
            const a = Buffer.from(tokenHash(actor.token));
            const b = Buffer.from(known);
            actorStatus = a.length === b.length && crypto.timingSafeEqual(a,b) ? 'valid' : 'invalid';
          }
        }
      }

      return json(res, 200, {
        ok: true,
        room: recoveryVerify[1],
        owner,
        actor: actorStatus,
        canImportOwner: owner,
        canImportActor: actorStatus === 'valid' || actorStatus === 'unknown' || actorStatus === 'missing'
      });
    }
    const archivem = /^\/api\/rooms\/([A-Z0-9]{6})\/archive$/.exec(pathname);
    if (archivem && req.method === 'POST') {
      const r = rooms[archivem[1]];
      if (!r) return json(res, 404, { error:'room_not_found' });
      if (!isOwner(req,r)) return json(res, 403, { error:'owner_required' });
      normalizeRoom(r);
      if (!r.meta.archivedAt) {
        r.meta.archivedAt = Date.now();
        r.meta.purgeAfter = r.meta.archivedAt + ARCHIVE_RETENTION_MS;
        touchRoom(r);
        closeRoomConnections(archivem[1],'room-archived');
      }
      return json(res, 200, { ok:true, archived:true, meta:r.meta, recoveryDays:30 });
    }

    const unarchivem = /^\/api\/rooms\/([A-Z0-9]{6})\/unarchive$/.exec(pathname);
    if (unarchivem && req.method === 'POST') {
      const r = rooms[unarchivem[1]];
      if (!r) return json(res, 404, { error:'room_not_found' });
      if (!isOwner(req,r)) return json(res, 403, { error:'owner_required' });
      normalizeRoom(r);
      r.meta.archivedAt = null;
      r.meta.purgeAfter = null;
      touchRoom(r);
      return json(res, 200, { ok:true, archived:false, room:publicRoom(r) });
    }

    const deletem = /^\/api\/rooms\/([A-Z0-9]{6})\/delete-permanently$/.exec(pathname);
    if (deletem && req.method === 'POST') {
      const r = rooms[deletem[1]];
      if (!r) return json(res, 404, { error:'room_not_found' });
      if (!isOwner(req,r)) return json(res, 403, { error:'owner_required' });
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (String(b.confirmCode||'').toUpperCase() !== deletem[1] || b.acknowledge !== 'DELETE_FOREVER') {
        return json(res, 400, { error:'delete_confirmation_required' });
      }
      const result=purgeRoom(deletem[1],'owner-permanent-delete');
      return json(res, 200, { ok:true, deleted:true, removedUploads:result.blobs });
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
      if (isArchived(r)) return json(res, 423, { error:'room_archived', purgeAfter:r.meta.purgeAfter });
      const rev = r.revisions.find(x => x.id === restorem[2]);
      if (!rev) return json(res, 404, { error: 'revision_not_found' });
      if (!['layout','mementos','quest'].includes(rev.kind)) return json(res, 400, { error: 'unsupported_revision_kind' });
      if (rev.kind === 'layout') {
        recordRevision(r, 'layout', r.world.layout || {}, '恢复前自动备份');
        r.world = { ...r.world, layout: JSON.parse(JSON.stringify(rev.data || {})) };
      }
      if (rev.kind === 'mementos') {
        recordRevision(r, 'mementos', r.memory.mementos || [], '恢复前自动备份');
        r.memory.mementos = JSON.parse(JSON.stringify(rev.data || []));
      }
      if (rev.kind === 'quest') {
        recordRevision(r, 'quest', r.quest.items || [], '恢复前自动备份');
        r.quest.items = JSON.parse(JSON.stringify(rev.data || []));
      }
      touchRoom(r);
      if (rev.kind === 'layout') broadcastRoomScope(restorem[1],'memory',{type:'world-patch',sender:'server',patch:{layout:r.world.layout}});
      if (rev.kind === 'mementos') broadcastRoomScope(restorem[1],'memory',{type:'room-snapshot',sender:'server',memory:r.memory,world:r.world,music:r.music});
      if (rev.kind === 'quest') broadcastRoomScope(restorem[1],'quest',{type:'quest-update',sender:'server',items:r.quest.items});
      return json(res, 200, { ok: true, kind:rev.kind, layout:r.world.layout, mementos:r.memory.mementos, quest:r.quest.items, restoredRevision: rev.id, meta: r.meta });
    }
    const layoutm = /^\/api\/rooms\/([A-Z0-9]{6})\/layout$/.exec(pathname);
    if (layoutm && req.method === 'PUT') {
      const r = rooms[layoutm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      if (!isOwner(req, r)) return json(res, 403, { error: 'owner_required' });
      if (isArchived(r)) return json(res, 423, { error:'room_archived', purgeAfter:r.meta.purgeAfter });
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
      if (isArchived(r)) return json(res, 423, { error:'room_archived', purgeAfter:r.meta.purgeAfter });
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const scope=b.scope;
      const op=b.op;
      const auth=authorizeOp(req,r,scope,op);
      if (!auth.ok) return json(res, auth.status || (auth.error === 'item_not_found' ? 404 : 403), { error: auth.error || 'forbidden' });
      if (scope === 'memory') {
        if (auth.role === 'owner' && ['memento:move','memento:hide','memento:remove'].includes(op?.kind)) {
          recordRevision(r,'mementos',r.memory.mementos || [], op.kind === 'memento:remove' ? '删除纪念物前' : '整理纪念物前');
        }
        applyMemoryOp(r, op);
      }
      else if (scope === 'quest') {
        if (auth.role === 'owner' && ['move','hide','remove','clear','set'].includes(op?.kind)) {
          recordRevision(r,'quest',r.quest.items || [], '整理门外回忆前');
        }
        applyQuestOp(r, op);
      }
      else if (scope === 'world' && op?.patch) {
        const { layout, ...safePatch } = op.patch;
        applyMemoryOp(r, { kind: 'world:patch', patch: safePatch });
      }
      else return json(res, 400, { error: 'invalid_op' });
      if (scope === 'memory') broadcastRoomScope(opm[1],'memory',{type:'memory-op',sender:'server',authorized:true,op});
      if (scope === 'quest') broadcastRoomScope(opm[1],'quest',{type:'quest-op',sender:'server',authorized:true,op});
      return json(res, 200, { ok: true, role:auth.role || '', updatedAt: r.updatedAt });
    }
    const rm = /^\/api\/rooms\/([A-Z0-9]{6})$/.exec(pathname);
    if (rm && req.method === 'GET') {
      const r = rooms[rm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      normalizeRoom(r);
      if (isArchived(r) && !isOwner(req,r)) return json(res, 410, { error:'room_archived', purgeAfter:r.meta.purgeAfter, recoveryDays:30 });
      r.meta.lastVisitedAt = Date.now();
      saveDB();
      return json(res, 200, publicRoom(r));
    }
    if (rm && req.method === 'PUT') {
      const r = rooms[rm[1]];
      if (!r) return json(res, 404, { error: 'room_not_found' });
      if (isArchived(r)) return json(res, 423, { error:'room_archived', purgeAfter:r.meta.purgeAfter });
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      if (b.memory || b.quest) return json(res, 400, { error:'snapshot_write_disabled', hint:'use_authorized_ops' });
      if (b.world) {
        const { layout, ...safeWorld } = b.world;
        r.world = { ...r.world, ...safeWorld };
      }
      if ('music' in b) r.music = b.music;
      normalizeRoom(r);
      touchRoom(r);
      return json(res, 200, publicRoom(r));
    }
    if (pathname === '/api/uploads' && req.method === 'POST') {
      const body = await readBody(req, 18 * 1024 * 1024);
      const part = parseMultipart(body, req.headers['content-type']);
      if (!part) return json(res, 400, { error: 'missing_file' });
      const roomCode=String(req.headers['x-room-code']||'').toUpperCase();
      let uploadRoom=null;
      if (roomCode) {
        uploadRoom=rooms[roomCode];
        if (!uploadRoom) return json(res,404,{error:'room_not_found'});
        normalizeRoom(uploadRoom);
        if (isArchived(uploadRoom)) return json(res,423,{error:'room_archived'});
        const auth=isOwner(req,uploadRoom)?{ok:true}:verifyActor(req,uploadRoom,{allowRegister:true});
        if(!auth.ok) return json(res,403,{error:auth.error||'forbidden'});
      }
      const saved = blobStore.save(part.data, part.filename);
      if(uploadRoom){uploadRoom.meta.uploads.push(saved.key);touchRoom(uploadRoom)}
      const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
      const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
      return json(res, 200, { ok: true, url: `${proto}://${host}/uploads/${saved.key}`, name: saved.name, size: saved.size });
    }
    if (pathname.startsWith('/uploads/')) {
      const file = blobStore.pathFor(pathname.replace('/uploads/', ''));
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
  const roomState=rooms[room];
  if (roomState) {
    normalizeRoom(roomState);
    if (isArchived(roomState)) {
      socket.write('HTTP/1.1 410 Gone\r\nConnection: close\r\n\r\n');
      return socket.end();
    }
  }
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
      // V15.3: memory persistence is REST-authorized; websocket messages are transient only.
      if (m.type === 'memory' && m.memory) { /* snapshot writes disabled */ }
      if (m.type === 'memory-op' && m.op) { /* op writes disabled */ }
      if (m.type === 'world-patch' && m.patch) {
        const { layout, ...safePatch } = m.patch;
        applyMemoryOp(rr, { kind: 'world:patch', patch: safePatch });
      }
      if (m.type === 'music-sync' && m.music) { rr.music = m.music; rr.world = { ...rr.world, music: m.music.track || rr.world.music, customMusicName: m.music.name || rr.world.customMusicName, customMusicUrl: m.music.url || rr.world.customMusicUrl }; rr.updatedAt = Date.now(); saveDB(); }
      if (m.type === 'quest-update' && Array.isArray(m.items)) { /* snapshot writes disabled */ }
      if (m.type === 'quest-op' && m.op) { /* op writes disabled */ }
    }
    if (m.type === 'memory-op' || m.type === 'quest-op' || m.type === 'memory' || m.type === 'quest-update') return;
    wsBroadcast(ck, m, socket);
  }));
  const close = () => { const s = channels.get(ck); s?.delete(socket); if (s && !s.size) channels.delete(ck); };
  socket.on('close', close); socket.on('end', close); socket.on('error', close);
});

server.listen(PORT, () => console.log(`Pixel Memory V15.5 server: http://localhost:${PORT}`));
