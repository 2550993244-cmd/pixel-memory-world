/* Pixel Memory V11 visual world enhancer */
(function(){
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.from((r||document).querySelectorAll(s))};
  document.body.classList.add('v11-world');
  var roomStage=$('#worldStage'), questStage=$('#questStage');
  if(!roomStage||!questStage)return;

  function ensureRoomScenery(){
    if(!roomStage.querySelector('.v11-room-underlay')){
      var under=document.createElement('div');
      under.className='v11-room-underlay';
      under.innerHTML='<i class="v11-window-light"></i><i class="v11-wall-base"></i><i class="v11-floor-inlay"></i>';
      roomStage.insertBefore(under,roomStage.firstChild);
    }
    if(!roomStage.querySelector('.v11-room-props')){
      var props=document.createElement('div');
      props.className='v11-room-props';
      props.innerHTML='<i class="v11-shelf"></i><i class="v11-floor-lamp"></i><span class="v11-books"><i></i><i></i><i></i></span><i class="v11-slippers"></i>';
      roomStage.appendChild(props);
    }
    if(!roomStage.querySelector('.v11-room-foreground')){
      var fg=document.createElement('div');
      fg.className='v11-room-foreground';
      fg.innerHTML='<i class="v11-curtain-edge"></i><i class="v11-foreground-plant"></i>';
      roomStage.appendChild(fg);
    }
  }

  var trees=[[5,21,'large'],[10,16,''],[15,18,'small'],[23,13,'large'],[29,18,''],[4,49,''],[9,52,'small'],[16,50,'large'],[24,48,'small'],[56,14,''],[61,18,'small'],[67,15,'large'],[74,17,''],[81,14,'small'],[89,18,'large'],[95,14,''],[58,72,'large'],[64,76,''],[70,81,'small'],[77,77,'large'],[84,82,''],[93,76,'small'],[88,49,'large'],[94,44,''],[91,59,'small'],[72,35,'small'],[63,38,'']];
  var rocks=[[13,40],[25,59],[33,71],[56,31],[61,58],[69,67],[81,30],[87,65],[31,22]];
  var grass=[[7,36],[12,62],[20,30],[28,42],[31,84],[55,23],[59,49],[66,28],[72,62],[78,52],[86,36],[93,67],[53,86],[17,86]];
  var flowers=[[18,24],[27,77],[57,64],[67,74],[76,23],[88,71]];
  var stumps=[[33,39],[79,62]];
  var routePts=[[10,80],[18,77],[27,73],[35,68],[43,63],[52,58],[59,51],[66,44],[74,38],[82,34],[89,31]];

  function place(parent,cls,x,y,extra){
    var e=document.createElement('i');
    e.className=cls+(extra?' '+extra:'');
    e.style.left=x+'%'; e.style.top=y+'%';
    parent.appendChild(e); return e;
  }

  function ensureQuestScenery(){
    if(!questStage.querySelector('.v11-quest-terrain')){
      var terrain=document.createElement('div');
      terrain.className='v11-quest-terrain v11-parallax-far';
      trees.forEach(function(a){place(terrain,'v11-tree',a[0],a[1],a[2])});
      rocks.forEach(function(a){place(terrain,'v11-rock',a[0],a[1])});
      grass.forEach(function(a){place(terrain,'v11-grass-tuft',a[0],a[1])});
      flowers.forEach(function(a){place(terrain,'v11-flower-patch',a[0],a[1])});
      stumps.forEach(function(a){place(terrain,'v11-stump',a[0],a[1])});
      var sign=place(terrain,'v11-sign',22,67); sign.textContent='回忆路';
      questStage.insertBefore(terrain,$('#questRouteLayer'));
    }
    if(!questStage.querySelector('.v11-route-dots')){
      var dots=document.createElement('div'); dots.className='v11-route-dots';
      routePts.forEach(function(a,i){place(dots,'v11-route-dot',a[0],a[1],i===4?'bridge-dot':'')});
      questStage.insertBefore(dots,$('#questAssetLayer'));
    }
    if(!questStage.querySelector('.v11-quest-atmosphere')){
      var atm=document.createElement('div'); atm.className='v11-quest-atmosphere v11-parallax-near';
      for(var i=0;i<10;i++){var e=place(atm,'v11-firefly',10+(i*8.4)%86,18+(i*17)%68);e.style.animationDelay=(i*.31)+'s'}
      for(var j=0;j<5;j++){var l=place(atm,'v11-leaf-particle',3+(j*18),8+(j*13)%50);l.style.animationDelay=(-j*1.4)+'s'}
      questStage.appendChild(atm);
    }
    if(!questStage.querySelector('.v11-quest-foreground')){
      var fg=document.createElement('div'); fg.className='v11-quest-foreground';
      fg.innerHTML='<i class="v11-canopy canopy-a"></i><i class="v11-canopy canopy-b"></i><i class="v11-canopy canopy-c"></i>';
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
    if(node.querySelector('.v11-sprite-core'))return;
    var name=node.querySelector('.player-name,.quest-player-name');
    var item=node.querySelector('.player-item');
    var crown=node.querySelector('.host-crown');
    var keep=[name,item,crown].filter(Boolean).map(function(x){return x.outerHTML}).join('');
    node.innerHTML=keep+'<span class="v11-sprite-shadow"></span><span class="v11-sprite-core"><i class="v11-hair"></i><i class="v11-head"></i><i class="v11-eye v11-eye-a"></i><i class="v11-eye v11-eye-b"></i><i class="v11-torso"></i><i class="v11-arm v11-arm-a"></i><i class="v11-arm v11-arm-b"></i><i class="v11-leg v11-leg-a"></i><i class="v11-leg v11-leg-b"></i></span>';
  }
  function upgradeSprites(){
    var nodes=$$('#playersLayer .player').concat($$('#questPlayerLayer .quest-player'));
    step=step?0:1;
    nodes.forEach(function(n,idx){
      var label=n.querySelector('.player-name,.quest-player-name');
      var id=n.dataset.id||(label?label.textContent:'q-'+idx);
      var x=parseFloat(n.style.left)||50,y=parseFloat(n.style.top)||50,st=inferDirection(id,x,y);
      spriteMarkup(n);n.classList.add('v11-sprite');n.dataset.dir=st.dir;n.dataset.step=String(step);
      n.classList.toggle('v11-walking',st.moving||n.classList.contains('walking'));
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
    questStage.style.setProperty('--v11-cam-x',(50-x).toFixed(2));
    questStage.style.setProperty('--v11-cam-y',(50-y).toFixed(2));
  }

  ensureRoomScenery(); ensureQuestScenery(); upgradeSprites(); upgradeMementos();
  [$('#playersLayer'),$('#questPlayerLayer'),$('#mementoLayer'),$('#questAssetLayer')].filter(Boolean).forEach(function(layer){
    new MutationObserver(function(){upgradeSprites();upgradeMementos();updateParallax()}).observe(layer,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  });
  var tick=0;
  function visualLoop(){tick++;if(tick%3===0){upgradeSprites();upgradeMementos();updateParallax()}requestAnimationFrame(visualLoop)}
  visualLoop();
  var brandSmall=$('.brand small');if(brandSmall)brandSmall.textContent='PIXEL MEMORY · V11 WORLD';
})();