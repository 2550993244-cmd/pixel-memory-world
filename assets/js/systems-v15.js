/* Pixel Memory World · V15 systems foundation
   P1 camera/layer runtime · P2 character action states ·
   P3 owner room editor · P4 durable-room ownership UI.
   This layer is additive and keeps V14 rooms backward compatible. */
(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const V='15.11';

  window.PixelV15={
    version:V,
    p1:{layers:true,camera:true,tiled:true},
    p2:{actions:['idle','walk','sit','wave','hug','celebrate']},
    p3:{roomEditor:true,persistentLayout:true,undoRedo:true,snap:true,curatedMementos:true},
    p4:{ownerToken:true,durableStorage:true,revisions:true,actorCredentials:true}
  };

  const hasCore=()=>typeof state!=='undefined';
  if(!hasCore()) return;

  // ---------------------------------------------------------------------------
  // P1 · camera runtime over the authored layered quest map
  // ---------------------------------------------------------------------------
  const camera={
    stage:null,world:null,x:0,y:0,zoom:1,worldW:0,worldH:0,ready:false,
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
  function placementMode(){
    return editorIsOpen() || !!camera.stage?.classList.contains('placing');
  }
  function sizeCameraWorld(){
    if(!camera.stage||!camera.world)return;
    const rect=camera.stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const dims=window.PixelMapRuntime?.dimensions?.()||window.PixelSceneMap?.outdoor?.world||{width:1600,height:960};
    const sourceW=Number(dims.width)||1600,sourceH=Number(dims.height)||960;
    const cover=Math.max(rect.width/sourceW,rect.height/sourceH);
    const scale=cover*1.22;
    camera.worldW=Math.max(rect.width,sourceW*scale);
    camera.worldH=Math.max(rect.height,sourceH*scale);
    camera.world.style.width=camera.worldW.toFixed(2)+'px';
    camera.world.style.height=camera.worldH.toFixed(2)+'px';
  }
  function cameraFitTarget(){
    const rect=camera.stage.getBoundingClientRect();
    const z=Math.min(rect.width/camera.worldW,rect.height/camera.worldH)*.96;
    return {
      zoom:z,
      x:(rect.width-camera.worldW*z)/2,
      y:(rect.height-camera.worldH*z)/2
    };
  }
  function screenToWorldPercent(clientX,clientY){
    if(!camera.stage||!camera.worldW||!camera.worldH)return null;
    const r=camera.stage.getBoundingClientRect();
    const wx=(clientX-r.left-camera.x)/camera.zoom;
    const wy=(clientY-r.top-camera.y)/camera.zoom;
    return {
      x:Math.max(0,Math.min(100,wx/camera.worldW*100)),
      y:Math.max(0,Math.min(100,wy/camera.worldH*100))
    };
  }

  function cameraFrame(){
    if(!camera.ready) ensureCameraWorld();
    if(camera.stage&&camera.world){
      if(!camera.worldW||!camera.worldH)sizeCameraWorld();
      const placing=placementMode();
      const active=state.screen==='quest'&&!placing;
      const me=$('.quest-player.me',camera.world);
      if(placing){
        const fit=cameraFitTarget();
        camera.x=fit.x;camera.y=fit.y;camera.zoom=fit.zoom;
      }else if(active&&me){
        const rect=camera.stage.getBoundingClientRect();
        const px=parseFloat(me.style.left)||50;
        const py=parseFloat(me.style.top)||50;
        const minZoom=Math.max(rect.width/camera.worldW,rect.height/camera.worldH);
        const targetZoom=Math.max(minZoom,window.innerWidth<700?.90:1);
        const rawX=rect.width/2-(px/100)*camera.worldW*targetZoom;
        const rawY=rect.height/2-(py/100)*camera.worldH*targetZoom;
        const minX=rect.width-camera.worldW*targetZoom;
        const minY=rect.height-camera.worldH*targetZoom;
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
      camera.stage.classList.toggle('pm-camera-active',state.screen==='quest'&&!placing);
      camera.stage.classList.toggle('pm-camera-fit',state.screen==='quest'&&placing);
    }
    requestAnimationFrame(cameraFrame);
  }
  ensureCameraWorld();
  sizeCameraWorld();
  window.addEventListener('resize',()=>{camera.worldW=0;camera.worldH=0;sizeCameraWorld()});
  window.PixelCameraRuntime={
    version:V,
    screenToWorldPercent,
    resize:sizeCameraWorld,
    get state(){return {x:camera.x,y:camera.y,zoom:camera.zoom,worldW:camera.worldW,worldH:camera.worldH,fit:placementMode()}}
  };
  requestAnimationFrame(cameraFrame);

  function tiledPathD(points){
    if(!points?.length)return '';
    let d='M '+points[0].x.toFixed(2)+' '+points[0].y.toFixed(2);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const mx=(a.x+b.x)/2;
      d+=' Q '+mx.toFixed(2)+' '+a.y.toFixed(2)+' '+b.x.toFixed(2)+' '+b.y.toFixed(2);
    }
    return d;
  }
  function syncTiledVisuals(){
    const rt=window.PixelMapRuntime;
    if(!rt)return;
    const points=rt.pathPoints?.()||[];
    const d=tiledPathD(points);
    if(d){
      $$('.pm-path-bank,.pm-path-core,.pm-path-dashes').forEach(path=>path.setAttribute('d',d));
    }
    const fishing=rt.object?.('fishing');
    const fishEl=$('#questFishingSpot');
    if(fishing&&fishEl){fishEl.style.left=fishing.x+'%';fishEl.style.top=fishing.y+'%'}
    const door=rt.object?.('return-door');
    const doorEl=$('#questReturnDoor');
    if(door&&doorEl){doorEl.style.left=door.x+'%';doorEl.style.top=door.y+'%';doorEl.style.bottom='auto'}
    const badge=$('.pm-camera-badge-v15 span');
    if(badge)badge.textContent=rt.source==='tiled-json'?'CAMERA · TILED MAP':'CAMERA · MAP FALLBACK';
  }
  window.PixelMapRuntime?.ready?.then(()=>setTimeout(syncTiledVisuals,0));
  window.addEventListener('pixel-map-ready',()=>setTimeout(syncTiledVisuals,0));

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
  const cloneLayout=layout=>JSON.parse(JSON.stringify(layout||{}));
  const editor={active:false,drag:null,lastLayout:'',claiming:false,history:[],future:[],keyboardSave:null,mementoSave:null,selectedMemento:'',snap:1};

  function pushHistory(){
    const snap=cloneLayout(state.world.layout);
    const last=editor.history[editor.history.length-1];
    if(last && JSON.stringify(last)===JSON.stringify(snap)) return;
    editor.history.push(snap);
    if(editor.history.length>40) editor.history.shift();
    editor.future=[];
    updateEditorButtons();
  }
  function restoreLocalLayout(layout){
    state.world.layout=cloneLayout(layout);
    editor.lastLayout='';
    applyRoomLayout(true);
    updateEditorButtons();
  }
  async function undoLayout(){
    if(!editor.history.length)return toast('已经是最早一步了');
    editor.future.push(cloneLayout(state.world.layout));
    restoreLocalLayout(editor.history.pop());
    await persistRoomLayout({quiet:true});
    toast('已撤销上一步');
  }
  async function redoLayout(){
    if(!editor.future.length)return toast('没有可以重做的步骤');
    editor.history.push(cloneLayout(state.world.layout));
    restoreLocalLayout(editor.future.pop());
    await persistRoomLayout({quiet:true});
    toast('已重做');
  }
  function updateEditorButtons(){
    const u=$('[data-room-editor-undo]'),r=$('[data-room-editor-redo]');
    if(u)u.disabled=!editor.history.length;
    if(r)r.disabled=!editor.future.length;
  }

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

  function markEditableMementos(){
    if(!editor.active)return;
    $$('#mementoLayer .memento').forEach(el=>{
      el.dataset.curatableMemento=el.dataset.id||'';
      el.setAttribute('tabindex','0');
      const m=state.mementos.find(x=>x.id===el.dataset.id);
      if(m)el.setAttribute('aria-label',`纪念物：${m.title}，${m.by}留下`);
    });
  }
  const mementoLayer=$('#mementoLayer');
  if(mementoLayer&&!mementoLayer._pmCuratorObserver){
    new MutationObserver(()=>markEditableMementos()).observe(mementoLayer,{childList:true});
    mementoLayer._pmCuratorObserver=true;
  }
  function selectedMemento(){
    return state.mementos.find(x=>x.id===editor.selectedMemento)||null;
  }
  function updateMementoEditorButton(){
    const btn=$('[data-room-editor-manage]');
    if(!btn)return;
    const m=selectedMemento();
    btn.disabled=!m;
    btn.textContent=m?'管理「'+String(m.title||'纪念物').slice(0,7)+'」':'管理纪念物';
  }

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
      <div><span>ROOM EDITOR · SNAP 1%</span><b>拖动家具；Ctrl/⌘ + Z 撤销</b></div>
      <button type="button" data-room-editor-undo class="press">↶ 撤销</button>
      <button type="button" data-room-editor-redo class="press">↷ 重做</button>
      <button type="button" data-room-editor-manage class="press" disabled>管理纪念物</button>
      <button type="button" data-room-editor-add class="press">＋ 纪念物</button>
      <button type="button" data-room-editor-reset class="press">恢复家具</button>
      <button type="button" data-room-editor-done class="press primary">完成</button>`;
    $('#worldStage')?.appendChild(bar);
    $('[data-room-editor-done]',bar).onclick=stopRoomEditor;
    $('[data-room-editor-undo]',bar).onclick=undoLayout;
    $('[data-room-editor-redo]',bar).onclick=redoLayout;
    $('[data-room-editor-reset]',bar).onclick=resetRoomLayout;
    $('[data-room-editor-manage]',bar).onclick=()=>{
      const m=selectedMemento();
      if(m){try{openMementoDetail(m)}catch(_){}}
    };
    $('[data-room-editor-add]',bar).onclick=()=>{try{openMementoModal()}catch(_){}};
    updateEditorButtons();
    updateMementoEditorButton();
    return bar;
  }

  async function startRoomEditor(){
    if(!(await ensureOwner()))return;
    editor.active=true;
    editor.history=[];
    editor.future=[];
    editor.selectedMemento='';
    document.body.classList.add('pm-room-editing-v15');
    Object.entries(roomMap()).forEach(([id,def])=>{
      const el=$(def.selector);
      if(el){el.dataset.roomObjectV15=id;el.setAttribute('tabindex','0')}
    });
    editorToolbar();
    markEditableMementos();
    $('#closeRoomDrawer')?.click();
    toast('拖动家具到喜欢的位置，完成后会自动保存');
  }

  function stopRoomEditor(){
    editor.active=false;
    editor.drag=null;
    document.body.classList.remove('pm-room-editing-v15');
    $('.pm-room-editor-toolbar-v15')?.remove();
    $$('[data-room-object-v15]').forEach(el=>el.removeAttribute('tabindex'));
    $$('[data-curatable-memento]').forEach(el=>{el.removeAttribute('tabindex');delete el.dataset.curatableMemento});
    persistRoomLayout();
    $('#worldStage')?.focus();
  }

  async function persistRoomLayout(opts={}){
    state.world.layout={...(state.world.layout||{})};
    try{ saveRoom(false); }catch(_){}
    try{ broadcast('world-patch',{patch:{layout:state.world.layout}}); }catch(_){}
    if(window.PixelNet?.enabled){
      try{
        await PixelNet.updateOwnerLayout(state.roomCode,state.world.layout);
        if(!opts.quiet) toast('房间布置已经长期保存');
      }catch(e){
        if(String(e?.message||'').includes('403')) toast('房主权限已失效，布局只保存在本机');
      }
    }
  }

  async function resetRoomLayout(){
    if(!(await ensureOwner()))return;
    pushHistory();
    state.world.layout={};
    editor.lastLayout='';
    applyRoomLayout(true);
    await persistRoomLayout();
    toast('已经恢复默认房间布置');
  }

  function pointInStage(e){
    const r=worldStage.getBoundingClientRect();
    const snap=v=>Math.round(v/editor.snap)*editor.snap;
    return {
      x:snap(Math.max(4,Math.min(96,(e.clientX-r.left)/r.width*100))),
      y:snap(Math.max(10,Math.min(91,(e.clientY-r.top)/r.height*100)))
    };
  }

  worldStage?.addEventListener('pointerdown',e=>{
    if(!editor.active)return;
    const memoryTarget=e.target.closest('[data-curatable-memento]');
    if(memoryTarget){
      e.preventDefault();e.stopPropagation();
      const id=memoryTarget.dataset.id;
      const m=state.mementos.find(x=>x.id===id);
      if(!m)return;
      editor.selectedMemento=id;
      updateMementoEditorButton();
      editor.drag={kind:'memento',id,el:memoryTarget,pointerId:e.pointerId,origin:{x:m.x,y:m.y}};
      memoryTarget.classList.add('pm-dragging-v15','pm-curator-selected-v15');
      try{worldStage.setPointerCapture(e.pointerId)}catch(_){}
      return;
    }
    const target=e.target.closest('[data-room-object-v15]');
    if(!target)return;
    e.preventDefault();e.stopPropagation();
    const id=target.dataset.roomObjectV15;
    pushHistory();
    editor.drag={kind:'furniture',id,el:target,pointerId:e.pointerId};
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
    if(editor.drag.kind==='memento'){
      const m=state.mementos.find(x=>x.id===editor.drag.id);
      if(m){m.x=p.x;m.y=p.y;editor.drag.el.style.left=p.x+'%';editor.drag.el.style.top=p.y+'%'}
      return;
    }
    state.world.layout||={};
    state.world.layout[editor.drag.id]=p;
    editor.lastLayout='';
    applyRoomLayout(true);
  },true);

  const finishDrag=async e=>{
    if(!editor.drag)return;
    const drag=editor.drag;
    drag.el?.classList.remove('pm-dragging-v15');
    editor.drag=null;
    if(drag.kind==='memento'){
      const m=state.mementos.find(x=>x.id===drag.id);
      if(!m)return;
      try{
        await window.PixelMemoryOps?.commit?.({kind:'memento:move',id:m.id,x:m.x,y:m.y});
        markEditableMementos();
        toast('纪念物位置已经保存');
      }catch(_){
        if(drag.origin){m.x=drag.origin.x;m.y=drag.origin.y}
        renderMementos();
        markEditableMementos();
        toast('这个纪念物的位置没有保存');
      }
      return;
    }
    persistRoomLayout();
  };
  worldStage?.addEventListener('pointerup',finishDrag,true);
  worldStage?.addEventListener('pointercancel',finishDrag,true);

  // Keyboard nudge in edit mode.
  worldStage?.addEventListener('keydown',e=>{
    if(!editor.active)return;
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){
      e.preventDefault();e.stopPropagation();undoLayout();return;
    }
    if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y')||((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='z')){
      e.preventDefault();e.stopPropagation();redoLayout();return;
    }
    const memoryTarget=document.activeElement?.closest?.('[data-curatable-memento]');
    if(memoryTarget){
      const key=e.key.toLowerCase();
      if(!['arrowup','arrowdown','arrowleft','arrowright'].includes(key))return;
      e.preventDefault();e.stopPropagation();
      const m=state.mementos.find(x=>x.id===memoryTarget.dataset.id);if(!m)return;
      editor.selectedMemento=m.id;updateMementoEditorButton();
      if(key==='arrowleft')m.x=Math.max(4,Number(m.x)-1);
      if(key==='arrowright')m.x=Math.min(96,Number(m.x)+1);
      if(key==='arrowup')m.y=Math.max(10,Number(m.y)-1);
      if(key==='arrowdown')m.y=Math.min(91,Number(m.y)+1);
      memoryTarget.style.left=m.x+'%';memoryTarget.style.top=m.y+'%';
      clearTimeout(editor.mementoSave);
      editor.mementoSave=setTimeout(async()=>{try{await window.PixelMemoryOps?.commit?.({kind:'memento:move',id:m.id,x:m.x,y:m.y})}catch(_){}},350);
      return;
    }
    const target=document.activeElement?.closest?.('[data-room-object-v15]');
    if(!target)return;
    const key=e.key.toLowerCase();
    if(!['arrowup','arrowdown','arrowleft','arrowright'].includes(key))return;
    e.preventDefault();e.stopPropagation();
    const id=target.dataset.roomObjectV15;
    pushHistory();
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

  async function restoreLatestCloudRevision(){
    if(!(await ensureOwner()))return;
    if(!window.PixelNet?.enabled)return toast('本机模式没有云端历史版本');
    try{
      const data=await PixelNet.getRevisions(state.roomCode);
      const rev=(data.revisions||[]).find(x=>x.kind==='layout');
      if(!rev)return toast('还没有可恢复的历史布置');
      const result=await PixelNet.restoreRevision(state.roomCode,rev.id);
      state.world.layout=cloneLayout(result.layout||{});
      editor.history=[];
      editor.future=[];
      editor.lastLayout='';
      applyRoomLayout(true);
      try{saveRoom(false)}catch(_){}
      toast('已经恢复上一版云端布置');
    }catch(e){
      toast(String(e?.message||'').includes('403')?'只有房主可以恢复历史版本':'恢复历史版本失败');
    }
  }

  async function restoreLatestMementoRevision(){
    if(!(await ensureOwner()))return;
    if(!window.PixelNet?.enabled)return toast('本机模式没有云端纪念物历史');
    try{
      const data=await PixelNet.getRevisions(state.roomCode);
      const rev=(data.revisions||[]).find(x=>x.kind==='mementos');
      if(!rev)return toast('还没有可以恢复的纪念物整理记录');
      const result=await PixelNet.restoreRevision(state.roomCode,rev.id);
      state.mementos=JSON.parse(JSON.stringify(result.mementos||[]));
      saveMemory();renderMementos();markEditableMementos();
      toast('已经恢复上一次纪念物布置');
    }catch(_){toast('纪念物历史恢复失败')}
  }

  async function revisionStatusText(){
    if(!window.PixelNet?.enabled||!PixelNet.hasOwnerToken?.(state.roomCode))return '';
    try{
      const data=await PixelNet.getRevisions(state.roomCode);
      const count=(data.revisions||[]).filter(x=>x.kind==='layout').length;
      return count ? ' · 已保留 '+count+' 个布局版本' : ' · 暂无历史版本';
    }catch(_){return ''}
  }

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
        <button id="restoreRoomRevisionV15" class="press">↶ 恢复家具上一版<br><small>跨刷新恢复家具布局</small></button>
        <button id="restoreMementoRevisionV15" class="press">✦ 恢复纪念物上一版<br><small>找回房主整理前的纪念物</small></button>
        <button id="resetRoomEditorV15" class="press">↺ 恢复默认布置<br><small>只重置家具位置</small></button>
      </div>`;
    body.prepend(section);
    $('#startRoomEditorV15').onclick=startRoomEditor;
    $('#restoreRoomRevisionV15').onclick=restoreLatestCloudRevision;
    $('#restoreMementoRevisionV15').onclick=restoreLatestMementoRevision;
    $('#resetRoomEditorV15').onclick=resetRoomLayout;
    revisionStatusText().then(extra=>{
      const span=$('.pm-storage-state-v15 span',section);
      if(span&&extra) span.textContent+=extra;
    });
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
    undo:undoLayout,
    redo:redoLayout,
    restoreLatest:restoreLatestCloudRevision,
    restoreMementos:restoreLatestMementoRevision,
    apply:()=>applyRoomLayout(true),
    get historyLength(){return editor.history.length},
    get futureLength(){return editor.future.length},
    get active(){return editor.active}
  };

  // Initial migration/application pass.
  state.world.layout||={};
  applyRoomLayout(true);

  // Update visible system badge if the V14 diagnostic object exists.
  if(window.PixelV14) window.PixelV14.systemVersion=V;
})();