const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'rooms.json');
fs.mkdirSync(DATA_DIR,{recursive:true}); fs.mkdirSync(UPLOAD_DIR,{recursive:true});

let rooms={}; try{rooms=JSON.parse(fs.readFileSync(DB_FILE,'utf8'))}catch(_){}
let saveTimer=null;
function saveDB(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>fs.writeFileSync(DB_FILE,JSON.stringify(rooms,null,2)),80)}
function validCode(c){return /^[A-Z0-9]{6}$/.test(String(c||''))}
function randomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c;do{c=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}while(rooms[c]);return c}
function json(res,status,obj){const b=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':b.length,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'});res.end(b)}
function readBody(req,limit=16*1024*1024){return new Promise((resolve,reject)=>{let chunks=[],n=0;req.on('data',c=>{n+=c.length;if(n>limit){reject(new Error('too_large'));req.destroy();return}chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)})}
function safeJoin(base,target){const p=path.resolve(base,'.'+target);return p.startsWith(path.resolve(base))?p:null}
const mimes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.webm':'audio/webm','.svg':'image/svg+xml'};

function parseMultipart(body,contentType){
  const m=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType||''); if(!m)return null;
  const boundary='--'+(m[1]||m[2]); const all=body.toString('latin1');
  const parts=all.split(boundary).slice(1,-1);
  for(const raw of parts){
    const idx=raw.indexOf('\r\n\r\n'); if(idx<0)continue;
    const head=raw.slice(0,idx); if(!/name="file"/i.test(head))continue;
    const fn=/filename="([^"]*)"/i.exec(head)?.[1]||'upload.bin';
    let dataStr=raw.slice(idx+4); if(dataStr.endsWith('\r\n'))dataStr=dataStr.slice(0,-2);
    return {filename:path.basename(fn),data:Buffer.from(dataStr,'latin1')};
  }
  return null;
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'});return res.end()}
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`); const pathname=u.pathname;
  try{
    if(pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,rooms:Object.keys(rooms).length,time:Date.now()});
    if(pathname==='/api/rooms'&&req.method==='POST'){
      const body=JSON.parse((await readBody(req)).toString('utf8')||'{}'); const code=String(body.code||randomCode()).toUpperCase();
      if(!validCode(code))return json(res,400,{error:'invalid_room_code'}); if(rooms[code])return json(res,409,{error:'room_exists'});
      rooms[code]={code,world:body.world||{},memory:body.memory||{},quest:{items:[]},createdAt:Date.now(),updatedAt:Date.now()}; saveDB(); return json(res,200,rooms[code]);
    }
    const rm=/^\/api\/rooms\/([A-Z0-9]{6})$/.exec(pathname);
    if(rm&&req.method==='GET'){const r=rooms[rm[1]];return r?json(res,200,r):json(res,404,{error:'room_not_found'})}
    if(rm&&req.method==='PUT'){
      const r=rooms[rm[1]];if(!r)return json(res,404,{error:'room_not_found'});const b=JSON.parse((await readBody(req)).toString('utf8')||'{}');
      if(b.world)r.world={...r.world,...b.world};if(b.memory)r.memory=b.memory;if(b.quest)r.quest=b.quest;r.updatedAt=Date.now();saveDB();return json(res,200,r)
    }
    if(pathname==='/api/uploads'&&req.method==='POST'){
      const body=await readBody(req,14*1024*1024); const part=parseMultipart(body,req.headers['content-type']); if(!part)return json(res,400,{error:'missing_file'});
      const ext=(path.extname(part.filename)||'.bin').replace(/[^.a-zA-Z0-9]/g,''); const name=`${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`; fs.writeFileSync(path.join(UPLOAD_DIR,name),part.data);
      const proto=(req.headers['x-forwarded-proto']||'http').split(',')[0]; const host=req.headers.host; return json(res,200,{ok:true,url:`${proto}://${host}/uploads/${name}`,name:part.filename,size:part.data.length});
    }
    if(pathname.startsWith('/uploads/')){
      const file=safeJoin(UPLOAD_DIR,pathname.replace('/uploads',''));if(!file||!fs.existsSync(file))return json(res,404,{error:'not_found'});const st=fs.statSync(file);res.writeHead(200,{'Content-Type':mimes[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':st.size,'Access-Control-Allow-Origin':'*'});return fs.createReadStream(file).pipe(res)
    }
    let target=pathname==='/'?'/index.html':pathname;const file=safeJoin(ROOT,target);if(!file||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('Not found')}
    const st=fs.statSync(file);res.writeHead(200,{'Content-Type':mimes[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':st.size});fs.createReadStream(file).pipe(res)
  }catch(e){console.error(e);if(!res.headersSent)json(res,500,{error:'server_error'})}
});

// -------- minimal WebSocket server, no npm dependencies --------
const channels=new Map(); const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function chset(key){if(!channels.has(key))channels.set(key,new Set());return channels.get(key)}
function wsFrame(text){const p=Buffer.from(text);let h;if(p.length<126){h=Buffer.alloc(2);h[0]=0x81;h[1]=p.length}else if(p.length<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(p.length,2)}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(p.length),2)}return Buffer.concat([h,p])}
function wsSend(socket,obj){if(!socket.destroyed)socket.write(wsFrame(JSON.stringify(obj)))}
function wsBroadcast(key,obj,except){for(const s of(channels.get(key)||[]))if(s!==except&&!s.destroyed)wsSend(s,obj)}
function parseFrames(socket,chunk,onText){socket._wsbuf=Buffer.concat([socket._wsbuf||Buffer.alloc(0),chunk]);while(socket._wsbuf.length>=2){const b=socket._wsbuf;const op=b[0]&0x0f;const masked=!!(b[1]&0x80);let len=b[1]&0x7f,off=2;if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4}else if(len===127){if(b.length<10)return;const n=Number(b.readBigUInt64BE(2));if(!Number.isSafeInteger(n))return socket.destroy();len=n;off=10}let mask;if(masked){if(b.length<off+4)return;mask=b.subarray(off,off+4);off+=4}if(b.length<off+len)return;let payload=Buffer.from(b.subarray(off,off+len));socket._wsbuf=b.subarray(off+len);if(masked)for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];if(op===0x8){socket.end();return}if(op===0x9){continue}if(op===0x1)onText(payload.toString('utf8'))}}
server.on('upgrade',(req,socket)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(u.pathname!=='/ws')return socket.destroy();
  const room=String(u.searchParams.get('room')||'').toUpperCase(),channel=u.searchParams.get('channel')||'room',player=u.searchParams.get('player')||'anon';if(!validCode(room))return socket.destroy();
  const key=req.headers['sec-websocket-key'];if(!key)return socket.destroy();const accept=crypto.createHash('sha1').update(key+GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const ck=`${room}::${channel}`;chset(ck).add(socket);socket._meta={room,channel,player,ck};
  const r=rooms[room];if(r){if(channel.includes('quest'))wsSend(socket,{type:'quest-update',sender:'server',items:r.quest?.items||[]});else wsSend(socket,{type:'memory',sender:'server',memory:r.memory||{},world:r.world||{}})}
  socket.on('data',chunk=>parseFrames(socket,chunk,text=>{let m;try{m=JSON.parse(text)}catch(_){return}const rr=rooms[room];if(rr){if(m.type==='memory'&&m.memory){rr.memory=m.memory;rr.updatedAt=Date.now();saveDB()}if(m.type==='quest-update'&&Array.isArray(m.items)){rr.quest={items:m.items};rr.updatedAt=Date.now();saveDB()}}wsBroadcast(ck,m,socket)}));
  const close=()=>{const s=channels.get(ck);s?.delete(socket);if(s&&!s.size)channels.delete(ck)};socket.on('close',close);socket.on('end',close);socket.on('error',close);
});

server.listen(PORT,()=>console.log(`Pixel Memory V9 server: http://localhost:${PORT}`));
