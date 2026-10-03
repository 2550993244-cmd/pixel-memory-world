/* Pixel Memory World V13 · shared control motion
   Framework-free, pointer-safe and reduced-motion aware. */
(function(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const magneticSelector = '.button.primary,.icon-button,.status-chip,.doorbell';
  const pointSelector = '.button,.icon-button,.status-chip,.music-choice,.track-button,.doorbell,.record-button,.quest-upload';

  function decorate(root){
    if(!root || !root.querySelectorAll) return;
    root.querySelectorAll(magneticSelector).forEach(el=>el.classList.add('v13-magnetic'));
  }
  decorate(document);

  const mo = new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType!==1) return;
      if(node.matches?.(magneticSelector)) node.classList.add('v13-magnetic');
      decorate(node);
    }));
  });
  mo.observe(document.body,{childList:true,subtree:true});

  if(fine && !reduce){
    document.addEventListener('pointermove',e=>{
      const el=e.target.closest?.(pointSelector);
      if(!el) return;
      const r=el.getBoundingClientRect();
      if(!r.width || !r.height) return;
      const px=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));
      const py=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));
      el.style.setProperty('--v13-x',px.toFixed(1)+'%');
      el.style.setProperty('--v13-y',py.toFixed(1)+'%');

      if(el.matches(magneticSelector)){
        const dx=(e.clientX-(r.left+r.width/2))/r.width;
        const dy=(e.clientY-(r.top+r.height/2))/r.height;
        el.style.setProperty('--v13-mx',(Math.max(-1,Math.min(1,dx))*5).toFixed(1)+'px');
        el.style.setProperty('--v13-my',(Math.max(-1,Math.min(1,dy))*4).toFixed(1)+'px');
      }
    },{passive:true});

    document.addEventListener('pointerout',e=>{
      const el=e.target.closest?.(magneticSelector);
      if(!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      el.style.setProperty('--v13-mx','0px');
      el.style.setProperty('--v13-my','0px');
    },{passive:true});
  }

  const choiceSelector='[data-occasion],[data-theme],[data-music],[data-hair],[data-outfit],[data-item],[data-track],[data-mtype]';
  document.addEventListener('click',e=>{
    const el=e.target.closest?.(choiceSelector);
    if(!el || reduce) return;
    el.classList.remove('v13-choice-pop');
    void el.offsetWidth;
    el.classList.add('v13-choice-pop');
    setTimeout(()=>el.classList.remove('v13-choice-pop'),280);
  });
})();