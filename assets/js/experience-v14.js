/* Pixel Memory World V14 · progressive visual enhancement */
(function(){
  var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse=window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

  document.body.classList.add('v14-ready');

  var lenis=null;
  var fallbackRaf=0;
  if(window.Lenis && !reduce){
    try{
      lenis=new window.Lenis({
        autoRaf:false,
        smoothWheel:!coarse,
        syncTouch:false,
        lerp:.085,
        anchors:true,
        allowNestedScroll:true
      });
      window.PixelLenis=lenis;
      if(window.gsap){
        window.gsap.ticker.add(function(time){lenis.raf(time*1000)});
        window.gsap.ticker.lagSmoothing(0);
      }else{
        var lenisRaf=function(t){lenis.raf(t);fallbackRaf=requestAnimationFrame(lenisRaf)};
        fallbackRaf=requestAnimationFrame(lenisRaf);
      }
    }catch(_){lenis=null}
  }

  var screens=$$('.screen');
  var lastScreenId=null;
  function activeScreen(){return screens.find(function(s){return s.classList.contains('active')})||null}
  function syncScreen(){
    var active=activeScreen();
    var id=active?active.id:'';
    if(id===lastScreenId)return;
    lastScreenId=id;
    if(lenis){
      if(id==='world'||id==='quest')lenis.stop();
      else lenis.start();
      setTimeout(function(){if(lenis.resize)lenis.resize()},60);
    }
    document.body.classList.toggle('landing-mode',id==='landing');
    if(active && id!=='world' && id!=='quest' && !reduce){
      active.classList.remove('v14-screen-enter');
      void active.offsetWidth;
      active.classList.add('v14-screen-enter');
    }
  }
  screens.forEach(function(s){
    new MutationObserver(syncScreen).observe(s,{attributes:true,attributeFilter:['class']});
  });
  syncScreen();

  var spotlightSelector='.compact-features article,.memory-tile,.theme-choice,.creator-scene-preview,.avatar-controls,.join-card,.music-now';
  function decorateSpotlights(root){
    if(!root||!root.querySelectorAll)return;
    root.querySelectorAll(spotlightSelector).forEach(function(el){el.classList.add('v14-spotlight')});
  }
  decorateSpotlights(document);
  new MutationObserver(function(records){
    records.forEach(function(record){
      record.addedNodes.forEach(function(node){
        if(node.nodeType!==1)return;
        if(node.matches && node.matches(spotlightSelector))node.classList.add('v14-spotlight');
        decorateSpotlights(node);
      });
    });
  }).observe(document.body,{subtree:true,childList:true});

  if(!coarse && !reduce){
    document.addEventListener('pointermove',function(e){
      var el=e.target.closest && e.target.closest('.v14-spotlight');
      if(!el)return;
      var r=el.getBoundingClientRect();
      el.style.setProperty('--v14-spot-x',(e.clientX-r.left).toFixed(1)+'px');
      el.style.setProperty('--v14-spot-y',(e.clientY-r.top).toFixed(1)+'px');
    },{passive:true});
  }

  var landing=$('#landing');
  if(landing && !reduce){
    var canvas=document.createElement('canvas');
    canvas.className='v14-ambient-canvas';
    canvas.setAttribute('aria-hidden','true');
    landing.prepend(canvas);
    var ctx=canvas.getContext('2d');
    var palette=[
      [207,119,121,.18],
      [132,173,189,.20],
      [140,165,138,.18],
      [221,185,99,.17]
    ];
    var blobs=[
      {x:.12,y:.18,r:.26,vx:.00008,vy:.00005,c:0},
      {x:.78,y:.20,r:.30,vx:-.00006,vy:.00007,c:1},
      {x:.64,y:.69,r:.27,vx:.00005,vy:-.00005,c:2},
      {x:.20,y:.76,r:.22,vx:.00005,vy:-.00004,c:3}
    ];
    var mx=.5,my=.35,last=performance.now();
    function resizeAmbient(){
      var ratio=Math.max(.7,Math.min(1.8,landing.clientHeight/Math.max(landing.clientWidth,1)));
      canvas.width=220;
      canvas.height=Math.round(220*ratio);
    }
    resizeAmbient();
    if(window.ResizeObserver)new ResizeObserver(resizeAmbient).observe(landing);
    landing.addEventListener('pointermove',function(e){
      var r=landing.getBoundingClientRect();
      mx=(e.clientX-r.left)/Math.max(r.width,1);
      my=(e.clientY-r.top)/Math.max(r.height,1);
    },{passive:true});
    function drawAmbient(now){
      requestAnimationFrame(drawAmbient);
      if(!landing.classList.contains('active'))return;
      var dt=Math.min(32,now-last);last=now;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      blobs.forEach(function(blob,i){
        blob.x+=blob.vx*dt;blob.y+=blob.vy*dt;
        if(blob.x<-.15||blob.x>1.15)blob.vx*=-1;
        if(blob.y<-.15||blob.y>1.15)blob.vy*=-1;
        var px=(blob.x+(mx-.5)*(i%2?-.045:.035))*canvas.width;
        var py=(blob.y+(my-.5)*(i%2?.035:-.025))*canvas.height;
        var rr=blob.r*Math.max(canvas.width,canvas.height);
        var col=palette[blob.c],r=col[0],g=col[1],bb=col[2],a=col[3];
        var grad=ctx.createRadialGradient(px,py,0,px,py,rr);
        grad.addColorStop(0,'rgba('+r+','+g+','+bb+','+a+')');
        grad.addColorStop(.55,'rgba('+r+','+g+','+bb+','+(a*.54)+')');
        grad.addColorStop(1,'rgba('+r+','+g+','+bb+',0)');
        ctx.fillStyle=grad;
        ctx.fillRect(px-rr,py-rr,rr*2,rr*2);
      });
      ctx.fillStyle='rgba(95,76,63,.045)';
      for(var i=0;i<22;i++){
        var x=(i*43+Math.floor(now/180))%canvas.width;
        var y=(i*29+17)%canvas.height;
        ctx.fillRect(x,y,1,1);
      }
    }
    requestAnimationFrame(drawAmbient);
  }

  if(landing){
    var rail=document.createElement('nav');
    rail.className='v14-chapter-rail';
    rail.setAttribute('aria-label','首页章节');
    var chapters=[
      {label:'01 · 走进去',target:$('.landing-hero',landing)},
      {label:'02 · 一起留下',target:$('.compact-features',landing)},
      {label:'03 · 把它记住',target:$('.story-band',landing)}
    ].filter(function(x){return !!x.target});
    chapters.forEach(function(ch,i){
      var b=document.createElement('button');
      b.type='button';b.setAttribute('aria-label',ch.label);b.dataset.index=String(i);
      if(i===0)b.classList.add('active');
      b.onclick=function(){
        if(lenis)lenis.scrollTo(ch.target,{offset:-86,duration:1.05});
        else ch.target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      };
      rail.appendChild(b);
    });
    landing.appendChild(rail);

    function updateLandingProgress(){
      if(!landing.classList.contains('active'))return;
      var top=landing.getBoundingClientRect().top+window.scrollY;
      var range=Math.max(1,landing.scrollHeight-window.innerHeight);
      var p=Math.max(0,Math.min(1,(window.scrollY-top)/range));
      document.documentElement.style.setProperty('--v14-progress',p.toFixed(4));
      var best=0,bestDist=Infinity;
      chapters.forEach(function(ch,i){
        var d=Math.abs(ch.target.getBoundingClientRect().top-window.innerHeight*.36);
        if(d<bestDist){bestDist=d;best=i}
      });
      rail.querySelectorAll('button').forEach(function(btn,i){btn.classList.toggle('active',i===best)});
    }
    if(lenis)lenis.on('scroll',updateLandingProgress);
    window.addEventListener('scroll',updateLandingProgress,{passive:true});
    window.addEventListener('resize',updateLandingProgress,{passive:true});
    updateLandingProgress();
  }

  var sceneShell=$('.hero-scene-shell');
  if(sceneShell){
    var wipe=document.createElement('span');
    wipe.className='v14-pixel-wipe';
    for(var j=0;j<54;j++)wipe.appendChild(document.createElement('i'));
    sceneShell.appendChild(wipe);
    var pixels=$$('i',wipe);
    function pixelFlash(){
      if(reduce)return;
      if(window.gsap){
        window.gsap.killTweensOf(pixels);
        window.gsap.set(pixels,{opacity:0,scale:.55});
        window.gsap.to(pixels,{
          opacity:1,scale:1,duration:.045,
          stagger:{each:.006,from:'random'},
          onComplete:function(){
            window.gsap.to(pixels,{opacity:0,scale:1.1,duration:.05,stagger:{each:.005,from:'random'},delay:.035});
          }
        });
      }else{
        pixels.forEach(function(pixel,i){
          pixel.animate(
            [{opacity:0,transform:'scale(.55)'},{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.08)'}],
            {duration:380,delay:(i*17)%240,easing:'steps(2,end)'}
          );
        });
      }
    }
    var bell=$('#heroDoorbell');
    if(bell)bell.addEventListener('click',pixelFlash);
  }

  if(window.gsap && !reduce){
    var gsap=window.gsap;
    if(window.ScrollTrigger){
      gsap.registerPlugin(window.ScrollTrigger);
      if(lenis)lenis.on('scroll',function(){window.ScrollTrigger.update()});
    }
    if($('.landing-hero')){
      gsap.set(['.hero-kicker','.hero-copy h1','.hero-copy>p','.hero-cta','.hero-proof','.hero-preview-wrap'],{willChange:'transform,opacity,filter'});
      gsap.timeline({defaults:{ease:'power3.out'}})
        .from('.hero-kicker',{y:10,opacity:0,duration:.48})
        .from('.hero-copy h1',{y:28,opacity:0,filter:'blur(10px)',duration:.82},'-.24')
        .from('.hero-copy>p',{y:16,opacity:0,duration:.62},'-.42')
        .from('.hero-cta',{y:14,opacity:0,duration:.5},'-.36')
        .from('.hero-proof',{y:10,opacity:0,duration:.46},'-.30')
        .from('.hero-preview-wrap',{x:26,y:16,opacity:0,filter:'blur(10px)',duration:.86},'-.78');
    }
    if(window.ScrollTrigger){
      gsap.from('.compact-features article',{
        scrollTrigger:{trigger:'.compact-features',start:'top 84%'},
        y:34,opacity:0,filter:'blur(7px)',stagger:.09,duration:.62,ease:'power3.out'
      });
      gsap.from('.story-copy>*',{
        scrollTrigger:{trigger:'.story-band',start:'top 78%'},
        y:26,opacity:0,stagger:.08,duration:.62,ease:'power3.out'
      });
      gsap.from('.memory-tile',{
        scrollTrigger:{trigger:'.memory-strip',start:'top 82%'},
        y:42,opacity:0,stagger:{each:.08,from:'random'},duration:.7,ease:'power3.out'
      });
      gsap.to('.landing-symbols',{
        yPercent:-18,ease:'none',
        scrollTrigger:{trigger:'#landing',start:'top top',end:'bottom bottom',scrub:.6}
      });
    }
  }

  window.PixelV14={
    version:'14.2',
    lenis:!!lenis,
    gsap:!!window.gsap,
    scrollTrigger:!!window.ScrollTrigger,
    spotlight:true,
    ambient:!!$('.v14-ambient-canvas')
  };

  /* Optional motion libraries are lazy-loaded so third-party CDNs can never
     block the landing page or the Create → Avatar → Room → Outside flow. */
  function v14LoadScript(src,ready){
    return new Promise(function(resolve){
      if(ready())return resolve(true);
      var script=document.createElement('script');
      var done=false;
      var finish=function(ok){
        if(done)return;
        done=true;
        clearTimeout(timer);
        resolve(ok);
      };
      script.src=src;
      script.async=true;
      script.crossOrigin='anonymous';
      script.onload=function(){finish(ready())};
      script.onerror=function(){finish(false)};
      document.head.appendChild(script);
      var timer=setTimeout(function(){finish(false)},4200);
    });
  }

  function v14UpgradeWithLibraries(){
    if(reduce)return;

    if(!lenis && window.Lenis){
      try{
        lenis=new window.Lenis({
          autoRaf:false,
          smoothWheel:!coarse,
          syncTouch:false,
          lerp:.085,
          anchors:true,
          allowNestedScroll:true
        });
        window.PixelLenis=lenis;
      }catch(_){lenis=null}
    }

    if(lenis && window.gsap && !lenis._v14TickerBound){
      if(fallbackRaf){cancelAnimationFrame(fallbackRaf);fallbackRaf=0}
      window.gsap.ticker.add(function(time){if(lenis)lenis.raf(time*1000)});
      window.gsap.ticker.lagSmoothing(0);
      lenis._v14TickerBound=true;
    }

    if(window.gsap && !window.__PIXEL_V14_GSAP_STARTED__){
      window.__PIXEL_V14_GSAP_STARTED__=true;
      var g=window.gsap;

      if(window.ScrollTrigger){
        g.registerPlugin(window.ScrollTrigger);
        if(lenis)lenis.on('scroll',function(){window.ScrollTrigger.update()});
      }

      if($('.landing-hero')){
        g.timeline({defaults:{ease:'power3.out'}})
          .fromTo('.hero-kicker',{y:8,opacity:.4},{y:0,opacity:1,duration:.34})
          .fromTo('.hero-copy h1',{y:16,filter:'blur(5px)'},{y:0,filter:'blur(0px)',duration:.55},'-.2')
          .fromTo('.hero-preview-wrap',{y:12,opacity:.88},{y:0,opacity:1,duration:.55},'-.44');
      }

      if(window.ScrollTrigger){
        g.from('.compact-features article',{
          scrollTrigger:{trigger:'.compact-features',start:'top 86%'},
          y:24,opacity:0,stagger:.08,duration:.5,ease:'power3.out'
        });
        g.from('.memory-tile',{
          scrollTrigger:{trigger:'.memory-strip',start:'top 84%'},
          y:30,opacity:0,stagger:{each:.07,from:'random'},duration:.58,ease:'power3.out'
        });
      }
    }

    lastScreenId=null;
    syncScreen();
    window.PixelV14.lenis=!!lenis;
    window.PixelV14.gsap=!!window.gsap;
    window.PixelV14.scrollTrigger=!!window.ScrollTrigger;
  }

  var v14LocalHost=/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname);
  if(!v14LocalHost && !reduce){
    var lenisPromise=v14LoadScript(
      'https://unpkg.com/lenis@1.3.26/dist/lenis.min.js',
      function(){return !!window.Lenis}
    );
    var gsapPromise=v14LoadScript(
      'https://cdn.jsdelivr.net/npm/gsap@3.15/dist/gsap.min.js',
      function(){return !!window.gsap}
    );
    Promise.all([lenisPromise,gsapPromise]).then(function(){
      if(!window.gsap)return false;
      return v14LoadScript(
        'https://cdn.jsdelivr.net/npm/gsap@3.15/dist/ScrollTrigger.min.js',
        function(){return !!window.ScrollTrigger}
      );
    }).then(v14UpgradeWithLibraries).catch(function(){});
  }

  window.addEventListener('beforeunload',function(){
    if(fallbackRaf)cancelAnimationFrame(fallbackRaf);
  },{once:true});
})();
