/* Pixel Memory World · V15.6 secret invitation links */
(() => {
  const $=(s,r=document)=>r.querySelector(s);

  function tokenFromText(raw){
    const text=String(raw||'').trim();
    if(!text)return {token:'',room:''};
    try{
      const u=new URL(text,location.origin);
      return {token:String(u.searchParams.get('invite')||''),room:String(u.searchParams.get('room')||'').toUpperCase()};
    }catch(_){}
    return {token:text.replace(/^invite[:\s]+/i,''),room:''};
  }

  async function ensureToken(code){
    code=String(code||state?.roomCode||'').toUpperCase();
    let token=PixelNet.getInviteToken?.(code)||'';
    if(token)return token;
    if(!PixelNet.hasOwnerToken?.(code))throw new Error('当前设备没有可分享的秘密邀请链接');
    const data=await PixelNet.rotateInvite(code);
    token=data.inviteToken||'';
    if(!token)throw new Error('邀请链接生成失败');
    return token;
  }

  async function shareUrl(code){
    code=String(code||state?.roomCode||'').toUpperCase();
    const token=await ensureToken(code);
    const u=new URL(location.origin+location.pathname);
    u.searchParams.set('room',code);
    u.searchParams.set('invite',token);
    const server=PixelNet.baseUrl||'';
    if(server && server.replace(/\/$/,'')!==location.origin.replace(/\/$/,'') && !/localhost|127\.0\.0\.1/.test(server)){
      u.searchParams.set('server',server);
    }
    return u.toString();
  }

  async function copyInvite(code){
    const url=await shareUrl(code);
    const text='来我的小小世界吧｜门牌号 '+String(code||state.roomCode).toUpperCase()+'\n'+url;
    await navigator.clipboard.writeText(text);
    toast('秘密邀请链接已复制');
    return url;
  }

  async function rotate(code){
    code=String(code||state.roomCode||'').toUpperCase();
    if(!PixelNet.hasOwnerToken?.(code))throw new Error('只有房主可以更换邀请链接');
    apiState.rotating=true;
    try{
      const data=await PixelNet.rotateInvite(code);
      if(state?.roomCode===code && state?.screen==='world'){
        try{setupChannel()}catch(_){}
      }
      window.dispatchEvent(new CustomEvent('pixel-invite-rotated',{detail:{code,version:data.inviteVersion}}));
      return data;
    }finally{
      setTimeout(()=>{apiState.rotating=false},350);
    }
  }

  async function useInvite(code,raw){
    code=String(code||'').toUpperCase();
    const parsed=tokenFromText(raw);
    if(parsed.room && parsed.room!==code)throw new Error('这个邀请链接属于另一个房间');
    if(!parsed.token)throw new Error('请粘贴完整邀请链接或邀请密钥');
    PixelNet.saveInviteToken(code,parsed.token);
    const result=await loadRoomRemote(code);
    if(result===true){
      closeModal();
      showScreen('avatarBuilder');
      toast('邀请验证成功');
      return true;
    }
    if(result==='archived')return false;
    PixelNet.saveInviteToken(code,'');
    throw new Error('邀请链接无效或已经被房主更换');
  }

  function showJoinGate(code,{invalid=false}={}){
    code=String(code||'').toUpperCase();
    openModal('PRIVATE INVITE',invalid?'这个邀请已经失效':'这间房需要秘密邀请',
      '<div class="invite-panel-v15">'+
        '<div class="invite-lock-card"><b>'+(invalid?'旧邀请链接已经不能进入':'门牌号只是房间名字')+'</b><span>请使用房主发给你的完整秘密邀请链接。仅知道 6 位门牌号不能打开私人回忆。</span></div>'+
        '<section><h4>粘贴邀请链接或密钥</h4><textarea id="inviteSecretInput" rows="3" spellcheck="false" placeholder="https://…?room='+escapeHTML(code)+'&invite=…"></textarea>'+
        '<button id="verifyInviteV15" class="button primary full press">验证并进入</button>'+
        '<small>房间是否存在不会因为只输入门牌号而被公开确认。</small></section>'+
      '</div>');
    setTimeout(()=>{
      const input=$('#inviteSecretInput'),btn=$('#verifyInviteV15');
      btn.onclick=async()=>{
        btn.disabled=true;
        try{await useInvite(code,input.value)}
        catch(e){toast(e.message||'邀请验证失败');btn.disabled=false}
      };
    },0);
  }

  function openCenter(){
    const code=String(state.roomCode||'').toUpperCase();
    if(!PixelNet.hasOwnerToken?.(code))return toast('只有房主可以管理邀请链接');
    const has=PixelNet.hasInviteToken?.(code);
    openModal('PRIVATE INVITE','秘密邀请链接',
      '<div class="invite-panel-v15">'+
        '<div class="invite-lock-card"><b>门牌号 '+escapeHTML(code)+'</b><span>门牌号负责好记；秘密链接负责真正的进入权限。分享时优先发送完整链接。</span></div>'+
        '<section><h4>'+(has?'当前邀请链接':'为这个房间启用秘密邀请')+'</h4><p>'+(has?'朋友点开后可以直接进入人物设置，不需要账号或额外密码。':'这是旧房间。生成后，仅门牌号将不再足够进入。')+'</p>'+
          '<div class="invite-actions"><button id="copySecretInviteV15" class="button primary press">'+(has?'复制秘密邀请链接':'生成并复制秘密邀请链接')+'</button></div></section>'+
        '<section class="invite-rotate"><h4>链接泄露了？</h4><p>更换后，旧链接会立刻失效，已使用旧邀请凭证在线的人也会退出。房间门牌号、内容和恢复密钥都不会改变。</p>'+
          '<button id="rotateSecretInviteV15" class="button secondary full press">更换秘密邀请链接</button></section>'+
      '</div>');
    setTimeout(()=>{
      $('#copySecretInviteV15').onclick=async()=>{
        const b=$('#copySecretInviteV15');b.disabled=true;
        try{await copyInvite(code);closeModal()}catch(e){toast(e.message||'复制失败');b.disabled=false}
      };
      $('#rotateSecretInviteV15').onclick=()=>confirmRotate(code);
    },0);
  }

  function confirmRotate(code){
    openModal('ROTATE INVITE','确认让旧邀请链接失效？',
      '<div class="invite-panel-v15"><div class="invite-rotate-warning"><b>旧链接会立即失效</b><span>已经保存旧链接的朋友需要你重新发送新链接。这个操作不会删除任何回忆。</span></div>'+
      '<div class="invite-actions"><button id="confirmRotateInviteV15" class="button primary press">更换并复制新链接</button><button id="cancelRotateInviteV15" class="button secondary press">先不更换</button></div></div>');
    setTimeout(()=>{
      $('#cancelRotateInviteV15').onclick=closeModal;
      $('#confirmRotateInviteV15').onclick=async()=>{
        const b=$('#confirmRotateInviteV15');b.disabled=true;
        try{
          await rotate(code);
          await copyInvite(code);
          closeModal();
          toast('新邀请链接已生成 · 旧链接已经失效');
        }catch(e){toast(e.message||'更换失败');b.disabled=false}
      };
    },0);
  }

  function injectSettings(){
    const body=$('#drawerBody');
    if(!body||$('#inviteEntryV15',body)||!PixelNet.hasOwnerToken?.(state.roomCode))return;
    const section=document.createElement('div');
    section.id='inviteEntryV15';
    section.className='drawer-section pm-invite-entry-v15';
    section.innerHTML=
      '<h4>PRIVATE INVITE</h4>'+
      '<p>门牌号保持好记，秘密链接负责进入权限。链接泄露后可以单独更换。</p>'+
      '<button id="openInviteCenterV15" class="button secondary full press">⌁ 管理秘密邀请链接</button>';
    body.appendChild(section);
    $('#openInviteCenterV15').onclick=openCenter;
  }

  const settings=$('#worldSettingsBtn');
  if(settings&&!settings.dataset.inviteWrapped){
    const old=settings.onclick;
    settings.onclick=function(e){old?.call(this,e);setTimeout(injectSettings,0)};
    settings.dataset.inviteWrapped='true';
  }

  const apiState={
    version:'15.6',
    rotating:false,
    tokenFromText,
    ensureToken,
    shareUrl,
    copyInvite,
    rotate,
    useInvite,
    showJoinGate,
    open:openCenter,
    injectSettings
  };
  window.PixelInvite=apiState;
})();