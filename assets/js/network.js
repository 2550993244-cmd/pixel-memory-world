/* Pixel Memory World · shared realtime network adapter
   - Uses a real WebSocket server when a server URL is configured.
   - Falls back to BroadcastChannel so the prototype still works offline.
   Current V12 front end uses this stable adapter. Configure with ?server=https://YOUR-SERVER or localStorage pixel-memory-server-url.
*/
(() => {
  const qs = new URLSearchParams(location.search);
  const queryServer = qs.get('server');
  if (queryServer) localStorage.setItem('pixel-memory-server-url', queryServer.replace(/\/$/, ''));

  const stored = localStorage.getItem('pixel-memory-server-url') || '';
  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  const defaultBase = isLocal ? 'http://localhost:8787' : (location.protocol.startsWith('http') && !location.hostname.endsWith('github.io') ? location.origin : '');
  let baseUrl = stored || defaultBase;

  const listeners = new Set();
  const notify = (detail) => listeners.forEach(fn => { try { fn(detail); } catch(_){} });

  const api = async (path, options={}) => {
    if (!baseUrl) throw new Error('NO_SERVER');
    const { headers: optionHeaders={}, ...rest } = options;
    const res = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: {'Content-Type':'application/json', ...optionHeaders}
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return res.json();
  };

  class RealtimeChannel {
    constructor(name, roomCode, playerId) {
      this.name = name;
      this.roomCode = roomCode;
      this.playerId = playerId;
      this._onmessage = null;
      this.inbound = [];
      this.ws = null;
      this.bc = null;
      this.queue = [];
      this.closed = false;
      this.mode = 'offline';
      this.open();
    }
    open() {
      if (baseUrl && 'WebSocket' in window) {
        const wsBase = baseUrl.replace(/^http:/,'ws:').replace(/^https:/,'wss:');
        const url = `${wsBase}/ws?room=${encodeURIComponent(this.roomCode)}&channel=${encodeURIComponent(this.name)}&player=${encodeURIComponent(this.playerId||'anon')}`;
        try {
          this.ws = new WebSocket(url);
          this.ws.onopen = () => {
            this.mode = 'online';
            notify({status:'online', room:this.roomCode});
            this.queue.splice(0).forEach(v => this.ws.send(JSON.stringify(v)));
          };
          this.ws.onmessage = e => {
            try { this.deliver(JSON.parse(e.data)); } catch(_){}
          };
          this.ws.onerror = () => this.fallback();
          this.ws.onclose = () => {
            if (!this.closed && this.mode === 'online') notify({status:'disconnected', room:this.roomCode});
            if (!this.closed && this.mode !== 'offline') this.fallback();
          };
          return;
        } catch(_) {}
      }
      this.fallback();
    }
    fallback() {
      if (this.closed || this.bc) return;
      this.mode = 'offline';
      try { this.ws?.close(); } catch(_){}
      this.ws = null;
      if ('BroadcastChannel' in window) {
        this.bc = new BroadcastChannel(this.name);
        this.bc.onmessage = e => this.deliver(e.data);
        notify({status:'local', room:this.roomCode});
      } else notify({status:'offline', room:this.roomCode});
    }
    set onmessage(fn) {
      this._onmessage = fn;
      if (fn && this.inbound.length) this.inbound.splice(0).forEach(data => fn({data}));
    }
    get onmessage(){ return this._onmessage; }
    deliver(data) {
      if (this._onmessage) this._onmessage({data});
      else this.inbound.push(data);
    }
    postMessage(data) {
      if (this.mode === 'online' && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
      else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) this.queue.push(data);
      else this.bc?.postMessage(data);
    }
    close() {
      this.closed = true;
      try { this.ws?.close(); } catch(_){}
      try { this.bc?.close(); } catch(_){}
    }
  }

  const ownerStorageKey = code => `pixel-memory-owner-${String(code||'').toUpperCase()}`;
  const getOwnerToken = code => localStorage.getItem(ownerStorageKey(code)) || '';
  const saveOwnerToken = (code, token) => { if (code && token) localStorage.setItem(ownerStorageKey(code), token); };
  const ownerHeaders = code => {
    const token=getOwnerToken(code);
    return token ? {'X-Room-Owner':token} : {};
  };

  window.PixelNet = {
    get baseUrl(){ return baseUrl; },
    get enabled(){ return !!baseUrl; },
    setServer(url){ baseUrl=(url||'').replace(/\/$/,''); localStorage.setItem('pixel-memory-server-url',baseUrl); },
    clearServer(){ baseUrl=''; localStorage.removeItem('pixel-memory-server-url'); },
    onStatus(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    createChannel(name, roomCode, playerId){ return new RealtimeChannel(name, roomCode, playerId); },
    getOwnerToken,
    hasOwnerToken(code){ return !!getOwnerToken(code); },
    async createRoom(code, world, memory={}) {
      const room=await api('/api/rooms',{method:'POST',body:JSON.stringify({code,world,memory})});
      if(room?.ownerToken) saveOwnerToken(code,room.ownerToken);
      return room;
    },
    async getRoom(code){ return api(`/api/rooms/${encodeURIComponent(code)}`); },
    async claimRoom(code){
      const room=await api(`/api/rooms/${encodeURIComponent(code)}/claim`,{method:'POST',body:'{}'});
      if(room?.ownerToken) saveOwnerToken(code,room.ownerToken);
      return room;
    },
    async updateOwnerLayout(code, layout, label='房间布置'){
      return api(`/api/rooms/${encodeURIComponent(code)}/layout`,{
        method:'PUT',
        headers:ownerHeaders(code),
        body:JSON.stringify({layout,label})
      });
    },
    async getRevisions(code){
      return api(`/api/rooms/${encodeURIComponent(code)}/revisions`,{
        headers:ownerHeaders(code)
      });
    },
    async restoreRevision(code, revisionId){
      return api(`/api/rooms/${encodeURIComponent(code)}/revisions/${encodeURIComponent(revisionId)}/restore`,{
        method:'POST',
        headers:ownerHeaders(code),
        body:'{}'
      });
    },
    async updateRoom(code, patch){ return api(`/api/rooms/${encodeURIComponent(code)}`,{method:'PUT',body:JSON.stringify(patch)}); },
    async applyOp(code, scope, op){ return api(`/api/rooms/${encodeURIComponent(code)}/ops`,{method:'POST',body:JSON.stringify({scope,op})}); },
    async uploadBlob(blob, filename='voice.webm') {
      if (!baseUrl) throw new Error('NO_SERVER');
      const fd = new FormData(); fd.append('file', blob, filename);
      const res = await fetch(`${baseUrl}/api/uploads`,{method:'POST',body:fd});
      if(!res.ok) throw new Error(`HTTP_${res.status}`);
      return res.json();
    }
  };
})();
