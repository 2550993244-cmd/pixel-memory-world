/* Pixel Memory World · shared realtime network adapter
   - Uses a real WebSocket server when a server URL is configured.
   - Falls back to BroadcastChannel so the prototype still works offline.
   Current V12 front end uses this stable adapter. Configure with ?server=https://YOUR-SERVER or localStorage pixel-memory-server-url.
*/
(() => {
  const qs = new URLSearchParams(location.search);
  const queryServer = qs.get('server');
  const queryRoom = String(qs.get('room')||'').toUpperCase();
  const queryInvite = String(qs.get('invite')||'');
  const queryInviteRole = qs.get('role')==='view'?'viewer':'contributor';
  const inviteStorageKey = code => `pixel-memory-invite-${String(code||'').toUpperCase()}`;
  const viewInviteStorageKey = code => `pixel-memory-view-invite-${String(code||'').toUpperCase()}`;
  const inviteRoleStorageKey = code => `pixel-memory-invite-role-${String(code||'').toUpperCase()}`;
  if(queryRoom&&queryInvite){
    localStorage.setItem(queryInviteRole==='viewer'?viewInviteStorageKey(queryRoom):inviteStorageKey(queryRoom),queryInvite);
    localStorage.setItem(inviteRoleStorageKey(queryRoom),queryInviteRole);
    window.PixelInviteEntry={room:queryRoom,role:queryInviteRole,fromSecretLink:true};
    try{
      const clean=new URL(location.href);
      clean.searchParams.delete('invite');
      clean.searchParams.delete('role');
      history.replaceState({},'',clean.pathname+(clean.search||'')+clean.hash);
    }catch(_){}
  }
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
    let data=null;
    try{data=await res.json()}catch(_){}
    if (!res.ok) {
      const err=new Error(`HTTP_${res.status}${data?.error?':'+data.error:''}`);
      err.status=res.status;err.data=data||{};
      throw err;
    }
    return data;
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
        const invite=getInviteToken(this.roomCode);
        const url = `${wsBase}/ws?room=${encodeURIComponent(this.roomCode)}&channel=${encodeURIComponent(this.name)}&player=${encodeURIComponent(this.playerId||'anon')}${invite?'&invite='+encodeURIComponent(invite):''}`;
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
          this.ws.onerror = () => {
            if(getInviteToken(this.roomCode)||getOwnerToken(this.roomCode)){
              this.mode='offline';
              notify({status:'access-error',room:this.roomCode});
              return;
            }
            this.fallback();
          };
          this.ws.onclose = () => {
            if (!this.closed && this.mode === 'online') notify({status:'disconnected', room:this.roomCode});
            if (!this.closed && (getInviteToken(this.roomCode)||getOwnerToken(this.roomCode))){
              this.mode='offline';
              return;
            }
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
  const getInviteRole = code => localStorage.getItem(inviteRoleStorageKey(code)) || 'contributor';
  const saveInviteRole = (code, role) => {
    if(!code)return;
    if(role)localStorage.setItem(inviteRoleStorageKey(code),role);
    else localStorage.removeItem(inviteRoleStorageKey(code));
  };
  const getContributorInviteToken = code => localStorage.getItem(inviteStorageKey(code)) || '';
  const getViewerInviteToken = code => localStorage.getItem(viewInviteStorageKey(code)) || '';
  const getInviteToken = code => {
    if(getOwnerToken(code)&&getContributorInviteToken(code))return getContributorInviteToken(code);
    return getInviteRole(code)==='viewer' ? getViewerInviteToken(code) : getContributorInviteToken(code);
  };
  const saveInviteToken = (code, token, role='contributor') => {
    if(!code)return;
    const key=role==='viewer'?viewInviteStorageKey(code):inviteStorageKey(code);
    if(token)localStorage.setItem(key,String(token));
    else localStorage.removeItem(key);
    if(token&&!getOwnerToken(code))saveInviteRole(code,role);
  };
  const clearInviteToken = (code, role='active') => {
    if(role==='viewer'||role==='active'&&getInviteRole(code)==='viewer')localStorage.removeItem(viewInviteStorageKey(code));
    if(role==='contributor'||role==='active'&&getInviteRole(code)!=='viewer')localStorage.removeItem(inviteStorageKey(code));
  };
  const inviteHeaders = code => {
    const token=getInviteToken(code);
    return token?{'X-Room-Invite':token}:{};
  };
  const getOwnerToken = code => localStorage.getItem(ownerStorageKey(code)) || '';
  const saveOwnerToken = (code, token) => {
    if(!code) return;
    const key=ownerStorageKey(code);
    if(token) localStorage.setItem(key,token);
    else localStorage.removeItem(key);
  };
  const ownerHeaders = code => {
    const token=getOwnerToken(code);
    return token ? {'X-Room-Owner':token} : {};
  };
  const getActorCredential = () => ({
    id:localStorage.getItem('pixel-memory-actor-v1')||'',
    token:localStorage.getItem('pixel-memory-actor-token-v1')||''
  });
  const setActorCredential = (id,token) => {
    if(id&&token){
      localStorage.setItem('pixel-memory-actor-v1',String(id));
      localStorage.setItem('pixel-memory-actor-token-v1',String(token));
    }else{
      localStorage.removeItem('pixel-memory-actor-v1');
      localStorage.removeItem('pixel-memory-actor-token-v1');
    }
  };
  const actorHeaders = () => {
    const {id,token}=getActorCredential();
    return id&&token ? {'X-Actor-Id':id,'X-Actor-Token':token} : {};
  };
  const accessHeaders = code => ({...inviteHeaders(code),...ownerHeaders(code)});
  const mutationHeaders = code => ({...actorHeaders(),...inviteHeaders(code),...ownerHeaders(code)});

  window.PixelNet = {
    get baseUrl(){ return baseUrl; },
    get enabled(){ return !!baseUrl; },
    setServer(url){ baseUrl=(url||'').replace(/\/$/,''); localStorage.setItem('pixel-memory-server-url',baseUrl); },
    clearServer(){ baseUrl=''; localStorage.removeItem('pixel-memory-server-url'); },
    onStatus(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    createChannel(name, roomCode, playerId){ return new RealtimeChannel(name, roomCode, playerId); },
    getOwnerToken,
    saveOwnerToken,
    getInviteToken,
    getContributorInviteToken,
    getViewerInviteToken,
    getInviteRole,
    saveInviteRole,
    saveInviteToken,
    clearInviteToken,
    hasInviteToken(code,role='active'){
      if(role==='viewer')return !!getViewerInviteToken(code);
      if(role==='contributor')return !!getContributorInviteToken(code);
      return !!getInviteToken(code);
    },
    isViewOnly(code){return getInviteRole(code)==='viewer';},
    hasOwnerToken(code){ return !!getOwnerToken(code); },
    getActorCredential,
    setActorCredential,
    getActorHeaders(){ return actorHeaders(); },
    async createRoom(code, world, memory={}) {
      const room=await api('/api/rooms',{method:'POST',body:JSON.stringify({code,world,memory})});
      if(room?.ownerToken) saveOwnerToken(code,room.ownerToken);
      if(room?.inviteToken) saveInviteToken(code,room.inviteToken,'contributor');
      if(room?.viewInviteToken) saveInviteToken(code,room.viewInviteToken,'viewer');
      saveInviteRole(code,'contributor');
      return room;
    },
    async getRoom(code){
      const room=await api(`/api/rooms/${encodeURIComponent(code)}`,{headers:accessHeaders(code)});
      if(room?.accessRole==='viewer')saveInviteRole(code,'viewer');
      else if(room?.accessRole==='contributor')saveInviteRole(code,'contributor');
      return room;
    },
    async rotateInvite(code,role='contributor'){
      const safeRole=role==='viewer'?'viewer':'contributor';
      const data=await api(`/api/rooms/${encodeURIComponent(code)}/invite/${safeRole}/rotate`,{method:'POST',headers:ownerHeaders(code),body:'{}'});
      if(data?.inviteToken) saveInviteToken(code,data.inviteToken,'contributor');
      if(data?.viewInviteToken) saveInviteToken(code,data.viewInviteToken,'viewer');
      if(getOwnerToken(code))saveInviteRole(code,'contributor');
      return data;
    },
    async archiveRoom(code){
      return api(`/api/rooms/${encodeURIComponent(code)}/archive`,{method:'POST',headers:ownerHeaders(code),body:'{}'});
    },
    async unarchiveRoom(code){
      return api(`/api/rooms/${encodeURIComponent(code)}/unarchive`,{method:'POST',headers:ownerHeaders(code),body:'{}'});
    },
    async deleteRoomPermanently(code,confirmCode){
      return api(`/api/rooms/${encodeURIComponent(code)}/delete-permanently`,{
        method:'POST',
        headers:ownerHeaders(code),
        body:JSON.stringify({confirmCode,acknowledge:'DELETE_FOREVER'})
      });
    },
    async claimRoom(code){
      const room=await api(`/api/rooms/${encodeURIComponent(code)}/claim`,{method:'POST',body:'{}'});
      if(room?.ownerToken) saveOwnerToken(code,room.ownerToken);
      return room;
    },
    async verifyRecovery(code,{ownerToken='',actorId='',actorToken=''}={}){
      const headers={};
      if(ownerToken) headers['X-Room-Owner']=ownerToken;
      if(actorId&&actorToken){
        headers['X-Actor-Id']=actorId;
        headers['X-Actor-Token']=actorToken;
      }
      return api(`/api/rooms/${encodeURIComponent(code)}/recovery/verify`,{
        method:'POST',
        headers,
        body:'{}'
      });
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
    async updateRoom(code, patch){ return api(`/api/rooms/${encodeURIComponent(code)}`,{method:'PUT',headers:mutationHeaders(code),body:JSON.stringify(patch)}); },
    async applyOp(code, scope, op){ return api(`/api/rooms/${encodeURIComponent(code)}/ops`,{method:'POST',headers:mutationHeaders(code),body:JSON.stringify({scope,op})}); },
    async uploadBlob(blob, filename='voice.webm', roomCode='') {
      if (!baseUrl) throw new Error('NO_SERVER');
      const fd = new FormData(); fd.append('file', blob, filename);
      const headers=roomCode?{...mutationHeaders(roomCode),'X-Room-Code':String(roomCode).toUpperCase()}:{};
      const res = await fetch(`${baseUrl}/api/uploads`,{method:'POST',headers,body:fd});
      if(!res.ok) throw new Error(`HTTP_${res.status}`);
      return res.json();
    }
  };
})();
