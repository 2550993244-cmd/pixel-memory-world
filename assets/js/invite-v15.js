/* Pixel Memory World · V15.10 ceremonial contributor entry + instant spectators */
(() => {
  const $=(s,r=document)=>r.querySelector(s);

  function tokenFromText(raw){
    const text=String(raw||'').trim();
    if(!text)return {token:'',room:''};
    try{
      const u=new URL(text,location.origin);
      return {token:String(u.searchParams.get('invite')||''),room:String(u.searchParams.get('room')||'').toUpperCase(),role:u.searchParams.get('role')==='view'?'viewer':'contributor'};
    }catch(_){}
    return {token:text.replace(/^invite[:\s]+/i,''),room:'',role:'contributor'};
  }

  async function ensureToken(code,role='contributor'){
    code=String(code||state?.roomCode||'').toUpperCase();
    const isViewer=role==='viewer';
    let token=isViewer?PixelNet.getViewerInviteToken?.(code):PixelNet.getContributorInviteToken?.(code);
    if(token)return token;
    if(!PixelNet.hasOwnerToken?.(code))throw new Error('当前设备没有可分享的秘密邀请链接');
    const data=await PixelNet.rotateInvite(code,isViewer?'viewer':'contributor');
    token=isViewer?(data.viewInviteToken||''):(data.inviteToken||'');
    if(!token)throw new Error('邀请链接生成失败');
    return token;
  }

  async function shareUrl(code,role='contributor'){
    code=String(code||state?.roomCode||'').toUpperCase();
    const safeRole=role==='viewer'?'viewer':'contributor';
    const token=await ensureToken(code,safeRole);
    const u=new URL(location.origin+location.pathname);
    u.searchParams.set('room',code);
    u.searchParams.set('invite',token);
    if(safeRole==='viewer')u.searchParams.set('role','view');
    const server=PixelNet.baseUrl||'';
    if(server && server.replace(/\/$/,'')!==location.origin.replace(/\/$/,'') && !/localhost|127\.0\.0\.1/.test(server)){
      u.searchParams.set('server',server);
    }
    return u.toString();
  }

  async function copyInvite(code,role='contributor'){
    const safeRole=role==='viewer'?'viewer':'contributor';
    const url=await shareUrl(code,safeRole);
    const label=safeRole==='viewer'?'只看链接':'参与链接';
    const text='来我的小小世界吧｜'+label+'｜门牌号 '+String(code||state.roomCode).toUpperCase()+'\n'+url;
    await navigator.clipboard.writeText(text);
    toast(label+'已复制');
    return url;
  }

  async function rotate(code,role='contributor'){
    code=String(code||state.roomCode||'').toUpperCase();
    const safeRole=role==='viewer'?'viewer':'contributor';
    if(!PixelNet.hasOwnerToken?.(code))throw new Error('只有房主可以更换邀请链接');
    apiState.rotatingRole=safeRole;
    try{
      const data=await PixelNet.rotateInvite(code,safeRole);
      if(safeRole==='contributor'&&state?.roomCode===code&&state?.screen==='world'){
        PixelNet.saveInviteRole?.(code,'contributor');
        try{setupChannel()}catch(_){}
      }
      window.dispatchEvent(new CustomEvent('pixel-invite-rotated',{detail:{code,role:safeRole,version:safeRole==='viewer'?data.viewInviteVersion:data.inviteVersion}}));
      return data;
    }finally{
      setTimeout(()=>{apiState.rotatingRole=''},350);
    }
  }

  async function useInvite(code,raw){
    code=String(code||'').toUpperCase();
    const parsed=tokenFromText(raw);
    if(parsed.room && parsed.room!==code)throw new Error('这个邀请链接属于另一个房间');
    if(!parsed.token)throw new Error('请粘贴完整邀请链接或邀请密钥');
    const role=parsed.role==='viewer'?'viewer':'contributor';
    PixelNet.saveInviteToken(code,parsed.token,role);
    PixelNet.saveInviteRole?.(code,role);
    const result=await loadRoomRemote(code);
    if(result===true){
      closeModal();
      if(role==='viewer'){
        enterViewerWorld();
        toast('已经打开这份纪念 · 你的小人只有自己看得到');
      }else{
        openAvatarBuilderForCurrentRole();
        toast('参与邀请验证成功 · 先以自己的样子正式入场');
      }
      return true;
    }
    if(result==='archived')return false;
    PixelNet.clearInviteToken?.(code,role);
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
    const hasContributor=PixelNet.hasInviteToken?.(code,'contributor');
    const hasViewer=PixelNet.hasInviteToken?.(code,'viewer');
    openModal('PRIVATE INVITES','参与链接与只看链接',
      '<div class="invite-panel-v15">'+
        '<div class="invite-lock-card"><b>门牌号 '+escapeHTML(code)+'</b><span>两种秘密链接互相独立：参与链接可以留下内容；只看链接只能进入、走动、阅读、听声音和看照片。</span></div>'+
        '<section class="invite-role-card contributor"><h4>✦ 参与链接</h4><p>适合共同制作纪念空间的朋友。可以留言、上传照片、放纪念物和添加 Outside 回忆。</p>'+
          '<div class="invite-actions"><button id="copyContributorInviteV15" class="button primary press">'+(hasContributor?'复制参与链接':'生成参与链接')+'</button><button id="rotateContributorInviteV15" class="button secondary press">更换</button></div></section>'+
        '<section class="invite-role-card viewer"><h4>◉ 只看链接</h4><p>适合完成后分享给更多同学或家人。可以探索和查看已有内容，但不能新增、上传或修改。</p>'+
          '<div class="invite-actions"><button id="copyViewerInviteV15" class="button warm press">'+(hasViewer?'复制只看链接':'生成只看链接')+'</button><button id="rotateViewerInviteV15" class="button secondary press">更换</button></div></section>'+
        '<div class="invite-rotate-warning"><b>两种链接分别轮换</b><span>更换参与链接不会影响只看访客；更换只看链接也不会踢出正在协作的朋友。</span></div>'+
      '</div>');
    setTimeout(()=>{
      $('#copyContributorInviteV15').onclick=()=>copyInvite(code,'contributor').catch(e=>toast(e.message||'复制失败'));
      $('#copyViewerInviteV15').onclick=()=>copyInvite(code,'viewer').catch(e=>toast(e.message||'复制失败'));
      $('#rotateContributorInviteV15').onclick=()=>confirmRotate(code,'contributor');
      $('#rotateViewerInviteV15').onclick=()=>confirmRotate(code,'viewer');
    },0);
  }

  function confirmRotate(code,role='contributor'){
    const viewer=role==='viewer';
    const label=viewer?'只看链接':'参与链接';
    openModal('ROTATE INVITE','确认更换'+label+'？',
      '<div class="invite-panel-v15"><div class="invite-rotate-warning"><b>旧'+label+'会立即失效</b><span>只影响这一类链接，另一类邀请仍然正常。这个操作不会删除任何回忆。</span></div>'+
      '<div class="invite-actions"><button id="confirmRotateInviteV15" class="button primary press">更换并复制新链接</button><button id="cancelRotateInviteV15" class="button secondary press">先不更换</button></div></div>');
    setTimeout(()=>{
      $('#cancelRotateInviteV15').onclick=closeModal;
      $('#confirmRotateInviteV15').onclick=async()=>{
        const b=$('#confirmRotateInviteV15');b.disabled=true;
        try{
          await rotate(code,role);
          await copyInvite(code,role);
          closeModal();
          toast('新的'+label+'已生成 · 旧链接已经失效');
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
      '<p>分别管理“可以一起留下内容”的参与链接，以及“只能观看探索”的只看链接。</p>'+
      '<button id="openInviteCenterV15" class="button secondary full press">⌁ 管理秘密邀请链接</button>';
    body.appendChild(section);
    $('#openInviteCenterV15').onclick=openCenter;
  }

  setTimeout(()=>{
    const settings=$('#worldSettingsBtn');
    if(settings&&!settings.dataset.inviteWrapped){
      const old=settings.onclick;
      settings.onclick=function(e){old?.call(this,e);setTimeout(injectSettings,0)};
      settings.dataset.inviteWrapped='true';
    }
  },0);

  const apiState={
    version:'15.10',
    rotatingRole:'',
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