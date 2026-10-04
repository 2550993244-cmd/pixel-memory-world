/* Pixel Memory World · V15.2 warm keepsake character runtime
   Production layered SVG spritesheet renderer with DOM fallback. */
(() => {
  const URL='./assets/characters/manifest-v1.json?v=15.2';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let manifest=null,error=null,atlasLoaded=false,raf=0;

  const variant=(node,prefix,fallback)=>{
    const hit=[...node.classList].find(c=>c.startsWith(prefix+'-'));
    return hit ? hit.slice(prefix.length+1) : fallback;
  };
  const assetList=data=>{
    const a=data?.atlas||{};
    return [a.base,...Object.values(a.hair||{}),...Object.values(a.outfit||{})].filter(Boolean);
  };
  const preload=data=>Promise.all(assetList(data).map(src=>new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(src);
    img.onerror=()=>reject(new Error('ATLAS_ASSET_FAILED:'+src));
    img.src=src;
  })));

  function ensureStack(node){
    if(!atlasLoaded||!node)return null;
    let stack=$('.pm-atlas-stack',node);
    if(!stack){
      stack=document.createElement('span');
      stack.className='pm-atlas-stack';
      stack.setAttribute('aria-hidden','true');
      stack.innerHTML='<i class="pm-atlas-layer pm-atlas-body"></i><i class="pm-atlas-layer pm-atlas-outfit"></i><i class="pm-atlas-layer pm-atlas-hair"></i>';
      node.appendChild(stack);
    }
    node.classList.add('pm-atlas-ready');
    applySources(node,stack);
    return stack;
  }

  function applySources(node,stack){
    if(!manifest?.atlas||!stack)return;
    const hair=variant(node,'hair','1');
    const outfit=variant(node,'outfit','coral');
    const base=manifest.atlas.base;
    const hairSrc=manifest.atlas.hair?.[hair]||manifest.atlas.hair?.['1'];
    const outfitSrc=manifest.atlas.outfit?.[outfit]||manifest.atlas.outfit?.coral;
    const b=$('.pm-atlas-body',stack),o=$('.pm-atlas-outfit',stack),h=$('.pm-atlas-hair',stack);
    if(b&&b.dataset.src!==base){b.style.backgroundImage=`url("${base}")`;b.dataset.src=base}
    if(o&&o.dataset.src!==outfitSrc){o.style.backgroundImage=`url("${outfitSrc}")`;o.dataset.src=outfitSrc}
    if(h&&h.dataset.src!==hairSrc){h.style.backgroundImage=`url("${hairSrc}")`;h.dataset.src=hairSrc}
  }

  function currentAction(node){
    if(node.id==='avatarPreview')return 'idle';
    const explicit=node.dataset.action||'idle';
    if(explicit!=='idle')return manifest.actions?.[explicit]?explicit:'idle';
    if(node.classList.contains('pm-walking')||node.classList.contains('walking'))return 'walk';
    return 'idle';
  }

  function currentDirection(node){
    const d=node.dataset.dir||'down';
    return manifest.directionRows?.[d]!==undefined?d:'down';
  }

  function paintNode(node,now){
    const stack=ensureStack(node);
    if(!stack)return;
    applySources(node,stack);
    const action=currentAction(node);
    const dir=currentDirection(node);
    const cfg=manifest.actions?.[action]||manifest.actions.idle;
    const key=action+'|'+dir;
    if(node._pmAtlasKey!==key){
      node._pmAtlasKey=key;
      node._pmAtlasStarted=now;
    }
    const elapsed=Math.max(0,now-(node._pmAtlasStarted||now));
    const stepMs=1000/Math.max(1,Number(cfg.fps)||1);
    let local=Math.floor(elapsed/stepMs);
    if(cfg.loop!==false)local%=Math.max(1,cfg.frames);
    else local=Math.min(Math.max(0,cfg.frames-1),local);
    const frame=(cfg.start||0)+local;
    const row=manifest.directionRows?.[dir]||0;
    stack.style.setProperty('--pm-atlas-x',(-frame*manifest.logicalFrame.width)+'px');
    stack.style.setProperty('--pm-atlas-y',(-row*manifest.logicalFrame.height)+'px');
    stack.dataset.action=action;
    stack.dataset.dir=dir;
    stack.dataset.frame=String(frame);
  }

  function tick(now){
    if(atlasLoaded){
      $$('.player,.quest-player,#avatarPreview').forEach(n=>paintNode(n,now));
    }
    raf=requestAnimationFrame(tick);
  }

  function refresh(){
    if(!atlasLoaded)return;
    $$('.player,.quest-player,#avatarPreview').forEach(n=>paintNode(n,performance.now()));
  }

  const api={
    version:'15.2',
    artDirection:'A-warm-keepsake-pixel',
    get manifest(){return manifest},
    get error(){return error},
    get ready(){return ready},
    get atlasReady(){return atlasLoaded},
    get mode(){return manifest?.mode||'dom-fallback'},
    action(name){return manifest?.actions?.[name]||null},
    refresh,
    async reload(){
      try{
        const r=await fetch(URL,{cache:'no-store'});
        if(!r.ok)throw new Error('CHARACTER_MANIFEST_HTTP_'+r.status);
        const data=await r.json();
        if(!data?.actions||!data?.logicalFrame||!data?.atlas?.base)throw new Error('INVALID_CHARACTER_MANIFEST');
        await preload(data);
        manifest=data;error=null;atlasLoaded=true;
        refresh();
        window.dispatchEvent(new CustomEvent('pixel-character-manifest-ready',{
          detail:{atlasReady:true,version:data.runtimeVersion,artDirection:data.artDirection}
        }));
        return data;
      }catch(e){
        error=e;atlasLoaded=false;
        $$('.pm-atlas-ready').forEach(n=>n.classList.remove('pm-atlas-ready'));
        return null;
      }
    }
  };

  const ready=api.reload();
  window.PixelCharacterRuntime=api;

  new MutationObserver(()=>{if(atlasLoaded)queueMicrotask(refresh)}).observe(document.documentElement,{childList:true,subtree:true});
  if(!raf)raf=requestAnimationFrame(tick);
})();