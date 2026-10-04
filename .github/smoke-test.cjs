const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const base = 'http://127.0.0.1:8787';
  await page.goto(base, { waitUntil: 'networkidle' });

  // V14 progressive visual system must load without breaking the base app.
  await page.waitForTimeout(900);
  const v14Diag = await page.evaluate(() => ({
    pixelV14: window.PixelV14 || null,
    experienceScript: document.querySelector('script[src*="experience-v14.js"]')?.src || null,
    readyState: document.readyState,
    v14Ready: document.body.classList.contains('v14-ready')
  }));
  console.log('V14_DIAG', v14Diag, errors);
  if (v14Diag.pixelV14?.version !== '14.3') throw new Error('V14 bootstrap missing | ' + errors.join(' | '));
  const v14State = await page.evaluate(() => ({
    ready: document.body.classList.contains('v14-ready'),
    ambient: !!document.querySelector('.v14-ambient-canvas'),
    rail: !!document.querySelector('.v14-chapter-rail'),
    pixelWipe: !!document.querySelector('.v14-pixel-wipe'),
    bodyFont: getComputedStyle(document.body).fontFamily,
    flags: window.PixelV14
  }));
  if (!v14State.ready || !v14State.ambient || !v14State.rail || !v14State.pixelWipe) throw new Error('V14 experience layer incomplete');
  if (/Courier New/i.test(v14State.bodyFont)) throw new Error('V14 readable UI font did not override Courier New');
  console.log('V14_FLAGS', v14State.flags);

  // V15.1 P1-P4 systems must be present as real runtime capabilities.
  await page.waitForFunction(() => window.PixelMapRuntime && window.PixelCharacterRuntime);
  await page.evaluate(async () => {
    await window.PixelMapRuntime.ready;
    await window.PixelCharacterRuntime.ready;
  });
  const v15Diag = await page.evaluate(() => ({
    runtime: window.PixelV15 || null,
    sceneVersion: window.PixelSceneMap?.version || null,
    layers: Object.keys(window.PixelSceneMap?.outdoor?.layers || {}),
    mapRuntime: {
      version: window.PixelMapRuntime?.version,
      source: window.PixelMapRuntime?.source,
      collisionCount: window.PixelMapRuntime?.collisionEllipses?.().length || 0,
      pathCount: window.PixelMapRuntime?.pathPoints?.().length || 0
    },
    characterRuntime: {
      version: window.PixelCharacterRuntime?.version,
      mode: window.PixelCharacterRuntime?.mode,
      atlasReady: window.PixelCharacterRuntime?.atlasReady,
      artDirection: window.PixelCharacterRuntime?.artDirection,
      status: window.PixelCharacterRuntime?.manifest?.status,
      actions: Object.keys(window.PixelCharacterRuntime?.manifest?.actions || {}),
      base: window.PixelCharacterRuntime?.manifest?.atlas?.base || ''
    },
    hasSystemsCss: !!document.querySelector('link[href*="systems-v15.css"]'),
    hasSystemsJs: !!document.querySelector('script[src*="systems-v15.js"]'),
    hasEditorApi: !!window.PixelRoomEditor,
    hasActionApi: !!window.PixelCharacterActions,
    retentionVersion: window.PixelRetention?.version || null,
    recoveryVersion: window.PixelRecovery?.version || null
  }));
  console.log('V15_1_DIAG', v15Diag);
  if (v15Diag.runtime?.version !== '15.5') throw new Error('V15.5 systems runtime missing');
  if (v15Diag.retentionVersion !== '15.5' || v15Diag.recoveryVersion !== '15.4') throw new Error('V15.5 retention/recovery runtime missing');
  if (v15Diag.sceneVersion !== '15.0') throw new Error('V15 layered scene map missing');
  if (v15Diag.mapRuntime.source !== 'tiled-json' || v15Diag.mapRuntime.collisionCount < 3 || v15Diag.mapRuntime.pathCount < 6) {
    throw new Error('V15.1 Tiled map runtime did not load canonical JSON');
  }
  if (v15Diag.characterRuntime.version !== '15.2' || v15Diag.characterRuntime.mode !== 'layered-spritesheet') {
    throw new Error('V15.2 character manifest runtime missing');
  }
  if (!v15Diag.characterRuntime.atlasReady || v15Diag.characterRuntime.artDirection !== 'A-warm-keepsake-pixel' || !/warm-v1\/body\.svg/.test(v15Diag.characterRuntime.base)) {
    throw new Error('V15.2 A-style production atlas did not load');
  }
  for (const a of ['idle','walk','sit','wave','hug','celebrate']) {
    if (!v15Diag.characterRuntime.actions.includes(a)) throw new Error('V15.1 character manifest action missing: ' + a);
  }
  for (const layer of ['ground','path','objects','collision','foreground']) {
    if (!v15Diag.layers.includes(layer)) throw new Error('V15 map layer missing: ' + layer);
  }
  if (!v15Diag.hasSystemsCss || !v15Diag.hasSystemsJs || !v15Diag.hasEditorApi || !v15Diag.hasActionApi) {
    throw new Error('V15 systems assets/APIs incomplete');
  }


  // V14.1 layout regression guard: the editorial story panel must stay inside
  // the viewport and typography/order markers must not shrink back to microtext.
  const landingAudit = await page.evaluate(() => {
    const band = document.querySelector('.story-band');
    const bandRect = band.getBoundingClientRect();
    const heading = document.querySelector('.story-copy h2');
    const featureNo = document.querySelector('.feature-icon');
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      left: bandRect.left,
      right: bandRect.right,
      width: bandRect.width,
      headingFont: parseFloat(getComputedStyle(heading).fontSize),
      bodyFont: parseFloat(getComputedStyle(document.querySelector('.story-copy p')).fontSize),
      featureNumberFont: parseFloat(getComputedStyle(featureNo).fontSize)
    };
  });
  console.log('V14_1_LANDING_AUDIT', landingAudit);
  if (landingAudit.left < 18 || landingAudit.right > landingAudit.viewport - 18) {
    throw new Error('story panel is clipped or shifted outside the viewport');
  }
  if (landingAudit.scrollWidth > landingAudit.viewport + 2) {
    throw new Error('landing page has unintended horizontal overflow');
  }
  if (landingAudit.headingFont < 34 || landingAudit.bodyFont < 14 || landingAudit.featureNumberFont < 18) {
    throw new Error('landing typography regressed to undersized text');
  }


  const collageAudit = await page.evaluate(() => {
    const visible = el => {
      const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
      return r.width>12 && r.height>8 && cs.visibility!=='hidden' && cs.display!=='none' && parseFloat(cs.opacity||'1')>.5;
    };
    const ticket=document.querySelector('.memory-ticket b');
    const flower=document.querySelector('.flower-tile');
    const tr=ticket.getBoundingClientRect(),fr=flower.getBoundingClientRect();
    const overlap=Math.max(0,Math.min(tr.right,fr.right)-Math.max(tr.left,fr.left))*Math.max(0,Math.min(tr.bottom,fr.bottom)-Math.max(tr.top,fr.top));
    return {
      letter:visible(document.querySelector('.memory-paper p')),
      letterSign:visible(document.querySelector('.memory-paper small')),
      ticket:visible(ticket),
      ticketMeta:visible(document.querySelector('.memory-ticket small')),
      flowerTitle:visible(document.querySelector('.flower-note b')),
      ticketFlowerOverlap:overlap
    };
  });
  console.log('V14_2_COLLAGE_AUDIT',collageAudit);
  if(!collageAudit.letter||!collageAudit.letterSign||!collageAudit.ticket||!collageAudit.ticketMeta||!collageAudit.flowerTitle) {
    throw new Error('memory collage copy is clipped or hidden');
  }
  if(collageAudit.ticketFlowerOverlap>6) throw new Error('flower souvenir still covers ticket title');

  // V13 control language must still be loaded underneath V14.
  const v13Styles = await page.evaluate(() => {
    const primary = getComputedStyle(document.querySelector('#createWorldBtn'));
    const icon = getComputedStyle(document.querySelector('#globalSoundBtn'));
    return {
      primaryRadius: primary.borderRadius,
      primaryMinHeight: primary.minHeight,
      iconRadius: icon.borderRadius,
      v13Script: !!document.querySelector('script[src*="ui-v13.js"]'),
      v13Css: !!document.querySelector('link[href*="controls-v13.css"]')
    };
  });
  if (!v13Styles.v13Script || !v13Styles.v13Css) throw new Error('V13 assets not loaded');
  if (await page.locator('.avatar-stage-trail').count()) throw new Error('obsolete avatar three-step trail still present');
  if (v13Styles.primaryRadius === '0px' || v13Styles.iconRadius === '0px') throw new Error('V13 rounded control styling missing');

  async function active(id) {
    await page.waitForFunction(id => document.getElementById(id)?.classList.contains('active'), id);
  }

  // Landing core buttons.
  // Doorbell keeps the room preview interactive and exercises the V14 pixel transition.
  await page.locator('#heroDoorbell').click();
  await page.waitForTimeout(120);
  if (!(await page.locator('.v14-pixel-wipe').count())) throw new Error('V14 pixel transition missing');

  await page.locator('#createWorldBtn').click();
  await active('creator');
  const creatorType = await page.evaluate(() => ({
    meta: parseFloat(getComputedStyle(document.querySelector('.creator-preview-meta small')).fontSize),
    field: parseFloat(getComputedStyle(document.querySelector('#creator .field>span')).fontSize),
    marker: parseFloat(getComputedStyle(document.querySelector('#creator .section-head>div>span')).fontSize),
    markerBox: document.querySelector('#creator .section-head>div>span').getBoundingClientRect().width,
    choiceHelp: parseFloat(getComputedStyle(document.querySelector('#creator .choice-card>small')).fontSize)
  }));
  console.log('V14_1_CREATOR_TYPE', creatorType);
  if (creatorType.meta < 9.5 || creatorType.field < 11.5 || creatorType.marker < 11 || creatorType.markerBox < 31 || creatorType.choiceHelp < 10.5) {
    throw new Error('creator typography/order markers are still too small');
  }


  const previewMetaGeometry = await page.evaluate(() => {
    const card=document.querySelector('#creator .creator-preview-meta>span');
    const n=card.querySelector('i').getBoundingClientRect();
    const b=card.querySelector('b').getBoundingClientRect();
    const s=card.querySelector('small').getBoundingClientRect();
    return {numberRight:n.right,labelLeft:b.left,detailLeft:s.left};
  });
  console.log('V14_2_META_GEOMETRY',previewMetaGeometry);
  if(previewMetaGeometry.numberRight > previewMetaGeometry.labelLeft-4 || previewMetaGeometry.numberRight > previewMetaGeometry.detailLeft-4) {
    throw new Error('creator preview number overlaps its text');
  }

  // Creator choices must remain clickable.
  console.log('DIAG before occasion', await page.evaluate(() => ({
    updateCreatorPreview: typeof updateCreatorPreview,
    occasionOnclick: typeof document.querySelector('[data-occasion="纪念日"]')?.onclick,
    createOnclick: typeof document.querySelector('#createWorldBtn')?.onclick
  })), errors);
  await page.locator('[data-occasion="纪念日"]').click();
  const occasionSelected = await page.locator('[data-occasion="纪念日"]').evaluate(el => el.classList.contains('selected'));
  console.log('DIAG after occasion', { occasionSelected, errors });
  if (!occasionSelected) throw new Error('occasion choice did not select | ' + errors.join(' | '));
  await page.locator('[data-theme="garden"]').click();
  if (!(await page.locator('[data-theme="garden"]').evaluate(el => el.classList.contains('selected')))) throw new Error('theme choice did not select');
  await page.locator('[data-music="starlight"]').click();
  if (!(await page.locator('[data-music="starlight"]').evaluate(el => el.classList.contains('selected')))) throw new Error('music choice did not select');

  await page.locator('#honoreeInput').fill('测试主角');
  await page.locator('#continueCreateBtn').click();
  await active('avatarBuilder');
  const avatarLayout = await page.evaluate(() => ({
    trail: !!document.querySelector('.avatar-stage-trail'),
    stageHeight: document.querySelector('.avatar-stage').getBoundingClientRect().height,
    optionType: parseFloat(getComputedStyle(document.querySelector('.avatar-builder-screen .branch-choice>b')).fontSize)
  }));
  if (avatarLayout.trail) throw new Error('obsolete avatar trail is still visible');
  if (avatarLayout.stageHeight > 700) throw new Error('avatar preview stage is still unnecessarily tall');
  if (avatarLayout.optionType < 11) throw new Error('avatar option labels are still too small');

  // Avatar choices + enter room.
  await page.locator('[data-hair="2"]').click();
  await page.locator('[data-outfit="blue"]').click();
  await page.locator('[data-item="📷"]').click();
  await page.waitForFunction(() => document.querySelector('#avatarPreview')?.classList.contains('pm-atlas-ready'));
  const avatarAtlasAudit = await page.evaluate(() => {
    const root=document.querySelector('#avatarPreview');
    const stack=root?.querySelector('.pm-atlas-stack');
    const hair=stack?.querySelector('.pm-atlas-hair');
    const outfit=stack?.querySelector('.pm-atlas-outfit');
    return {
      ready:root?.classList.contains('pm-atlas-ready'),
      layers:stack?.querySelectorAll('.pm-atlas-layer').length||0,
      hair:getComputedStyle(hair).backgroundImage,
      outfit:getComputedStyle(outfit).backgroundImage
    };
  });
  console.log('V15_2_AVATAR_ATLAS', avatarAtlasAudit);
  if(!avatarAtlasAudit.ready||avatarAtlasAudit.layers!==3||!/hair-2\.svg/.test(avatarAtlasAudit.hair)||!/outfit-blue\.svg/.test(avatarAtlasAudit.outfit)) {
    throw new Error('V15.2 DIY preview is not using selected warm atlas variants');
  }
  await page.locator('#playerNameInput').fill('测试玩家');
  await page.locator('#enterWorldBtn').click();
  await active('world');
  await page.waitForSelector('#playersLayer .player', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#playersLayer .player.me')?.classList.contains('pm-atlas-ready'));
  const roomAtlasAudit = await page.evaluate(() => {
    const p=document.querySelector('#playersLayer .player.me');
    const stack=p?.querySelector('.pm-atlas-stack');
    return {
      ready:p?.classList.contains('pm-atlas-ready'),
      outfitClass:p?.className||'',
      layers:stack?.querySelectorAll('.pm-atlas-layer').length||0,
      frame:stack?.dataset.frame||''
    };
  });
  console.log('V15_2_ROOM_ATLAS',roomAtlasAudit);
  if(!roomAtlasAudit.ready||roomAtlasAudit.layers!==3||!/outfit-blue/.test(roomAtlasAudit.outfitClass)) throw new Error('V15.2 room avatar atlas missing');

  // V15 P2: action state is a stable runtime vocabulary and Q triggers wave.
  await page.locator('#worldStage').press('q');
  await page.waitForTimeout(180);
  const actionAudit = await page.evaluate(() => ({
    action: state.player.action,
    domAction: document.querySelector('#playersLayer .player.me')?.dataset.action || '',
    actions: window.PixelCharacterActions?.actions || []
  }));
  console.log('V15_ACTION_AUDIT', actionAudit);
  if (actionAudit.action !== 'wave' || actionAudit.domAction !== 'wave') throw new Error('V15 wave action did not render');
  const waveFrame = await page.locator('#playersLayer .player.me .pm-atlas-stack').getAttribute('data-frame');
  if (Number(waveFrame) < 8 || Number(waveFrame) > 11) throw new Error('V15.2 wave did not switch to atlas wave frames');
  for (const a of ['idle','walk','sit','wave','hug','celebrate']) {
    if (!actionAudit.actions.includes(a)) throw new Error('V15 action vocabulary incomplete: ' + a);
  }

  // V15 P4: the creator device receives a private owner token.
  const ownerAudit = await page.evaluate(() => ({
    room: state.roomCode,
    online: !!window.PixelNet?.enabled,
    owner: !!window.PixelNet?.hasOwnerToken?.(state.roomCode)
  }));
  console.log('V15_OWNER_AUDIT', ownerAudit);
  if (ownerAudit.online && !ownerAudit.owner) throw new Error('V15 creator did not retain owner token');

  await page.evaluate(()=>addActivity('CI identity check'));
  await page.waitForTimeout(80);
  const identityAudit=await page.evaluate(()=>({
    actor:window.PixelIdentity?.actorId||'',
    session:window.PixelIdentity?.sessionId||'',
    stored:localStorage.getItem('pixel-memory-actor-v1')||'',
    hasToken:!!localStorage.getItem('pixel-memory-actor-token-v1'),
    activityAuthor:state.activity.find(x=>x.text==='CI identity check')?.authorId||''
  }));
  console.log('V15_2_IDENTITY_AUDIT',identityAudit);
  if(!identityAudit.actor||identityAudit.actor===identityAudit.session||identityAudit.actor!==identityAudit.stored||!identityAudit.hasToken) throw new Error('V15.3 persistent actor credential missing');
  if(identityAudit.activityAuthor!==identityAudit.actor) throw new Error('V15.2 authored memory is not tagged with actor identity');

  // V15.4 D004=A: export -> clear local credentials -> server-verified import.
  const recoveryAudit=await page.evaluate(async()=>{
    const room=state.roomCode;
    const key=await PixelRecovery.createBundle('owner');
    const parsed=await PixelRecovery.parseKey(key);
    const before={
      owner:PixelNet.getOwnerToken(room),
      actor:PixelNet.getActorCredential()
    };
    PixelNet.saveOwnerToken(room,'');
    PixelNet.setActorCredential('','');
    state.player.actorId='';
    state.player.host=false;
    const cleared={
      owner:PixelNet.hasOwnerToken(room),
      actor:PixelNet.getActorCredential()
    };
    const restored=await PixelRecovery.importKey(key);
    const after={
      owner:PixelNet.getOwnerToken(room),
      actor:PixelNet.getActorCredential(),
      stateActor:state.player.actorId,
      host:state.player.host
    };
    const badOwner=await PixelNet.verifyRecovery(room,{
      ownerToken:'not-the-real-owner-token',
      actorId:after.actor.id,
      actorToken:after.actor.token
    });
    let corruptRejected=false;
    try{
      const bad=key.slice(0,-1)+(key.endsWith('A')?'B':'A');
      await PixelRecovery.importKey(bad);
    }catch(_){corruptRejected=true}
    return {
      keyPrefix:key.slice(0,5),
      kind:parsed.kind,
      roomCode:parsed.roomCode,
      cleared,
      restoredOwner:restored.verified.owner,
      restoredActor:restored.verified.actor,
      ownerSame:before.owner===after.owner,
      actorSame:before.actor.id===after.actor.id&&before.actor.token===after.actor.token,
      stateActorSame:after.stateActor===after.actor.id,
      host:after.host,
      badOwner:badOwner.owner,
      corruptRejected
    };
  });
  console.log('V15_4_RECOVERY_AUDIT',recoveryAudit);
  if(recoveryAudit.keyPrefix!=='PMR1.'||recoveryAudit.kind!=='owner'||recoveryAudit.roomCode!==ownerAudit.room) throw new Error('V15.4 owner recovery bundle malformed');
  if(recoveryAudit.cleared.owner||recoveryAudit.cleared.actor.id||recoveryAudit.cleared.actor.token) throw new Error('V15.4 credential clearing test failed');
  if(!recoveryAudit.restoredOwner||!recoveryAudit.ownerSame||!recoveryAudit.actorSame||!recoveryAudit.stateActorSame||!recoveryAudit.host) throw new Error('V15.4 recovery import did not restore privileges');
  if(recoveryAudit.badOwner!==false) throw new Error('V15.4 recovery verification accepts a wrong owner token');
  if(!recoveryAudit.corruptRejected) throw new Error('V15.4 corrupt recovery key was accepted');

  // V15.5 D005=A: archive -> guest blocked -> owner restore -> permanent purge incl. uploads.
  const lifecycleCode=('R'+Math.random().toString(36).slice(2,7)).toUpperCase();
  const lifecycleCreateRes=await fetch(`${base}/api/rooms`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:lifecycleCode,world:{occasion:'留存测试'},memory:{mementos:[],notes:[],photos:[],activity:[]}})
  });
  if(!lifecycleCreateRes.ok) throw new Error('V15.5 retention room create failed '+lifecycleCreateRes.status);
  const lifecycleRoom=await lifecycleCreateRes.json();
  const lifecycleOwner={'Content-Type':'application/json','X-Room-Owner':lifecycleRoom.ownerToken};
  const uploadForm=new FormData();
  uploadForm.append('file',new Blob(['archive-lifecycle-test'],{type:'text/plain'}),'retention-test.txt');
  const uploadRes=await fetch(`${base}/api/uploads`,{
    method:'POST',
    headers:{'X-Room-Owner':lifecycleRoom.ownerToken,'X-Room-Code':lifecycleCode},
    body:uploadForm
  });
  if(!uploadRes.ok) throw new Error('V15.5 room-scoped upload failed '+uploadRes.status);
  const uploadInfo=await uploadRes.json();
  const beforeArchiveUpload=await fetch(uploadInfo.url);
  if(beforeArchiveUpload.status!==200) throw new Error('V15.5 lifecycle upload is not readable before deletion');

  let lifecycleRes=await fetch(`${base}/api/rooms/${lifecycleCode}/archive`,{
    method:'POST',headers:lifecycleOwner,body:'{}'
  });
  if(lifecycleRes.status!==200) throw new Error('V15.5 owner cannot archive room');
  const archivedData=await lifecycleRes.json();
  const retentionMs=Number(archivedData.meta?.purgeAfter)-Number(archivedData.meta?.archivedAt);
  if(Math.abs(retentionMs-30*24*60*60*1000)>5000) throw new Error('V15.5 archive retention window is not 30 days');

  const guestArchived=await fetch(`${base}/api/rooms/${lifecycleCode}`);
  if(guestArchived.status!==410) throw new Error('V15.5 archived room still allows guest GET');
  const ownerArchived=await fetch(`${base}/api/rooms/${lifecycleCode}`,{headers:{'X-Room-Owner':lifecycleRoom.ownerToken}});
  if(ownerArchived.status!==200) throw new Error('V15.5 owner cannot inspect archived room');
  const archivedOp=await fetch(`${base}/api/rooms/${lifecycleCode}/ops`,{
    method:'POST',headers:lifecycleOwner,
    body:JSON.stringify({scope:'world',op:{patch:{invite:'should not write'}}})
  });
  if(archivedOp.status!==423) throw new Error('V15.5 archived room still accepts mutations');

  lifecycleRes=await fetch(`${base}/api/rooms/${lifecycleCode}/unarchive`,{
    method:'POST',headers:lifecycleOwner,body:'{}'
  });
  if(lifecycleRes.status!==200) throw new Error('V15.5 owner cannot restore archived room');
  const guestRestored=await fetch(`${base}/api/rooms/${lifecycleCode}`);
  if(guestRestored.status!==200) throw new Error('V15.5 restored room is not joinable');

  lifecycleRes=await fetch(`${base}/api/rooms/${lifecycleCode}/archive`,{
    method:'POST',headers:lifecycleOwner,body:'{}'
  });
  if(lifecycleRes.status!==200) throw new Error('V15.5 room cannot be re-archived');

  const badDelete=await fetch(`${base}/api/rooms/${lifecycleCode}/delete-permanently`,{
    method:'POST',headers:lifecycleOwner,
    body:JSON.stringify({confirmCode:'WRONG1',acknowledge:'DELETE_FOREVER'})
  });
  if(badDelete.status!==400) throw new Error('V15.5 permanent deletion does not require exact room-code confirmation');

  const deleteRes=await fetch(`${base}/api/rooms/${lifecycleCode}/delete-permanently`,{
    method:'POST',headers:lifecycleOwner,
    body:JSON.stringify({confirmCode:lifecycleCode,acknowledge:'DELETE_FOREVER'})
  });
  if(deleteRes.status!==200) throw new Error('V15.5 permanent deletion failed');
  const deleteInfo=await deleteRes.json();
  if(deleteInfo.removedUploads<1) throw new Error('V15.5 permanent deletion did not clean room uploads');
  const deletedRoom=await fetch(`${base}/api/rooms/${lifecycleCode}`);
  if(deletedRoom.status!==404) throw new Error('V15.5 permanently deleted room still exists');
  const deletedUpload=await fetch(uploadInfo.url);
  if(deletedUpload.status!==404) throw new Error('V15.5 permanently deleted room upload still exists');
  console.log('V15_5_RETENTION_AUDIT',{room:lifecycleCode,retentionMs,removedUploads:deleteInfo.removedUploads});

  // V15.3 D003=A: real server-side author/host curation permissions.
  const curatorCode=('T'+Math.random().toString(36).slice(2,7)).toUpperCase();
  const curatorCreate=await fetch(`${base}/api/rooms`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:curatorCode,world:{occasion:'测试'},memory:{mementos:[],notes:[],photos:[],activity:[]}})
  });
  if(!curatorCreate.ok) throw new Error('V15.3 curator test room create failed '+curatorCreate.status);
  const curatorRoom=await curatorCreate.json();
  const snapshotBypass=await fetch(`${base}/api/rooms/${curatorCode}`,{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({memory:{mementos:[{id:'bypass'}]}})
  });
  if(snapshotBypass.status!==400) throw new Error('V15.3 legacy snapshot write can bypass memory permissions');
  const guestA={'Content-Type':'application/json','X-Actor-Id':'guest-author-a','X-Actor-Token':'guest-secret-a'};
  const guestB={'Content-Type':'application/json','X-Actor-Id':'guest-intruder-b','X-Actor-Token':'guest-secret-b'};
  const hostH={'Content-Type':'application/json','X-Room-Owner':curatorRoom.ownerToken};
  const opRequest=(scope,op,headers)=>fetch(`${base}/api/rooms/${curatorCode}/ops`,{
    method:'POST',headers,body:JSON.stringify({scope,op})
  });

  let authRes=await opRequest('memory',{kind:'memento:add',item:{id:'guest-memory',authorId:'spoofed',type:'📷',title:'原始标题',meaning:'原始内容',by:'访客A',x:22,y:66,time:Date.now()}},guestA);
  if(authRes.status!==200) throw new Error('V15.3 author could not add memento');
  let authRoom=await fetch(`${base}/api/rooms/${curatorCode}`).then(r=>r.json());
  if(authRoom.memory.mementos[0]?.authorId!=='guest-author-a') throw new Error('V15.3 server did not stamp canonical authorId');

  authRes=await opRequest('memory',{kind:'memento:move',id:'guest-memory',x:44,y:55},guestB);
  if(authRes.status!==403) throw new Error('V15.3 stranger can move another author memento');
  authRes=await opRequest('memory',{kind:'memento:move',id:'guest-memory',x:44,y:55},hostH);
  if(authRes.status!==200) throw new Error('V15.3 host curator cannot move participant memento');
  authRes=await opRequest('memory',{kind:'memento:update',id:'guest-memory',title:'房主不该能改'},hostH);
  if(authRes.status!==403) throw new Error('V15.3 host can rewrite participant memory content');
  authRes=await opRequest('memory',{kind:'memento:update',id:'guest-memory',title:'作者修改后',meaning:'作者自己的修改'},guestA);
  if(authRes.status!==200) throw new Error('V15.3 author cannot edit own memento');
  authRes=await opRequest('memory',{kind:'memento:hide',id:'guest-memory',hidden:true},hostH);
  if(authRes.status!==200) throw new Error('V15.3 host curator cannot hide memento');
  authRes=await opRequest('memory',{kind:'memento:remove',id:'guest-memory'},hostH);
  if(authRes.status!==200) throw new Error('V15.3 host curator cannot remove memento');

  const revData=await fetch(`${base}/api/rooms/${curatorCode}/revisions`,{headers:{'X-Room-Owner':curatorRoom.ownerToken}}).then(r=>r.json());
  const memoryRev=(revData.revisions||[]).find(r=>r.kind==='mementos');
  if(!memoryRev) throw new Error('V15.3 host curation revision missing');
  const restored=await fetch(`${base}/api/rooms/${curatorCode}/revisions/${memoryRev.id}/restore`,{
    method:'POST',headers:{'Content-Type':'application/json','X-Room-Owner':curatorRoom.ownerToken},body:'{}'
  }).then(r=>r.json());
  if(!restored.mementos?.some(m=>m.id==='guest-memory'&&m.authorId==='guest-author-a')) throw new Error('V15.3 curation restore lost author attribution');

  authRes=await opRequest('quest',{kind:'add',item:{id:'guest-quest',authorId:'spoofed',order:1,title:'门外标题',text:'门外内容',by:'访客A',x:30,y:70,time:Date.now()}},guestA);
  if(authRes.status!==200) throw new Error('V15.3 author could not add Outside memory');
  authRes=await opRequest('quest',{kind:'move',id:'guest-quest',x:51,y:61},guestB);
  if(authRes.status!==403) throw new Error('V15.3 stranger can move Outside memory');
  authRes=await opRequest('quest',{kind:'move',id:'guest-quest',x:51,y:61},hostH);
  if(authRes.status!==200) throw new Error('V15.3 host cannot curate Outside memory');
  authRes=await opRequest('quest',{kind:'update',id:'guest-quest',title:'房主改写'},hostH);
  if(authRes.status!==403) throw new Error('V15.3 host can rewrite Outside memory content');
  authRes=await opRequest('quest',{kind:'update',id:'guest-quest',title:'作者改写',text:'作者改写内容'},guestA);
  if(authRes.status!==200) throw new Error('V15.3 author cannot edit own Outside memory');
  console.log('V15_3_CURATOR_AUTH', {room:curatorCode, memoryRevision:memoryRev.id, ok:true});

  // Inject a real guest-authored memento into the active room so the host editor
  // must curate someone else's object, not merely its own.
  const liveGuestHeaders={'Content-Type':'application/json','X-Actor-Id':'live-guest-author','X-Actor-Token':'live-guest-secret'};
  const liveGuestAdd=await fetch(`${base}/api/rooms/${ownerAudit.room}/ops`,{
    method:'POST',headers:liveGuestHeaders,
    body:JSON.stringify({scope:'memory',op:{kind:'memento:add',item:{id:'ci-guest-memento',type:'🌷',title:'访客留下的花',meaning:'给房主整理测试',by:'访客',x:67,y:67,time:Date.now()}}})
  });
  if(liveGuestAdd.status!==200) throw new Error('V15.3 live participant memento injection failed');
  await page.waitForSelector('.memento[data-id="ci-guest-memento"]',{timeout:3000});

  // V13.1 music drawer should be compact, readable and clickable.
  await page.locator('#globalSoundBtn').click();
  await page.waitForFunction(() => document.querySelector('#roomDrawer')?.classList.contains('drawer-music'));
  if (!(await page.locator('.music-now').count())) throw new Error('V13.1 music now-playing block missing');
  const trackFont = await page.locator('.track-button').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  if (trackFont < 11) throw new Error('music track type is still too small');
  await page.locator('#fxBtn').click();
  await page.waitForFunction(() => document.querySelector('#roomDrawer')?.classList.contains('drawer-music'));
  await page.locator('#closeRoomDrawer').click();
  await page.waitForFunction(() => document.querySelector('#roomDrawer')?.classList.contains('hidden'));


  await page.evaluate(() => openKeepsake());
  await page.waitForSelector('#keepsakeOverlay:not(.hidden)');
  const keepsakeAudit = await page.evaluate(() => {
    const card=getComputedStyle(document.querySelector('.keepsake-card'));
    const people=getComputedStyle(document.querySelector('.keepsake-people'));
    const stats=getComputedStyle(document.querySelector('.keepsake-stats'));
    const bgColor=card.backgroundColor.match(/\d+/g)?.map(Number)||[];
    return {
      radius:parseFloat(card.borderRadius),
      align:card.textAlign,
      bg:card.backgroundImage,
      bgColor,
      peopleJustify:people.justifyContent,
      statsLeft:parseFloat(stats.borderLeftWidth),
      statsRight:parseFloat(stats.borderRightWidth),
      completion:window.PixelV143||null,
      completionCss:!!document.querySelector('link[href*="completion-v14-3.css"]'),
      completionScript:!!document.querySelector('script[src*="completion-v14-3.js"]')
    };
  });
  console.log('V14_3_KEEPSAKE_AUDIT',keepsakeAudit);
  if(keepsakeAudit.radius<24||keepsakeAudit.align!=='center'||keepsakeAudit.peopleJustify!=='center') throw new Error('keepsake centered paper layout missing');
  if(!/gradient/i.test(keepsakeAudit.bg)) throw new Error('keepsake paper texture missing');
  if(keepsakeAudit.statsLeft>0||keepsakeAudit.statsRight>0) throw new Error('keepsake stats reverted to boxed cells');
  if(!keepsakeAudit.completionCss||!keepsakeAudit.completionScript||keepsakeAudit.completion?.version!=='14.3') throw new Error('V14.3 completion layer missing');
  if(keepsakeAudit.bgColor.length>=3 && keepsakeAudit.bgColor.slice(0,3).some(v=>v<238)) throw new Error('keepsake is no longer warm-white paper');
  await page.locator('[data-close-keepsake]').last().click();
  await page.waitForFunction(() => document.querySelector('#keepsakeOverlay')?.classList.contains('hidden'));

  // Room controls + V15 P3 owner editor.
  await page.locator('#worldSettingsBtn').click();
  await page.waitForSelector('#roomDrawer:not(.hidden)', { timeout: 3000 });
  await page.waitForSelector('#openRecoveryCenterV15',{timeout:3000});
  await page.waitForSelector('#openRetentionCenterV15',{timeout:3000});
  const recoveryEntry=await page.locator('#recoveryEntryV15').innerText();
  const retentionEntry=await page.locator('#retentionEntryV15').innerText();
  if(!/换设备恢复/.test(recoveryEntry)) throw new Error('V15.4 recovery center entry missing from room settings');
  if(!/30 天/.test(retentionEntry)) throw new Error('V15.5 retention center entry missing from room settings');
  await page.waitForSelector('#startRoomEditorV15', { timeout: 3000 });
  const storageCopy = await page.locator('.pm-storage-state-v15').innerText();
  if (!storageCopy) throw new Error('V15 persistence status missing');

  await page.locator('#startRoomEditorV15').click();
  await page.waitForFunction(() => document.body.classList.contains('pm-room-editing-v15'));
  await page.waitForSelector('.pm-room-editor-toolbar-v15');

  const sofaBox = await page.locator('.room-sofa').boundingBox();
  if (!sofaBox) throw new Error('V15 editable sofa missing');
  await page.mouse.move(sofaBox.x + sofaBox.width/2, sofaBox.y + sofaBox.height/2);
  await page.mouse.down();
  await page.mouse.move(sofaBox.x + sofaBox.width/2 + 42, sofaBox.y + sofaBox.height/2 - 18, {steps:5});
  await page.mouse.up();
  await page.waitForTimeout(280);

  const guestMemento=page.locator('.memento[data-id="ci-guest-memento"]');
  await page.waitForFunction(()=>document.querySelector('.memento[data-id="ci-guest-memento"]')?.hasAttribute('data-curatable-memento'));
  const guestBox=await guestMemento.boundingBox();
  if(!guestBox) throw new Error('V15.3 host editor did not expose participant memento');
  const guestBefore=await page.evaluate(()=>state.mementos.find(m=>m.id==='ci-guest-memento')?.x);
  await page.mouse.move(guestBox.x+guestBox.width/2,guestBox.y+guestBox.height/2);
  await page.mouse.down();
  await page.mouse.move(guestBox.x+guestBox.width/2-55,guestBox.y+guestBox.height/2-24,{steps:6});
  await page.mouse.up();
  await page.waitForTimeout(320);
  const curatorUiAudit=await page.evaluate(async()=>{
    const local=state.mementos.find(m=>m.id==='ci-guest-memento')||null;
    const room=await PixelNet.getRoom(state.roomCode);
    const remote=room.memory?.mementos?.find(m=>m.id==='ci-guest-memento')||null;
    return {
      local,remote,
      manageDisabled:document.querySelector('[data-room-editor-manage]')?.disabled,
      selectedText:document.querySelector('[data-room-editor-manage]')?.textContent||''
    };
  });
  console.log('V15_3_CURATOR_UI',curatorUiAudit);
  if(!curatorUiAudit.local||!curatorUiAudit.remote||Math.abs(curatorUiAudit.local.x-guestBefore)<.5) throw new Error('V15.3 host did not move participant memento');
  if(Math.abs(curatorUiAudit.local.x-curatorUiAudit.remote.x)>.01) throw new Error('V15.3 participant memento move did not persist');
  if(curatorUiAudit.remote.authorId!=='live-guest-author') throw new Error('V15.3 host curation changed participant attribution');
  if(curatorUiAudit.manageDisabled) throw new Error('V15.3 selected participant memento cannot be managed');

  const layoutAudit = await page.evaluate(async () => {
    const local = state.world.layout?.sofa || null;
    let remote = null;
    if (window.PixelNet?.enabled) {
      const room = await PixelNet.getRoom(state.roomCode);
      remote = room.world?.layout?.sofa || null;
    }
    return {local,remote};
  });
  let unauthorizedStatus = 0;
  if (ownerAudit.online) {
    unauthorizedStatus = await fetch(`${base}/api/rooms/${ownerAudit.room}/layout`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({layout:{sofa:{x:1,y:1}}})
    }).then(r=>r.status);
  }
  console.log('V15_LAYOUT_AUDIT', {...layoutAudit,unauthorizedStatus});
  if (!layoutAudit.local) throw new Error('V15 room editor did not update local layout');
  if (ownerAudit.online && !layoutAudit.remote) throw new Error('V15 owner layout did not persist to server');
  if (ownerAudit.online && unauthorizedStatus !== 403) throw new Error('V15 layout endpoint is not owner-protected');

  const historyBeforeUndo = await page.evaluate(() => window.PixelRoomEditor?.historyLength || 0);
  if (historyBeforeUndo < 1) throw new Error('V15.1 editor history was not recorded');
  const movedX = layoutAudit.local.x;
  await page.locator('[data-room-editor-undo]').click();
  await page.waitForTimeout(220);
  const undoAudit = await page.evaluate(() => ({
    sofa: state.world.layout?.sofa || null,
    future: window.PixelRoomEditor?.futureLength || 0
  }));
  console.log('V15_1_UNDO_AUDIT', undoAudit);
  if (undoAudit.sofa && Math.abs(undoAudit.sofa.x - movedX) < .01) throw new Error('V15.1 undo did not change layout');
  if (undoAudit.future < 1) throw new Error('V15.1 redo stack missing');
  await page.locator('[data-room-editor-redo]').click();
  await page.waitForTimeout(220);

  if (ownerAudit.online) {
    const revisionAudit = await page.evaluate(async () => {
      const data = await PixelNet.getRevisions(state.roomCode);
      return {count:(data.revisions||[]).length,first:data.revisions?.[0]||null};
    });
    console.log('V15_1_REVISION_AUDIT', revisionAudit);
    if (revisionAudit.count < 1 || revisionAudit.first?.kind !== 'layout') throw new Error('V15.1 server revision history missing');
  }

  await page.locator('[data-room-editor-done]').click();
  await page.waitForFunction(() => !document.body.classList.contains('pm-room-editing-v15'));

  await page.locator('#worldSettingsBtn').click();
  await page.waitForSelector('#roomDrawer:not(.hidden)', { timeout: 3000 });
  await page.locator('#closeRoomDrawer').click();
  await page.waitForFunction(() => document.querySelector('#roomDrawer')?.classList.contains('hidden'));
  await page.locator('[data-dock="talk"]').click();
  await page.waitForSelector('#talkPopover:not(.hidden)', { timeout: 3000 });
  await page.locator('[data-say="生日快乐 🎂"]').click();
  await page.locator('[data-dock="talk"]').click();

  // Outside must open and return.
  console.log('DIAG before quest', await page.evaluate(() => ({
    screen: typeof state !== 'undefined' ? state.screen : 'no-state',
    openQuestFromRoom: typeof openQuestFromRoom,
    questDoorExists: !!document.querySelector('#questDoor'),
    questActive: document.querySelector('#quest')?.classList.contains('active')
  })), errors);
  await page.locator('#questDoor').click();
  await page.waitForTimeout(1200);
  console.log('DIAG after quest click', await page.evaluate(() => ({
    screen: typeof state !== 'undefined' ? state.screen : 'no-state',
    questActive: document.querySelector('#quest')?.classList.contains('active'),
    worldActive: document.querySelector('#world')?.classList.contains('active'),
    transitionHidden: document.querySelector('#doorTransition')?.classList.contains('hidden')
  })), errors);
  await active('quest');
  await page.waitForSelector('#questPlayerLayer .quest-player', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#questPlayerLayer .quest-player.me')?.classList.contains('pm-atlas-ready'));
  const questAtlasAudit=await page.evaluate(()=>({
    ready:document.querySelector('#questPlayerLayer .quest-player.me')?.classList.contains('pm-atlas-ready'),
    outfitClass:document.querySelector('#questPlayerLayer .quest-player.me')?.className||'',
    layers:document.querySelectorAll('#questPlayerLayer .quest-player.me .pm-atlas-layer').length
  }));
  console.log('V15_2_QUEST_ATLAS',questAtlasAudit);
  if(!questAtlasAudit.ready||questAtlasAudit.layers!==3||!/outfit-blue/.test(questAtlasAudit.outfitClass)) throw new Error('V15.2 Outside avatar atlas missing');
  await page.waitForTimeout(260);
  const cameraAudit = await page.evaluate(() => {
    const stage=document.querySelector('#questStage');
    const world=document.querySelector('.pm-camera-world-v15');
    const sr=stage.getBoundingClientRect();
    const state=window.PixelCameraRuntime?.state||{};
    const center=window.PixelCameraRuntime?.screenToWorldPercent?.(sr.left+sr.width/2,sr.top+sr.height/2)||null;
    return {
      wrapper: !!world,
      active: stage?.classList.contains('pm-camera-active'),
      transform: getComputedStyle(world).transform,
      collisionCount: window.PixelMapRuntime?.collisionEllipses?.().length || 0,
      source: window.PixelMapRuntime?.source || '',
      stageW:sr.width,stageH:sr.height,
      worldW:state.worldW||0,worldH:state.worldH||0,
      center
    };
  });
  console.log('V15_2_CAMERA_AUDIT', cameraAudit);
  if (!cameraAudit.wrapper || !cameraAudit.active || cameraAudit.collisionCount < 3 || cameraAudit.source !== 'tiled-json') throw new Error('V15.2 camera/Tiled collision runtime missing');
  if (cameraAudit.transform === 'none') throw new Error('V15 camera did not transform the quest world');
  if (!(cameraAudit.worldW > cameraAudit.stageW*1.08 || cameraAudit.worldH > cameraAudit.stageH*1.08)) throw new Error('V15.2 Outside world is not actually larger than the viewport');
  if (!cameraAudit.center || cameraAudit.center.x<0 || cameraAudit.center.x>100 || cameraAudit.center.y<0 || cameraAudit.center.y>100) throw new Error('V15.2 camera screen-to-world mapping invalid');

  await page.evaluate(()=>document.querySelector('#questStage').classList.add('placing'));
  await page.waitForTimeout(120);
  const fitAudit=await page.evaluate(()=>({
    fit:document.querySelector('#questStage')?.classList.contains('pm-camera-fit'),
    active:document.querySelector('#questStage')?.classList.contains('pm-camera-active'),
    state:window.PixelCameraRuntime?.state||null
  }));
  console.log('V15_2_CAMERA_FIT',fitAudit);
  if(!fitAudit.fit||fitAudit.active||!fitAudit.state?.fit) throw new Error('V15.2 editor fit-camera mode missing');
  await page.evaluate(()=>document.querySelector('#questStage').classList.remove('placing'));
  await page.waitForTimeout(80);
  if (await page.locator('.quest-signpost,.pm-sign').count()) throw new Error('duplicate memory-road signs still visible');
  if (!(await page.locator('#questFishingSpot').count())) throw new Error('fishing spot missing');
  await page.locator('#returnRoomBtn').click();
  await active('world');

  // Join button must also navigate.
  await page.locator('[data-go="landing"]').first().click();
  await active('landing');
  await page.locator('#joinWorldBtn').click();
  await active('joiner');

  if (errors.length) {
    throw new Error('Browser errors:\n' + errors.join('\n'));
  }

  console.log('SMOKE_OK V15.5 archive retention -> account-free recovery -> A-curator -> participant memory editor -> warm atlas -> tiled camera -> revisions -> join');
  await browser.close();
})().catch(async err => {
  console.error(err);
  process.exit(1);
});