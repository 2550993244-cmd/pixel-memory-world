/* Pixel Memory World · V15.4 recovery keys
   Account-free cross-device recovery for room ownership and authorship. */
(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const PREFIX='PMR1';
  const ACTOR_KEY='pixel-memory-actor-v1';
  const ACTOR_TOKEN_KEY='pixel-memory-actor-token-v1';

  const bytesToB64url=bytes=>{
    let bin=''; for(const b of bytes)bin+=String.fromCharCode(b);
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };
  const b64urlToBytes=s=>{
    const b64=s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4);
    const bin=atob(b64); return Uint8Array.from(bin,c=>c.charCodeAt(0));
  };
  const encodeUtf8=s=>bytesToB64url(new TextEncoder().encode(s));
  const decodeUtf8=s=>new TextDecoder().decode(b64urlToBytes(s));
  const checksum=async text=>{
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return bytesToB64url(new Uint8Array(hash)).slice(0,16);
  };

  function credentials(){
    const actor=window.PixelNet?.getActorCredential?.()||{
      id:localStorage.getItem(ACTOR_KEY)||'',
      token:localStorage.getItem(ACTOR_TOKEN_KEY)||''
    };
    return {
      actor,
      ownerToken:window.PixelNet?.getOwnerToken?.(state.roomCode)||'',
      inviteToken:window.PixelNet?.getContributorInviteToken?.(state.roomCode)||'',
      viewInviteToken:window.PixelNet?.getViewerInviteToken?.(state.roomCode)||''
    };
  }

  async function createBundle(kind='identity'){
    const {actor,ownerToken,inviteToken,viewInviteToken}=credentials();
    if(!actor.id||!actor.token) throw new Error('当前设备还没有可导出的作者身份');
    if(kind==='owner'&&(!state.roomCode||!ownerToken)) throw new Error('当前设备没有这个房间的房主权限');
    const bundle={
      app:'pixel-memory-world',
      schema:1,
      kind:kind==='owner'?'owner':'identity',
      createdAt:new Date().toISOString(),
      roomCode:state.roomCode||'',
      actor:{id:actor.id,token:actor.token},
      ...(kind==='owner'?{
        ownerToken,
        ...(inviteToken?{inviteToken}:{}),
        ...(viewInviteToken?{viewInviteToken}:{})
      }:{})
    };
    const payload=encodeUtf8(JSON.stringify(bundle));
    return `${PREFIX}.${payload}.${await checksum(payload)}`;
  }

  async function parseKey(raw){
    const key=String(raw||'').trim();
    const [prefix,payload,sum,...rest]=key.split('.');
    if(prefix!==PREFIX||!payload||!sum||rest.length) throw new Error('恢复密钥格式不正确');
    const actual=await checksum(payload);
    if(actual!==sum) throw new Error('恢复密钥校验失败，可能复制不完整');
    let data;
    try{data=JSON.parse(decodeUtf8(payload))}catch(_){throw new Error('恢复密钥内容损坏')}
    if(data?.app!=='pixel-memory-world'||data?.schema!==1||!['owner','identity'].includes(data?.kind)) throw new Error('不是受支持的 Pixel Memory 恢复密钥');
    if(!data.actor?.id||!data.actor?.token) throw new Error('恢复密钥缺少作者身份');
    if(data.kind==='owner'&&(!data.roomCode||!data.ownerToken)) throw new Error('房主恢复密钥缺少房间权限');
    return data;
  }

  async function verifyBundle(data){
    if(!window.PixelNet?.enabled) throw new Error('恢复房间权限需要连接到房间服务器');
    const code=(data.roomCode||state.roomCode||'').toUpperCase();
    if(!code) throw new Error('个人身份恢复需要先进入一个曾经留下过内容的房间进行验证');
    const result=await PixelNet.verifyRecovery(code,{
      ownerToken:data.ownerToken||'',
      actorId:data.actor.id,
      actorToken:data.actor.token
    });
    if(data.kind==='owner'&&!result.owner) throw new Error('服务器无法确认这把房主恢复密钥');
    if(result.actor==='invalid') throw new Error('作者身份与服务器记录不匹配');
    return result;
  }

  async function importKey(raw){
    const data=await parseKey(raw);
    const verified=await verifyBundle(data);
    PixelNet.setActorCredential(data.actor.id,data.actor.token);
    localStorage.setItem(ACTOR_KEY,data.actor.id);
    localStorage.setItem(ACTOR_TOKEN_KEY,data.actor.token);
    if(typeof state!=='undefined'&&state.player) state.player.actorId=data.actor.id;
    if(data.kind==='owner'){
      PixelNet.saveOwnerToken(data.roomCode,data.ownerToken);
      if(data.inviteToken)PixelNet.saveInviteToken?.(data.roomCode,data.inviteToken,'contributor');
      if(data.viewInviteToken)PixelNet.saveInviteToken?.(data.roomCode,data.viewInviteToken,'viewer');
      PixelNet.saveInviteRole?.(data.roomCode,'contributor');
      if(typeof state!=='undefined'&&state.roomCode===data.roomCode){
        state.player.host=true;
        try{
          state.players.set(state.player.id,{...state.player,lastSeen:Date.now()});
          renderPlayers();
          broadcast('state');
        }catch(_){}
      }
    }
    window.dispatchEvent(new CustomEvent('pixel-recovery-imported',{detail:{kind:data.kind,roomCode:data.roomCode||'',verified}}));
    return {data,verified};
  }

  function saveText(name,text){
    const blob=new Blob([text+'\n'],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function copyBundle(kind){
    const key=await createBundle(kind);
    await navigator.clipboard.writeText(key);
    toast(kind==='owner'?'房主恢复密钥已复制 · 请像密码一样保存':'个人身份密钥已复制 · 请勿公开分享');
    return key;
  }

  async function saveBundle(kind){
    const key=await createBundle(kind);
    const code=state.roomCode||'identity';
    saveText(`pixel-memory-${kind==='owner'?code+'-owner':'identity'}-recovery.pmrkey`,key);
    toast('恢复文件已保存 · 建议放在你自己的安全位置');
    return key;
  }

  function readFile(){
    return new Promise((resolve,reject)=>{
      const input=document.createElement('input');
      input.type='file';input.accept='.pmrkey,.txt,text/plain';
      input.onchange=()=>{
        const file=input.files?.[0]; if(!file)return reject(new Error('没有选择文件'));
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||''));
        reader.onerror=()=>reject(new Error('恢复文件读取失败'));
        reader.readAsText(file);
      };
      input.click();
    });
  }

  function recoveryStatus(){
    const actor=PixelNet.getActorCredential?.()||{};
    const owner=!!PixelNet.hasOwnerToken?.(state.roomCode);
    return {actor:!!(actor.id&&actor.token),owner,roomCode:state.roomCode||''};
  }

  function openCenter(){
    const st=recoveryStatus();
    const ownerButtons=st.owner
      ? '<div class="recovery-actions"><button id="copyOwnerRecovery" class="button primary press">复制房主恢复密钥</button><button id="saveOwnerRecovery" class="button secondary press">保存房主恢复文件</button></div>'
      : '<div class="recovery-muted">当前设备没有这个房间的房主权限，因此不会导出房主密钥。</div>';
    openModal('RECOVERY KEY','换设备也能找回这个世界',
      '<div class="recovery-panel-v15">'+
        '<div class="recovery-warning"><b>恢复密钥 = 权限本身</b><span>拿到密钥的人可以恢复对应权限。不要发到群聊、朋友圈或公开网盘。</span></div>'+
        '<section><h4>房主恢复 · '+escapeHTML(st.roomCode||'当前房间')+'</h4><p>包含房间所有权和你的作者身份。换电脑后导入，就能继续整理和恢复这个世界。</p>'+ownerButtons+'</section>'+
        '<section><h4>个人作者身份</h4><p>不包含房主权限，只用于在另一台设备继续证明“这些回忆是我留下的”。</p><div class="recovery-actions"><button id="copyIdentityRecovery" class="button secondary press">复制个人身份密钥</button><button id="saveIdentityRecovery" class="button secondary press">保存个人身份文件</button></div></section>'+
        '<section class="recovery-import"><h4>在新设备恢复</h4><textarea id="recoveryKeyInput" rows="4" spellcheck="false" placeholder="粘贴 PMR1... 恢复密钥"></textarea><div class="recovery-actions"><button id="importRecoveryText" class="button primary press">验证并恢复</button><button id="importRecoveryFile" class="button secondary press">从恢复文件导入</button></div><small>导入前会先由房间服务器验证密钥，不会直接覆盖当前权限。</small></section>'+
      '</div>');
    setTimeout(()=>{
      $('#copyOwnerRecovery')?.addEventListener('click',()=>copyBundle('owner').catch(e=>toast(e.message)));
      $('#saveOwnerRecovery')?.addEventListener('click',()=>saveBundle('owner').catch(e=>toast(e.message)));
      $('#copyIdentityRecovery')?.addEventListener('click',()=>copyBundle('identity').catch(e=>toast(e.message)));
      $('#saveIdentityRecovery')?.addEventListener('click',()=>saveBundle('identity').catch(e=>toast(e.message)));
      $('#importRecoveryText')?.addEventListener('click',async()=>{
        const btn=$('#importRecoveryText');btn.disabled=true;
        try{
          const r=await importKey($('#recoveryKeyInput').value);
          closeModal();
          toast(r.data.kind==='owner'?'房主权限和作者身份已经恢复':'个人作者身份已经恢复');
        }catch(e){toast(e.message||'恢复失败')}finally{btn.disabled=false}
      });
      $('#importRecoveryFile')?.addEventListener('click',async()=>{
        try{
          const raw=await readFile();
          $('#recoveryKeyInput').value=raw.trim();
          toast('恢复文件已读取 · 点击“验证并恢复”完成导入');
        }catch(e){toast(e.message||'恢复文件读取失败')}
      });
    },0);
  }

  function injectSettings(){
    const body=$('#drawerBody');
    if(!body||$('#recoveryEntryV15',body))return;
    const section=document.createElement('div');
    section.id='recoveryEntryV15';
    section.className='drawer-section pm-recovery-entry-v15';
    const st=recoveryStatus();
    section.innerHTML=
      '<h4>RECOVERY · 换设备恢复</h4>'+
      '<p>'+(st.owner?'这台设备持有房主权限。':'当前是参与者身份。')+' 可以保存恢复密钥，以后在另一台设备继续使用。</p>'+
      '<button id="openRecoveryCenterV15" class="button secondary full press">⌁ 打开恢复中心</button>';
    body.appendChild(section);
    $('#openRecoveryCenterV15').onclick=openCenter;
  }

  const settings=$('#worldSettingsBtn');
  if(settings&&!settings.dataset.recoveryWrapped){
    const old=settings.onclick;
    settings.onclick=function(e){
      old?.call(this,e);
      setTimeout(injectSettings,0);
    };
    settings.dataset.recoveryWrapped='true';
  }

  window.PixelRecovery={
    version:'15.7',
    createBundle,
    parseKey,
    importKey,
    verifyBundle,
    open:openCenter,
    injectSettings,
    status:recoveryStatus
  };
})();