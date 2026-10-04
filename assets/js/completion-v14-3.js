/* V14.3 completion layer
   Keepsake export parity + small interaction/accessibility completion pass. */
(() => {
  const byId = id => document.getElementById(id);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

  if (window.PixelV14) window.PixelV14.version = '14.3';
  window.PixelV143 = { version:'14.3', keepsake:'white-embossed-paper', complete:true };

  function roundRect(ctx,x,y,w,h,r){
    if (ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); return; }
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
  }

  function wrapCentered(ctx,text,x,y,maxWidth,lineHeight,maxLines=4){
    const chars=[...String(text||'')];
    const lines=[];let line='';
    for(const ch of chars){
      const test=line+ch;
      if(ctx.measureText(test).width>maxWidth && line){lines.push(line);line=ch}
      else line=test;
    }
    if(line) lines.push(line);
    const out=lines.slice(0,maxLines);
    if(lines.length>maxLines && out.length){
      let last=out[out.length-1];
      while(last && ctx.measureText(last+'…').width>maxWidth) last=last.slice(0,-1);
      out[out.length-1]=last+'…';
    }
    out.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));
    return out.length;
  }

  function seeded(seed){
    let s=seed>>>0;
    return () => ((s=Math.imul(1664525,s)+1013904223>>>0)/4294967296);
  }

  function embossLine(ctx,draw){
    ctx.save();
    ctx.lineWidth=2;
    ctx.strokeStyle='rgba(91,96,101,.10)';
    ctx.translate(1,1);draw(ctx);ctx.stroke();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.lineWidth=2;
    ctx.strokeStyle='rgba(255,255,255,.92)';
    ctx.translate(-1,-1);draw(ctx);ctx.stroke();
    ctx.restore();
  }

  function drawLeafSprig(ctx,x,y,sx=1,sy=1){
    const path=c=>{
      c.beginPath();
      c.moveTo(x,y);
      c.bezierCurveTo(x+26*sx,y+18*sy,x+43*sx,y+42*sy,x+58*sx,y+74*sy);
      c.moveTo(x+18*sx,y+18*sy);c.quadraticCurveTo(x+35*sx,y+7*sy,x+42*sx,y+26*sy);c.quadraticCurveTo(x+26*sx,y+31*sy,x+18*sx,y+18*sy);
      c.moveTo(x+33*sx,y+39*sy);c.quadraticCurveTo(x+52*sx,y+28*sy,x+57*sx,y+48*sy);c.quadraticCurveTo(x+43*sx,y+54*sy,x+33*sx,y+39*sy);
      c.moveTo(x+45*sx,y+59*sy);c.quadraticCurveTo(x+62*sx,y+52*sy,x+67*sx,y+70*sy);c.quadraticCurveTo(x+54*sx,y+76*sy,x+45*sx,y+59*sy);
    };
    embossLine(ctx,path);
  }

  function exportKeepsake(){
    if (typeof state === 'undefined') return;
    const c=document.createElement('canvas');
    c.width=1080;c.height=1350;
    const g=c.getContext('2d');
    const W=c.width,H=c.height;
    const card={x:58,y:54,w:964,h:1240,r:40};

    g.fillStyle='#ecebea';g.fillRect(0,0,W,H);

    g.save();
    g.shadowColor='rgba(38,42,46,.18)';g.shadowBlur=44;g.shadowOffsetY=24;
    roundRect(g,card.x,card.y,card.w,card.h,card.r);
    const paper=g.createLinearGradient(card.x,card.y,card.x+card.w,card.y+card.h);
    paper.addColorStop(0,'#ffffff');paper.addColorStop(.46,'#fbfaf7');paper.addColorStop(1,'#f3f2ee');
    g.fillStyle=paper;g.fill();g.restore();

    g.save();roundRect(g,card.x,card.y,card.w,card.h,card.r);g.clip();

    /* subtle fibre/noise */
    const rnd=seeded(14303);
    for(let i=0;i<1800;i++){
      const x=card.x+rnd()*card.w,y=card.y+rnd()*card.h;
      const a=.012+rnd()*.022;
      g.fillStyle=rnd()>.48?`rgba(74,79,84,${a})`:`rgba(255,255,255,${a*2.2})`;
      g.fillRect(x,y,1+rnd()*1.2,.6+rnd()*.8);
    }

    g.strokeStyle='rgba(83,88,93,.07)';g.lineWidth=2;
    roundRect(g,card.x+22,card.y+22,card.w-44,card.h-44,22);g.stroke();
    g.strokeStyle='rgba(255,255,255,.86)';g.lineWidth=2;
    roundRect(g,card.x+20,card.y+20,card.w-40,card.h-40,23);g.stroke();

    drawLeafSprig(g,card.x+62,card.y+62,1,1);
    drawLeafSprig(g,card.x+card.w-62,card.y+62,-1,1);
    drawLeafSprig(g,card.x+62,card.y+card.h-62,1,-1);
    drawLeafSprig(g,card.x+card.w-62,card.y+card.h-62,-1,-1);

    /* embossed medallion */
    g.beginPath();g.arc(W/2,132,34,0,Math.PI*2);
    g.fillStyle='#f7f6f3';g.fill();
    g.strokeStyle='rgba(87,92,97,.10)';g.lineWidth=3;g.stroke();
    g.beginPath();g.arc(W/2-1,131,33,0,Math.PI*2);
    g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=2;g.stroke();
    g.fillStyle='#9b9fa2';g.font='25px Georgia';g.textAlign='center';g.textBaseline='middle';g.fillText('✦',W/2,134);

    const centerText=(txt,y,font,color='#343638')=>{
      g.textAlign='center';g.textBaseline='alphabetic';g.font=font;g.fillStyle=color;g.fillText(txt,W/2,y);
    };

    centerText('A NIGHT TO REMEMBER',218,'600 20px ui-monospace,monospace','#898d90');
    const date=state.world.date
      ? new Date(state.world.date+'T00:00').toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})
      : new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
    centerText(date,260,'500 21px sans-serif','#8a8e91');

    const title=(state.world.honoree||'今晚')+'的'+(state.world.occasion||'小小世界');
    g.font='700 62px "Songti SC","STSong","PingFang SC","Microsoft YaHei",serif';
    g.fillStyle='#303235';g.textAlign='center';
    wrapCentered(g,title,W/2,367,760,74,2);

    /* pressed divider */
    embossLine(g,cx=>{
      cx.beginPath();cx.moveTo(W/2-46,438);cx.quadraticCurveTo(W/2,424,W/2+46,438);
    });

    g.font='28px "Songti SC","STSong",serif';
    g.fillStyle='#64686b';g.textAlign='center';g.textBaseline='alphabetic';
    const quote='“'+(state.world.invite||'今晚，我们真的在同一个地方。')+'”';
    wrapCentered(g,quote,W/2,500,730,43,3);

    const people=[...state.players.values()].slice(0,10);
    const count=Math.max(people.length,1),gap=58,start=W/2-((count-1)*gap)/2;
    people.forEach((p,i)=>{
      const x=start+i*gap,y=625;
      g.beginPath();g.arc(x,y,22,0,Math.PI*2);g.fillStyle='#f1f0ed';g.fill();
      g.strokeStyle='rgba(82,87,92,.10)';g.lineWidth=2;g.stroke();
      g.beginPath();g.arc(x-1,y-1,21,0,Math.PI*2);g.strokeStyle='rgba(255,255,255,.94)';g.stroke();
      g.fillStyle='#5f6367';g.font='700 14px sans-serif';g.textAlign='center';g.textBaseline='middle';
      g.fillText((p.name||'友').slice(0,2),x,y+1);
    });

    const stats=[['来过',state.players.size],['留言',state.notes.length],['纪念物',state.mementos.length],['合影',state.photos.length]];
    const sy=753;
    g.strokeStyle='rgba(82,87,92,.10)';g.lineWidth=1;
    g.beginPath();g.moveTo(190,sy-66);g.lineTo(890,sy-66);g.stroke();
    g.strokeStyle='rgba(255,255,255,.92)';
    g.beginPath();g.moveTo(190,sy-64);g.lineTo(890,sy-64);g.stroke();
    stats.forEach((s,i)=>{
      const x=225+i*210;
      if(i>0){
        const gx=x-105;
        const gr=g.createLinearGradient(gx,sy-40,gx,sy+62);
        gr.addColorStop(0,'rgba(82,87,92,0)');gr.addColorStop(.5,'rgba(82,87,92,.10)');gr.addColorStop(1,'rgba(82,87,92,0)');
        g.strokeStyle=gr;g.beginPath();g.moveTo(gx,sy-40);g.lineTo(gx,sy+62);g.stroke();
      }
      g.fillStyle='#3d4043';g.font='500 46px Georgia';g.textAlign='center';g.textBaseline='alphabetic';g.fillText(String(s[1]),x,sy);
      g.fillStyle='#94979a';g.font='500 18px sans-serif';g.fillText(s[0],x,sy+40);
    });

    const last=state.notes.length
      ? '“'+(state.notes[state.notes.length-1].text||'')+'” — '+(state.notes[state.notes.length-1].by||'')
      : '这里还在等第一句话。';
    roundRect(g,185,842,710,138,18);
    g.fillStyle='rgba(238,237,233,.58)';g.fill();
    g.strokeStyle='rgba(255,255,255,.82)';g.lineWidth=2;g.stroke();
    g.font='24px "Songti SC","STSong",serif';g.fillStyle='#696d70';g.textAlign='center';g.textBaseline='alphabetic';
    wrapCentered(g,last,W/2,895,640,36,3);

    g.strokeStyle='rgba(82,87,92,.08)';g.lineWidth=1;
    g.beginPath();g.moveTo(185,1054);g.lineTo(895,1054);g.stroke();

    centerText('ROOM · '+(state.roomCode||'------'),1112,'500 17px ui-monospace,monospace','#9a9da0');
    centerText('小小世界 · Pixel Memory',1160,'500 18px sans-serif','#9a9da0');
    centerText('把这一晚，留成可以再打开的一张纸。',1214,'400 19px "Songti SC","STSong",serif','#a0a3a6');

    g.restore();

    const a=document.createElement('a');
    a.download=`pixel-memory-${state.roomCode||'keepsake'}.png`;
    a.href=c.toDataURL('image/png',1);
    a.click();
    if (typeof toast==='function') toast('白色压纹纪念卡已保存');
  }

  function installKeepsakeExport(){
    const btn=byId('saveKeepsakeBtn');
    if(btn) btn.onclick=exportKeepsake;
  }

  function closeTopLayerOnEscape(e){
    if(e.key!=='Escape') return;
    const keep=byId('keepsakeOverlay');
    const celeb=byId('celebrationOverlay');
    const modal=byId('modal');
    const drawer=byId('roomDrawer');
    const questEditor=byId('questEditor');
    if(keep && !keep.classList.contains('hidden')){
      keep.classList.add('hidden');keep.setAttribute('aria-hidden','true');return;
    }
    if(celeb && !celeb.classList.contains('hidden')){
      celeb.classList.add('hidden');celeb.setAttribute('aria-hidden','true');return;
    }
    if(modal && !modal.classList.contains('hidden')){
      modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');return;
    }
    if(drawer && !drawer.classList.contains('hidden')){
      byId('closeRoomDrawer')?.click();return;
    }
    if(questEditor && !questEditor.classList.contains('hidden')){
      byId('closeQuestEditor')?.click();
    }
  }

  function annotateInteractiveState(){
    document.querySelectorAll('.side-drawer,.quest-editor,.modal').forEach(el=>el.setAttribute('data-polished','14.3'));
    const card=byId('keepsakeCard');
    if(card){
      card.setAttribute('role','img');
      card.setAttribute('aria-label','这一晚的白色压纹纪念卡');
    }
  }

  installKeepsakeExport();
  annotateInteractiveState();
  document.addEventListener('keydown',closeTopLayerOnEscape);
  window.addEventListener('pageshow',installKeepsakeExport);
})();
