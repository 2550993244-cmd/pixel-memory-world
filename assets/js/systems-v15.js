/* Pixel Memory World · V15 systems foundation
   P1 camera/layer runtime · P2 character action states ·
   P3 owner room editor · P4 durable-room ownership UI.
   This layer is additive and keeps V14 rooms backward compatible. */
(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const V='15.0';

  window.PixelV15={
    version:V,
    p1:{layers:true,camera:true},
    p2:{actions:['idle','walk','sit','wave','hug','celebrate']},
    p3:{roomEditor:true,persistentLayout:true},
    p4:{ownerToken:true,durableStorage:true}
  };

  const hasCore=()=>typeof state!=='undefined';
  if(!hasCore()) return;

  // ---------------------------------------------------------------------------
  // P1 · camera runtime over the authored layered quest map
  // ---------------------------------------------------------------------------
  const camera={
    stage:null,world:null,x:0,y:0,zoom:1,ready:false,
    fixedSelectors:['#questPrompt','.quest-map-caption','.pm-camera-badge-v15']
  };

  function isCameraUi(node){
    if(!(node instanceof Element)) return true;
    return camera.fixedSelectors.some(sel=>node.matches(sel)) || node.classList.contains('pm-camera-world-v15');
  }

  function ensureCameraWorld(){
    const stage=$('#questStage');
    if(!stage) return;
    camera.stage=stage;
    let world=$('.pm-camera-world-v15',stage);
    if(!world){
      world=document.createElement('div');
      world.className='pm-camera-world-v15';
      world.setAttribute('aria-hidden','false');
      [...stage.children].forEach(node=>{
        if(!isCameraUi(node)) world.appendChild(node);
      });
      stage.insertBefore(world,stage.firstChild);
    }
    camera.world=world;

    if(!$('.pm-camera-badge-v15',stage)){
      const badge=document.createElement('div');
      badge.className='pm-camera-badge-v15';
      badge.innerHTML='<i></i><span>CAMERA · LAYERED MAP</span>';
      badge.dataset.cameraUi='true';
      stage.appendChild(badge);
    }

    if(!stage._pmCameraObserver){
      const obs=new MutationObserver(mutations=>{
        mutations.forEach(m=>[...m.addedNodes].forEach(node=>{
          if(node instanceof Element && node.parentElement===stage && !isCameraUi(node)){
            world.appendChild(node);
          }
        }));
      });
      obs.observe(stage,{childList:true});
      stage._pmCameraObserver=obs;
    }
    camera.ready=true;
  }

  function editorIsOpen(){
    const ed=$('#questEditor');
    return !!ed && !ed.classList.contains('hidden');
  }

  function cameraFrame(){
    if(!camera.ready) ensureCameraWorld();
    if(camera.stage&&camera.world){
      const active=state.screen==='quest'&&!editorIsOpen();
      const me=$('.quest-player.me',camera.world);
      if(active&&me){
        const rect=camera.stage.getBoundingClientRect();
        const px=parseFloat(me.style.left)||50;
        const py=parseFloat(me.style.top)||50;
        const mapZoom=Number(window.PixelSceneMap?.outdoor?.world?.viewportScale)||1.22;
        const targetZoom=window.innerWidth<700?Math.max(1.10,mapZoom-.10):mapZoom;
        const rawX=rect.width/2-(px/100)*rect.width*targetZoom;
        const rawY=rect.height/2-(py/100)*rect.height*targetZoom;
        const minX=rect.width-rect.width*targetZoom;
        const minY=rect.height-rect.height*targetZoom;
        const tx=Math.max(minX,Math.min(0,rawX));
        const ty=Math.max(minY,Math.min(0,rawY));
        camera.x+=(tx-camera.x)*.12;
        camera.y+=(ty-camera.y)*.12;
        camera.zoom+=(targetZoom-camera.zoom)*.12;
      }else{
        camera.x+=(0-camera.x)*.16;
        camera.y+=(0-camera.y)*.16;
        camera.zoom+=(1-camera.zoom)*.16;
      }
      camera.world.style.transform=`translate3d(${camera.x.toFixed(2)}px,${camera.y.toFixed(2)}px,0) scale(${camera.zoom.toFixed(4)})`;
      camera.stage.classList.toggle('pm-camera-active',state.screen==='quest'&&!editorIsOpen());
    }
    requestAnimationFrame(cameraFrame);
  }
  ensureCameraWorld();
  requestAnimationFrame(cameraFrame);

  // ---------------------------------------------------------------------------
  // P2 · finite character action states on top of the existing sprite renderer
  // ---------------------------------------------------------------------------
  const actionTimers=new Map();
  const validActions=new Set(['idle','walk','sit','wave','hug','celebrate']);

  function broadcastPlayerState(){
    try{
      state.players.set(state.player.id,{...state.player,lastSeen:Date.now()});
      if(state.screen==='world'&&typeof broadcast==='function') broadcast('state');
    }catch(_){}
  }

  function setCharacterAction(action='idle',duration=0){
    if(!validActions.has(action)) action='idle';
    state.player.action=action;
    broadcastPlayerState();
    clearTimeout(actionTimers.get(state.player.id));
    if(duration>0){
      const t=setTimeout(()=>{
        state.player.action='idle';
        broadcastPlayerState();
      },duration);
      actionTimers.set(state.player.id,t);
    }
    paintCharacterActions();
  }

  function paintCharacterActions(){
    try{
      for(const [id,p] of state.players){
        const el=$(`.player[data-id="${CSS.escape(id)}"]`);
        if(el) el.dataset.action=p.action||'idle';
      }
      const qme=$('.quest-player.me');
      if(qme) qme.dataset.action=state.player.action||'idle';
    }catch(_){}
  }
  setInterval(paintCharacterActions,120);

  const worldStage=$('#worldStage');
  const questStage=$('#questStage');
  [worldStage,questStage].forEach(stage=>stage?.addEventListener('keydown',e=>{
    if(e.key.toLowerCase()==='q'){
      e.preventDefault();
      setCharacterAction('wave',1100);
      try{ reaction(state.player.id,'👋'); }catch(_){}
    }
  }));

  worldStage?.addEventListener('keydown',e=>{
    if(e.key.toLowerCase()==='e'&&state.near?.id==='sofa') setCharacterAction('sit',2200);
  });

  $('[data-dock="hug"]')?.addEventListener('click',()=>setCharacterAction('hug',1050));
  $('[data-dock="celebrate"]')?.addEventListener('click',()=>setCharacterAction('celebrate',1700));

  const movementTip=$('.movement-tip');
  if(movementTip&&!movementTip.dataset.v15){
    movementTip.dataset.v15='true';
    movementTip.insertAdjacentHTML('beforeend','<i>·</i><span>Q</span><span>招手</span>');
  }

  window.PixelCharacterActions={set:setCharacterAction,actions:[...validActions]};

  // ---------------------------------------------------------------------------
  // P3 · owner room editor
  // ---------------------------------------------------------------------------
  const roomMap=()=>window.PixelSceneMap?.room?.editableObjects||{};
  const editor={active:false,drag:null,lastLayout:'',claiming:false};

  function layoutObject(id){
    return roomMap()[id]||null;
  }

  function objectElement(id){
    const def=layoutObject(id);
    return def?.selector?$(def.selector):null;
  }

  function syncInteractionPoint(id,x,y){
    try{
      const obj=fixedObjects.find(o=>o.id===id);
      if(obj){obj.x=x;obj.y=y}
    }catch(_){}
  }

  function clearPosition(el){
    if(!el)return;
    el.classList.remove('pm-layout-positioned-v15');
    el.style.removeProperty('left');
    el.style.removeProperty('top');
    el.style.removeProperty('right');
    el.style.removeProperty('bottom');
    el.style.removeProperty('transform');
  }

  function applyRoomLayout(force=false){
    const layout=state.world.layout||{};
    const signature=JSON.stringify(layout);
    if(!force&&signature===editor.lastLayout)return;
    editor.lastLayout=signature;
    Object.entries(roomMap()).forEach(([id,def])=>{
      const el=$(def.selector);
      if(!el)return;
      el.dataset.roomObjectV15=id;
      el.setAttribute('aria-label',def.label||id);
      const pos=layout[id];
      if(pos&&Number.isFinite(Number(pos.x))&&Number.isFinite(Number(pos.y))){
        const x=Math.max(4,Math.min(96,Number(pos.x)));
        const y=Math.max(8,Math.min(92,Number(pos.y)));
        el.classList.add('pm-layout-positioned-v15');
        el.style.left=x+'%';
        el.style.top=y+'%';
        el.style.right='auto';
        el.style.bottom='auto';
        el.style.transform='translate(-50%,-50%)';
        syncInteractionPoint(id,x,y);
      }else{
        clearPosition(el);
        if(Number.isFinite(def.x)&&Number.isFinite(def.y)) syncInteractionPoint(id,def.x,def.y);
      }
    });
  }

  setInterval(()=>{ if(state.screen==='world') applyRoomLayout(); },300);

  async function ensureOwner(){
    if(!window.PixelNet?.enabled) return true;
    if(PixelNet.hasOwnerToken?.(state.roomCode)) return true;
    if(!state.player.host){
      toast('只有创建这个世界的房主设备可以调整布局');
      return false;
    }
    if(editor.claiming)return false;
    editor.claiming=true;
    try{
      await PixelNet.claimRoom(state.roomCode);
      toast('旧房间已经绑定到这台房主设备');
      return true;
    }catch(e){
      toast(String(e?.message||'').includes('409')?'这个房间已经有房主设备':'暂时无法确认房主权限');
      return false;
    }finally{editor.claiming=false}
  }

  function editorToolbar(){
    let bar=$('.pm-room-editor-toolbar-v15');
    if(bar)return bar;
    bar=document.createElement('div');
    bar.className='pm-room-editor-toolbar-v15';
    bar.innerHTML=`
      <div><span>ROOM EDITOR</span><b>拖动家具，布置你们自己的房间</b></div>
      <button type="button" data-room-editor-add class="press">＋ 纪念物</button>
      <button type="button" data-room-editor-reset class="press">恢复默认</button>
      <button type="button" data-room-editor-done class="press primary">完成</button>`;
    $('#worldStage')?.appendChild(bar);
    $('[data-room-editor-done]',bar).onclick=stopRoomEditor;
    $('[data-room-editor-reset]',bar).onclick=resetRoomLayout;
    $('[data-room-editor-add]',bar).onclick=()=>{try{openMementoModal()}catch(_){}};
    return bar;
  }

  async function startRoomEditor(){
    if(!(await ensureOwner()))return;
    editor.active=true;
    document.body.classList.add('pm-room-editing-v15');
    Object.entries(roomMap()).forEach(([id,def])=>{
      const el=$(def.selector);
      if(el){el.dataset.roomObjectV15=id;el.setAttribute('tabindex','0')}
    });
    editorToolbar();
    $('#closeRoomDrawer')?.click();
    toast('拖动家具到喜欢的位置，完成后会自动保存');
  }

  function stopRoomEditor(){
    editor.active=false;
    editor.drag=null;
    document.body.classList.remove('pm-room-editing-v15');
    $('.pm-room-editor-toolbar-v15')?.remove();
    $$('[data-room-object-v15]').forEach(el=>el.removeAttribute('tabindex'));
    persistRoomLayout();
    $('#worldStage')?.focus();
  }

  async function persistRoomLayout(){
    state.world.layout={...(state.world.layout||{})};
    try{ saveRoom(false); }catch(_){}
    try{ broadcast('world-patch',{patch:{layout:state.world.layout}}); }catch(_){}
    if(window.PixelNet?.enabled){
      try{
        await PixelNet.updateOwnerLayout(state.roomCode,state.world.layout);
        toast('房间布置已经长期保存');
      }catch(e){
        if(String(e?.message||'').includes('403')) toast('房主权限已失效，布局只保存在本机');
      }
    }
  }

  async function resetRoomLayout(){
    if(!(await ensureOwner()))return;
    state.world.layout={};
    editor.lastLayout='';
    applyRoomLayout(true);
    await persistRoomLayout();
    toast('已经恢复默认房间布置');
  }

  function pointInStage(e){
    const r=worldStage.getBoundingClientRect();
    return {
      x:Math.max(4,Math.min(96,(e.clientX-r.left)/r.width*100)),
      y:Math.max(10,Math.min(91,(e.clientY-r.top)/r.height*100))
    };
  }

  worldStage?.addEventListener('pointerdown',e=>{
    if(!editor.active)return;
    const target=e.target.closest('[data-room-object-v15]');
    if(!target)return;
    e.preventDefault();e.stopPropagation();
    const id=target.dataset.roomObjectV15;
    editor.drag={id,el:target,pointerId:e.pointerId};
    target.classList.add('pm-dragging-v15');
    try{worldStage.setPointerCapture(e.pointerId)}catch(_){}
    const p=pointInStage(e);
    state.world.layout||={};
    state.world.layout[id]=p;
    editor.lastLayout='';
    applyRoomLayout(true);
  },true);

  worldStage?.addEventListener('pointermove',e=>{
    if(!editor.active||!editor.drag||editor.drag.pointerId!==e.pointerId)return;
    e.preventDefault();
    const p=pointInStage(e);
    state.world.layout||={};
    state.world.layout[editor.drag.id]=p;
    editor.lastLayout='';
    applyRoomLayout(true);
  },true);

  const finishDrag=e=>{
    if(!editor.drag)return;
    editor.drag.el?.classList.remove('pm-dragging-v15');
    editor.drag=null;
    persistRoomLayout();
  };
  worldStage?.addEventListener('pointerup',finishDrag,true);
  worldStage?.addEventListener('pointercancel',finishDrag,true);

  // Keyboard nudge in edit mode.
  worldStage?.addEventListener('keydown',e=>{
    if(!editor.active)return;
    const target=document.activeElement?.closest?.('[data-room-object-v15]');
    if(!target)return;
    const key=e.key.toLowerCase();
    if(!['arrowup','arrowdown','arrowleft','arrowright'].includes(key))return;
    e.preventDefault();e.stopPropagation();
    const id=target.dataset.roomObjectV15;
    const def=layoutObject(id)||{};
    const cur=state.world.layout?.[id]||{x:def.x||50,y:def.y||50};
    const next={x:Number(cur.x),y:Number(cur.y)};
    if(key==='arrowleft')next.x-=1;
    if(key==='arrowright')next.x+=1;
    if(key==='arrowup')next.y-=1;
    if(key==='arrowdown')next.y+=1;
    next.x=Math.max(4,Math.min(96,next.x));
    next.y=Math.max(10,Math.min(91,next.y));
    state.world.layout||={};state.world.layout[id]=next;
    editor.lastLayout='';applyRoomLayout(true);
    clearTimeout(editor.keyboardSave);
    editor.keyboardSave=setTimeout(persistRoomLayout,350);
  },true);

  function storageStatus(){
    if(!window.PixelNet?.enabled)return '当前为本机保存模式';
    if(PixelNet.hasOwnerToken?.(state.roomCode))return '房主权限已绑定 · 云端保存开启';
    return '云端房间 · 当前设备不是已绑定房主';
  }

  function injectRoomEditorControls(){
    const body=$('#drawerBody');
    if(!body||$('#roomEditorV15',body))return;
    const section=document.createElement('div');
    section.id='roomEditorV15';
    section.className='drawer-section pm-editor-entry-v15';
    section.innerHTML=`
      <h4>WORLD EDITOR · V15</h4>
      <p>家具位置会跟着房间一起保存。照片纪念物和户外回忆路线继续使用现有编辑器。</p>
      <div class="pm-storage-state-v15"><i></i><span>${storageStatus()}</span></div>
      <div class="settings-grid">
        <button id="startRoomEditorV15" class="press">✥ 调整房间布置<br><small>拖动沙发、蛋糕桌、照片墙等</small></button>
        <button id="resetRoomEditorV15" class="press">↺ 恢复默认布置<br><small>只重置家具位置</small></button>
      </div>`;
    body.prepend(section);
    $('#startRoomEditorV15').onclick=startRoomEditor;
    $('#resetRoomEditorV15').onclick=resetRoomLayout;
  }

  const settingsBtn=$('#worldSettingsBtn');
  if(settingsBtn&&settingsBtn.onclick&&!settingsBtn.dataset.v15Wrapped){
    const old=settingsBtn.onclick;
    settingsBtn.onclick=function(e){
      old.call(this,e);
      setTimeout(injectRoomEditorControls,0);
    };
    settingsBtn.dataset.v15Wrapped='true';
  }

  window.PixelRoomEditor={
    start:startRoomEditor,
    stop:stopRoomEditor,
    reset:resetRoomLayout,
    apply:()=>applyRoomLayout(true),
    get active(){return editor.active}
  };

  // Initial migration/application pass.
  state.world.layout||={};
  applyRoomLayout(true);

  // Update visible system badge if the V14 diagnostic object exists.
  if(window.PixelV14) window.PixelV14.systemVersion=V;
})();