/* Pixel Memory World · landing interactions
   Cursor spotlight, subtle parallax, magnetic CTAs and blur-to-focus reveals. */
(function(){
  var landing=document.getElementById('landing');
  if(!landing)return;

  var preview=landing.querySelector('.hero-preview-wrap');
  var room=document.getElementById('heroRoom');
  var prefersReduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse=window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function syncMode(){
    document.body.classList.toggle('landing-mode',landing.classList.contains('active'));
  }
  syncMode();
  new MutationObserver(syncMode).observe(landing,{attributes:true,attributeFilter:['class']});

  if(!prefersReduce && !coarse){
    landing.addEventListener('pointermove',function(e){
      var r=landing.getBoundingClientRect();
      var x=((e.clientX-r.left)/Math.max(r.width,1))*100;
      var y=((e.clientY-r.top)/Math.max(r.height,1))*100;
      landing.style.setProperty('--mx',x.toFixed(2)+'%');
      landing.style.setProperty('--my',y.toFixed(2)+'%');

      if(preview){
        var pr=preview.getBoundingClientRect();
        var nx=((e.clientX-(pr.left+pr.width/2))/Math.max(pr.width,1));
        var ny=((e.clientY-(pr.top+pr.height/2))/Math.max(pr.height,1));
        landing.style.setProperty('--tilt-y',(Math.max(-1,Math.min(1,nx))*2.4).toFixed(2)+'deg');
        landing.style.setProperty('--tilt-x',(Math.max(-1,Math.min(1,-ny))*1.8).toFixed(2)+'deg');
      }
      if(room){
        var rr=room.getBoundingClientRect();
        var rx=((e.clientX-rr.left)/Math.max(rr.width,1))*100;
        var ry=((e.clientY-rr.top)/Math.max(rr.height,1))*100;
        room.style.setProperty('--room-x',Math.max(0,Math.min(100,rx)).toFixed(1)+'%');
        room.style.setProperty('--room-y',Math.max(0,Math.min(100,ry)).toFixed(1)+'%');
      }
    });

    landing.addEventListener('pointerleave',function(){
      landing.style.setProperty('--mx','50%');
      landing.style.setProperty('--my','36%');
      landing.style.setProperty('--tilt-x','0deg');
      landing.style.setProperty('--tilt-y','0deg');
    });

    landing.querySelectorAll('.hero-cta .button').forEach(function(btn){
      btn.classList.add('magnetic');
      btn.addEventListener('pointermove',function(e){
        var r=btn.getBoundingClientRect();
        var dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
        btn.style.setProperty('--bx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');
        btn.style.setProperty('--by',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');
        btn.style.transform='translate('+(dx*.075).toFixed(1)+'px,'+(dy*.12).toFixed(1)+'px)';
      });
      btn.addEventListener('pointerleave',function(){btn.style.transform=''});
    });
  }

  var revealTargets=[
    landing.querySelector('.hero-copy'),
    landing.querySelector('.hero-preview-wrap'),
    landing.querySelector('.compact-features'),
    landing.querySelector('.story-copy'),
    landing.querySelector('.memory-strip')
  ].filter(Boolean);

  revealTargets.forEach(function(el){el.classList.add('landing-reveal')});

  if('IntersectionObserver' in window && !prefersReduce){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
    revealTargets.forEach(function(el){io.observe(el)});
  }else{
    revealTargets.forEach(function(el){el.classList.add('is-visible')});
  }

  // First-frame reveal should not wait for a scroll event.
  requestAnimationFrame(function(){
    revealTargets.slice(0,2).forEach(function(el){el.classList.add('is-visible')});
  });

  // Give the preview a tiny ambient life even before the visitor rings the bell.
  if(room && !prefersReduce){
    var people=Array.from(room.querySelectorAll('.hero-person:not(.arrival)'));
    people.forEach(function(p,i){
      p.animate(
        [{transform:'translateY(0)'},{transform:'translateY('+(i%2?'-2px':'-1px')+')'},{transform:'translateY(0)'}],
        {duration:1900+i*330,iterations:Infinity,easing:'steps(2,end)',delay:i*180}
      );
    });
  }
})();