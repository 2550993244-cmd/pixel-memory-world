/* Pixel Memory V12 current world enhancer */
(function(){
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.from((r||document).querySelectorAll(s))};
  document.body.classList.add('pm-world');
  var roomStage=$('#worldStage'), questStage=$('#questStage');
  if(!roomStage||!questStage)return;

  function ensureRoomScenery(){
    if(!roomStage.querySelector('.pm-room-underlay')){
      var under=document.createElement('div');
      under.className='pm-room-underlay';
      under.innerHTML='<i class="pm-window-light"></i><i class="pm-wall-base"></i><i class="pm-floor-inlay"></i>';
      roomStage.insertBefore(under,roomStage.firstChild);
    }
    if(!roomStage.querySelector('.pm-room-props')){
      var props=document.createElement('div');
      props.className='pm-room-props';
      props.innerHTML='<i class="pm-shelf"></i><i class="pm-floor-lamp"></i><span class="pm-books"><i></i><i></i><i></i></span><i class="pm-slippers"></i>';
      roomStage.appendChild(props);
    }
    if(!roomStage.querySelector('.pm-room-foreground')){
      var fg=document.createElement('div');
      fg.className='pm-room-foreground';
      fg.innerHTML='<i class="pm-curtain-edge"></i><i class="pm-foreground-plant"></i>';
      roomStage.appendChild(fg);
    }
  }

  var scene=(window.PixelSceneMap&&window.PixelSceneMap.outdoor)||null;
  function sceneItems(key,fallback){
    if(!scene||!Array.isArray(scene[key]))return fallback;
    return scene[key].map(function(a){
      var x=((a[0]+.5)/scene.cols)*100;
      var y=((a[1]+.5)/scene.rows)*100;
      return [x,y].concat(a.slice(2));
    });
  }
  var trees=sceneItems('trees',[[5,21,'large'],[10,16,''],[15,18,'small'],[23,13,'large'],[29,18,''],[4,49,''],[9,52,'small'],[16,50,'large'],[24,48,'small'],[56,14,''],[61,18,'small'],[67,15,'large'],[74,17,''],[81,14,'small'],[89,18,'large'],[95,14,''],[58,72,'large'],[64,76,''],[70,81,'small'],[77,77,'large'],[84,82,''],[93,76,'small'],[88,49,'large'],[94,44,''],[91,59,'small'],[72,35,'small'],[63,38,'']]);
  var rocks=sceneItems('rocks',[[13,40],[25,59],[33,71],[56,31],[61,58],[69,67],[81,30],[87,65],[31,22]]);
  var grass=sceneItems('grass',[[7,36],[12,62],[20,30],[28,42],[31,84],[55,23],[59,49],[66,28],[72,62],[78,52],[86,36],[93,67],[53,86],[17,86]]);
  var flowers=sceneItems('flowers',[[18,24],[27,77],[57,64],[67,74],[76,23],[88,71]]);
  var stumps=sceneItems('stumps',[[33,39],[79,62]]);
  var routePts=sceneItems('route',[[10,80],[18,77],[27,73],[35,68],[43,63],[52,58],[59,51],[66,44],[74,38],[82,34],[89,31]]);


  function place(parent,cls,x,y,extra){
    var e=document.createElement('i');
    e.className=cls+(extra?' '+extra:'');
    e.style.left=x+'%'; e.style.top=y+'%';
    parent.appendChild(e); return e;
  }

  function ensureOrganicLandscape(){
    if(questStage.querySelector('.pm-landscape-svg'))return;
    var ns='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('class','pm-landscape-svg');
    svg.setAttribute('viewBox','0 0 100 100');
    svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('aria-hidden','true');
    svg.innerHTML=
      '<defs>'+
        '<linearGradient id="pmWater" x1="0" y1="0" x2="1" y2="1">'+
          '<stop offset="0%" stop-color="#5f9eaa"/>'+
          '<stop offset="42%" stop-color="#8ec8c8"/>'+
          '<stop offset="100%" stop-color="#5d95a3"/>'+
        '</linearGradient>'+
        '<linearGradient id="pmPath" x1="0" y1="0" x2="1" y2="0">'+
          '<stop offset="0%" stop-color="#d7bc8c"/>'+
          '<stop offset="52%" stop-color="#e1c99c"/>'+
          '<stop offset="100%" stop-color="#c8ab7a"/>'+
        '</linearGradient>'+
        '<filter id="pmSoft"><feGaussianBlur stdDeviation=".38"/></filter>'+
      '</defs>'+
      '<g class="pm-contours">'+
        '<path d="M-6 31 C12 23 25 28 40 22 S73 16 106 24"/>'+
        '<path d="M-8 36 C13 29 27 34 42 28 S77 23 108 31"/>'+
        '<path d="M-3 86 C18 79 27 85 43 79 S75 72 104 82"/>'+
      '</g>'+
      '<g class="pm-path-ribbon">'+
        '<path class="pm-path-bank" d="M3 80 C15 77 25 73 34 68 C45 62 52 56 59 49 C69 40 78 37 96 29"/>'+
        '<path class="pm-path-core" d="M3 80 C15 77 25 73 34 68 C45 62 52 56 59 49 C69 40 78 37 96 29"/>'+
        '<path class="pm-path-dashes" d="M3 80 C15 77 25 73 34 68 C45 62 52 56 59 49 C69 40 78 37 96 29"/>'+
      '</g>'+
      '<g class="pm-river-ribbon">'+
        '<path class="pm-river-bank" d="M43 -8 C37 12 49 20 44 35 C38 50 50 61 44 74 C39 86 46 94 41 108"/>'+
        '<path class="pm-river-deep" d="M43 -8 C37 12 49 20 44 35 C38 50 50 61 44 74 C39 86 46 94 41 108"/>'+
        '<path class="pm-river-light" d="M43 -8 C37 12 49 20 44 35 C38 50 50 61 44 74 C39 86 46 94 41 108"/>'+
        '<path class="pm-river-ripple r1" d="M39 17 C42 18 45 17 48 19"/>'+
        '<path class="pm-river-ripple r2" d="M39 42 C43 44 46 43 49 45"/>'+
        '<path class="pm-river-ripple r3" d="M39 68 C42 69 46 68 49 70"/>'+
        '<path class="pm-river-ripple r4" d="M38 90 C41 92 44 91 47 93"/>'+
      '</g>';
    var grid=$('#questStage .quest-ground-grid');
    if(grid&&grid.nextSibling)questStage.insertBefore(svg,grid.nextSibling);else questStage.appendChild(svg);

    if(!questStage.querySelector('.pm-horizon-layer')){
      var horizon=document.createElement('div');
      horizon.className='pm-horizon-layer pm-parallax-far';
      horizon.innerHTML='<i class="pm-hill-back"></i><i class="pm-hill-mid"></i><i class="pm-hill-front"></i><i class="pm-cloud c1"></i><i class="pm-cloud c2"></i><i class="pm-cloud c3"></i>';
      questStage.insertBefore(horizon,questStage.firstChild);
    }

    if(!questStage.querySelector('.pm-bridge-svg')){
      var bridge=document.createElementNS(ns,'svg');
      bridge.setAttribute('class','pm-bridge-svg');
      bridge.setAttribute('viewBox','0 0 100 100');
      bridge.setAttribute('preserveAspectRatio','none');
      bridge.setAttribute('aria-hidden','true');
      bridge.innerHTML=
        '<path class="pm-bridge-shadow" d="M34 66 Q44 54 56 59"/>'+
        '<path class="pm-bridge-deck" d="M34 64 Q44 52.8 56 58"/>'+
        '<path class="pm-bridge-planks" d="M34 64 Q44 52.8 56 58"/>'+
        '<path class="pm-bridge-rail rail-a" d="M33.8 61.8 Q44 50.6 56.4 55.8"/>'+
        '<path class="pm-bridge-rail rail-b" d="M34.2 66.5 Q44 55.6 55.8 60.5"/>';
      questStage.appendChild(bridge);
    }
  }

  function ensureQuestScenery(){
    if(!questStage.querySelector('.pm-quest-terrain')){
      var terrain=document.createElement('div');
      terrain.className='pm-quest-terrain';
      trees.forEach(function(a){
        var e=place(terrain,'pm-tree',a[0],a[1],a[2]);
        e.style.zIndex=String(100+Math.round(a[1]));
      });
      rocks.forEach(function(a){
        var e=place(terrain,'pm-rock',a[0],a[1]);
        e.style.zIndex=String(99+Math.round(a[1]));
      });
      grass.forEach(function(a){place(terrain,'pm-grass-tuft',a[0],a[1])});
      flowers.forEach(function(a){place(terrain,'pm-flower-patch',a[0],a[1])});
      stumps.forEach(function(a){
        var e=place(terrain,'pm-stump',a[0],a[1]);
        e.style.zIndex=String(99+Math.round(a[1]));
      });
      questStage.insertBefore(terrain,$('#questRouteLayer'));
    }
    if(!questStage.querySelector('.pm-route-dots')){
      var dots=document.createElement('div'); dots.className='pm-route-dots';
      routePts.forEach(function(a,i){place(dots,'pm-route-dot',a[0],a[1],i===4?'bridge-dot':'')});
      questStage.insertBefore(dots,$('#questAssetLayer'));
    }
    if(!questStage.querySelector('.pm-quest-atmosphere')){
      var atm=document.createElement('div'); atm.className='pm-quest-atmosphere pm-parallax-near';
      for(var i=0;i<10;i++){var e=place(atm,'pm-firefly',10+(i*8.4)%86,18+(i*17)%68);e.style.animationDelay=(i*.31)+'s'}
      for(var j=0;j<5;j++){var l=place(atm,'pm-leaf-particle',3+(j*18),8+(j*13)%50);l.style.animationDelay=(-j*1.4)+'s'}
      questStage.appendChild(atm);
    }
    if(!questStage.querySelector('.pm-quest-foreground')){
      var fg=document.createElement('div'); fg.className='pm-quest-foreground';
      fg.innerHTML='<i class="pm-canopy canopy-a"></i><i class="pm-canopy canopy-b"></i><i class="pm-canopy canopy-c"></i>';
      questStage.appendChild(fg);
    }
  }

  var dirById=new Map(), posById=new Map(), step=0;
  function inferDirection(id,x,y){
    var prev=posById.get(id),dir=dirById.get(id)||'down',moving=false;
    if(prev){
      var dx=x-prev.x,dy=y-prev.y;
      moving=Math.abs(dx)+Math.abs(dy)>.035;
      if(moving)dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    }
    posById.set(id,{x:x,y:y});dirById.set(id,dir);return {dir:dir,moving:moving};
  }
  function spriteMarkup(node){
    if(node.querySelector('.pm-sprite-core'))return;
    var name=node.querySelector('.player-name,.quest-player-name');
    var item=node.querySelector('.player-item');
    var crown=node.querySelector('.host-crown');
    var keep=[name,item,crown].filter(Boolean).map(function(x){return x.outerHTML}).join('');
    node.innerHTML=keep+'<span class="pm-sprite-shadow"></span><span class="pm-sprite-core"><i class="pm-hair"></i><i class="pm-head"></i><i class="pm-eye pm-eye-a"></i><i class="pm-eye pm-eye-b"></i><i class="pm-torso"></i><i class="pm-arm pm-arm-a"></i><i class="pm-arm pm-arm-b"></i><i class="pm-leg pm-leg-a"></i><i class="pm-leg pm-leg-b"></i></span>';
  }
  function upgradeSprites(){
    var nodes=$$('#playersLayer .player').concat($$('#questPlayerLayer .quest-player'));
    step=step?0:1;
    nodes.forEach(function(n,idx){
      var label=n.querySelector('.player-name,.quest-player-name');
      var id=n.dataset.id||(label?label.textContent:'q-'+idx);
      var x=parseFloat(n.style.left)||50,y=parseFloat(n.style.top)||50,st=inferDirection(id,x,y);
      spriteMarkup(n);n.classList.add('pm-sprite');n.dataset.dir=st.dir;n.dataset.step=String(step);
      n.classList.toggle('pm-walking',st.moving||n.classList.contains('walking'));
      n.style.zIndex=String(100+Math.round(y));
    });
  }
  function upgradeMementos(){
    $$('#mementoLayer .memento').forEach(function(n){n.style.zIndex=String(96+Math.round(parseFloat(n.style.top)||50))});
    $$('#questAssetLayer .quest-memory').forEach(function(n){n.style.zIndex=String(92+Math.round(parseFloat(n.style.top)||50))});
  }
  function updateParallax(){
    var me=$('#questPlayerLayer .quest-player.me')||$('#questPlayerLayer .quest-player'); if(!me)return;
    var x=parseFloat(me.style.left)||50,y=parseFloat(me.style.top)||50;
    questStage.style.setProperty('--pm-cam-x',(50-x).toFixed(2));
    questStage.style.setProperty('--pm-cam-y',(50-y).toFixed(2));
  }

  function ensureV12Details(){
    if(!roomStage.querySelector('.pm-room-clock')){
      var props=roomStage.querySelector('.pm-room-props')||roomStage;
      var clock=document.createElement('i');clock.className='pm-room-clock';props.appendChild(clock);
      var cushions=document.createElement('i');cushions.className='pm-cushion-stack';props.appendChild(cushions);
      var ledge=document.createElement('i');ledge.className='pm-photo-ledge';props.appendChild(ledge);
    }
    if(!questStage.querySelector('.pm-quest-details')){
      var d=document.createElement('div');d.className='pm-quest-details';
      sceneItems('reeds',[[36,24],[37,31],[38,39],[52,18],[53,27],[52,77]]).forEach(function(a){place(d,'pm-reed',a[0],a[1])});
      sceneItems('stones',[[7,63],[15,60],[23,57],[30,54]]).forEach(function(a){place(d,'pm-stone-step',a[0],a[1])});
      sceneItems('fences',[[72,72],[82,69]]).forEach(function(a){place(d,'pm-fence-post',a[0],a[1])});
      var cabin=document.createElement('i');cabin.className='pm-cabin-shadow';d.appendChild(cabin);
      questStage.insertBefore(d,$('#questAssetLayer'));
      var chip=document.createElement('div');chip.className='pm-location-chip';
      chip.innerHTML='<i></i><span><b>门外 · 湖边小路</b><small>沿着小路慢慢找，不用赶。</small></span>';
      questStage.appendChild(chip);
      var vignette=document.createElement('i');vignette.className='pm-map-vignette';questStage.appendChild(vignette);
    }
  }

  ensureRoomScenery(); ensureOrganicLandscape(); ensureQuestScenery(); ensureV12Details(); upgradeSprites(); upgradeMementos();
  [$('#playersLayer'),$('#questPlayerLayer'),$('#mementoLayer'),$('#questAssetLayer')].filter(Boolean).forEach(function(layer){
    new MutationObserver(function(){upgradeSprites();upgradeMementos();updateParallax()}).observe(layer,{childList:true,subtree:true});
  });
  function ensureTouchPad(){
    if(document.querySelector('.pm-touch-pad'))return;
    var pad=document.createElement('div');pad.className='pm-touch-pad';pad.setAttribute('aria-label','移动控制');
    pad.innerHTML='<button data-key="w" aria-label="向上">▲</button><button data-key="a" aria-label="向左">◀</button><button data-key="s" aria-label="向下">▼</button><button data-key="d" aria-label="向右">▶</button><button class="pm-touch-action" data-key="e" aria-label="互动">E</button>';
    document.body.appendChild(pad);
    function target(){return document.querySelector('#quest.active #questStage')||document.querySelector('#world.active #worldStage')}
    pad.querySelectorAll('button').forEach(function(btn){
      var key=btn.dataset.key;
      var down=function(ev){ev.preventDefault();var t=target();if(!t)return;t.focus();t.dispatchEvent(new KeyboardEvent('keydown',{key:key,bubbles:true}));btn.classList.add('pressed')};
      var up=function(ev){ev.preventDefault();var t=target();if(t)t.dispatchEvent(new KeyboardEvent('keyup',{key:key,bubbles:true}));btn.classList.remove('pressed')};
      btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',function(ev){if(btn.classList.contains('pressed'))up(ev)});
    });
  }
  ensureTouchPad();
  var tick=0;
  function visualLoop(){
    tick++;
    if(tick%6===0){upgradeSprites();upgradeMementos();updateParallax()}
    var pad=document.querySelector('.pm-touch-pad');
    if(pad)pad.classList.toggle('show',!!document.querySelector('#world.active,#quest.active'));
    requestAnimationFrame(visualLoop);
  }
  visualLoop();
  var brandSmall=$('.brand small');if(brandSmall)brandSmall.textContent='PIXEL MEMORY · V12 WORLD';
})();