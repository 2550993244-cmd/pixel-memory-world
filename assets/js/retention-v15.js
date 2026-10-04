/* Pixel Memory World · V15.5 room archive / deletion lifecycle */
(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const formatDate=ts=>ts?new Date(Number(ts)).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'}):'';

  function clearLocalRoom(code){
    try{
      localStorage.removeItem('pixel-memory-room-'+code);
      localStorage.removeItem('pixel-memory-memory-'+code);
      localStorage.removeItem('pixel-memory-archived-'+code);
      PixelNet.saveOwnerToken?.(code,'');
    }catch(_){}
  }
  function leaveToLanding(){
    try{state.channel?.close()}catch(_){}
    try{broadcast('leave')}catch(_){}
    try{showScreen('landing')}catch(_){}
    try{history.replaceState({},'',location.pathname)}catch(_){}
  }

  async function archiveCurrent(){
    const code=state.roomCode;
    if(!code||!PixelNet.hasOwnerToken?.(code))return toast('只有房主可以归档这个世界');
    const result=await PixelNet.archiveRoom(code);
    localStorage.setItem('pixel-memory-archived-'+code,JSON.stringify(result.meta||{}));
    try{state.channel?.close()}catch(_){}
    leaveToLanding();
    showArchivedRoom({...state,code,meta:result.meta,world:state.world},{justArchived:true});
    return result;
  }

  async function unarchive(code){
    const result=await PixelNet.unarchiveRoom(code);
    localStorage.removeItem('pixel-memory-archived-'+code);
    closeModal();
    toast('这个世界已经重新开放');
    if(state.roomCode===code){
      const remote=await loadRoomRemote(code);
      if(remote===true)showScreen('avatarBuilder');
    }
    return result;
  }

  async function deleteForever(code,typed){
    if(String(typed||'').trim().toUpperCase()!==code) throw new Error('请输入完整门牌号确认永久删除');
    const result=await PixelNet.deleteRoomPermanently(code,typed);
    clearLocalRoom(code);
    closeModal();
    leaveToLanding();
    toast('这个世界已经永久删除');
    return result;
  }

  function permanentDeletePanel(code){
    return '<section class="retention-danger">'+
      '<h4>立即永久删除</h4>'+
      '<p>这会绕过 30 天恢复期，删除房间数据和服务器上能关联到这个房间的照片、录音与自定义资源。此操作不能用恢复密钥撤销。</p>'+
      '<label><span>输入门牌号 <b>'+escapeHTML(code)+'</b> 确认</span><input id="permanentDeleteCode" maxlength="6" autocomplete="off" placeholder="'+escapeHTML(code)+'"></label>'+
      '<button id="deleteForeverV15" class="button danger full press" disabled>永久删除，无法恢复</button>'+
    '</section>';
  }

  function bindDelete(code){
    const input=$('#permanentDeleteCode'),btn=$('#deleteForeverV15');
    if(!input||!btn)return;
    const sync=()=>btn.disabled=input.value.trim().toUpperCase()!==code;
    input.addEventListener('input',sync);sync();
    btn.onclick=async()=>{
      btn.disabled=true;
      try{await deleteForever(code,input.value)}
      catch(e){toast(e.message||'永久删除失败');sync()}
    };
  }

  function showArchivedRoom(room,{justArchived=false}={}){
    const code=(room?.code||state.roomCode||'').toUpperCase();
    const meta=room?.meta||{};
    const purge=formatDate(meta.purgeAfter);
    openModal('ARCHIVED WORLD',justArchived?'这个世界已经归档':'这个世界正在归档中',
      '<div class="retention-panel-v15">'+
        '<div class="retention-archive-card"><b>30 天恢复期</b><span>普通访客现在无法进入。'+(purge?'如果不恢复，预计 '+escapeHTML(purge)+' 后自动永久清理。':'')+'</span></div>'+
        '<section><h4>重新开放</h4><p>恢复后，原来的门牌号、回忆、家具布局和参与者内容都会继续保留。</p><button id="unarchiveRoomV15" class="button primary full press">重新开放这个世界</button></section>'+
        permanentDeletePanel(code)+
      '</div>');
    setTimeout(()=>{
      $('#unarchiveRoomV15').onclick=async()=>{
        const b=$('#unarchiveRoomV15');b.disabled=true;
        try{await unarchive(code)}catch(e){toast(e.message||'恢复失败');b.disabled=false}
      };
      bindDelete(code);
    },0);
  }

  function showGuestArchived(code,data={}){
    const purge=formatDate(data.purgeAfter);
    openModal('WORLD ARCHIVED','这个世界暂时关闭了',
      '<div class="retention-panel-v15"><div class="retention-archive-card guest"><b>房主已经把它收起来了</b><span>现在不能加入。'+(purge?'恢复期预计到 '+escapeHTML(purge)+'。':'')+' 如果房主重新开放，同一个门牌号还能继续使用。</span></div></div>');
  }

  function openArchiveCenter(){
    const code=state.roomCode;
    if(!PixelNet.hasOwnerToken?.(code))return toast('只有房主可以管理这个世界的生命周期');
    openModal('ROOM LIFECYCLE','归档或永久删除这个世界',
      '<div class="retention-panel-v15">'+
        '<div class="retention-archive-card"><b>推荐：先归档</b><span>归档后朋友不能再加入，但你有 30 天时间反悔并恢复。恢复密钥仍然有效。</span></div>'+
        '<section><h4>归档世界</h4><p>适合活动结束、暂时不想公开，或者准备删除但想留一个反悔期。</p><button id="archiveRoomV15" class="button warm full press">归档并开始 30 天恢复期</button></section>'+
        permanentDeletePanel(code)+
      '</div>');
    setTimeout(()=>{
      $('#archiveRoomV15').onclick=async()=>{
        const b=$('#archiveRoomV15');b.disabled=true;
        try{await archiveCurrent()}catch(e){toast(e.message||'归档失败');b.disabled=false}
      };
      bindDelete(code);
    },0);
  }

  function injectSettings(){
    const body=$('#drawerBody');
    if(!body||$('#retentionEntryV15',body)||!PixelNet.hasOwnerToken?.(state.roomCode))return;
    const section=document.createElement('div');
    section.id='retentionEntryV15';
    section.className='drawer-section pm-retention-entry-v15';
    section.innerHTML=
      '<h4>ARCHIVE & DELETE</h4>'+
      '<p>结束以后可以先归档，30 天内随时恢复；永久删除放在更深一层确认。</p>'+
      '<button id="openRetentionCenterV15" class="button secondary full press">⌂ 归档 / 删除这个世界</button>';
    body.appendChild(section);
    $('#openRetentionCenterV15').onclick=openArchiveCenter;
  }

  const settings=$('#worldSettingsBtn');
  if(settings&&!settings.dataset.retentionWrapped){
    const old=settings.onclick;
    settings.onclick=function(e){old?.call(this,e);setTimeout(injectSettings,0)};
    settings.dataset.retentionWrapped='true';
  }

  window.PixelRetention={
    version:'15.5',
    archiveCurrent,
    unarchive,
    deleteForever,
    showArchivedRoom,
    showGuestArchived,
    open:openArchiveCenter,
    injectSettings
  };
})();