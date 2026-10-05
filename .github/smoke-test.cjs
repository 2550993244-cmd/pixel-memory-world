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
    recoveryVersion: window.PixelRecovery?.version || null,
    inviteVersion: window.PixelInvite?.version || null
  }));
  console.log('V15_1_DIAG', v15Diag);
  if (v15Diag.runtime?.version !== '15.18') throw new Error('V15.18 systems runtime missing');
  if (v15Diag.retentionVersion !== '15.5' || v15Diag.recoveryVersion !== '15.7' || v15Diag.inviteVersion !== '15.13') throw new Error('V15.18 invite/retention/recovery runtime missing');
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

  // V15.18 visual QA: the cover should read as a quiet framed keepsake,
  // not a noisy/glassy marketing panel.
  const coverAudit=await page.evaluate(()=>{
    const hero=document.querySelector('.landing-hero');
    const preview=document.querySelector('.hero-preview-wrap');
    const shell=document.querySelector('.hero-scene-shell');
    const noise=document.querySelector('.landing-noise');
    const title=document.querySelector('.hero-copy h1');
    const tip=document.querySelector('.preview-tip');
    const hr=hero.getBoundingClientRect(),pr=preview.getBoundingClientRect();
    const shellStyle=getComputedStyle(shell),noiseStyle=getComputedStyle(noise),titleStyle=getComputedStyle(title);
    return {
      heroWidth:hr.width,
      previewWidth:pr.width,
      shellRadius:parseFloat(shellStyle.borderRadius),
      shellBackground:shellStyle.backgroundImage,
      noiseOpacity:parseFloat(noiseStyle.opacity||'1'),
      titleFont:parseFloat(titleStyle.fontSize),
      tip:tip?.textContent?.trim()||'',
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  console.log('V15_18_COVER_AUDIT',coverAudit);
  if(coverAudit.heroWidth>1290||coverAudit.previewWidth>630||coverAudit.shellRadius<22||coverAudit.noiseOpacity>.08||coverAudit.titleFont<46||coverAudit.overflow>2||!/移动鼠标/.test(coverAudit.tip)){
    throw new Error('V15.18 landing cover cohesion regressed '+JSON.stringify(coverAudit));
  }
  if(!/linear-gradient/i.test(coverAudit.shellBackground)) throw new Error('V15.18 keepsake preview shell lost paper treatment');

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
    try{
      await page.waitForFunction(id => document.getElementById(id)?.classList.contains('active'), id,{timeout:5000});
    }catch(e){
      const diag=await page.evaluate(id=>({
        requested:id,
        stateScreen:window.state?.screen||null,
        active:[...document.querySelectorAll('.screen.active')].map(x=>x.id),
        createOnclick:typeof document.querySelector('#createWorldBtn')?.onclick,
        targetExists:!!document.getElementById(id),
        bodyClasses:document.body.className
      }),id);
      throw new Error('active('+id+') failed '+JSON.stringify(diag)+' | '+errors.join(' | '));
    }
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

  // V15.8 D008=A: viewer is a local-only avatar; owner sees anonymous audience count, not identity/presence.
  const ownerPresenceBefore=await page.evaluate(()=>({
    players:state.players.size,
    onlineText:document.querySelector('#onlineCount')?.textContent||'',
    viewerCount:state.net.viewerCount||0
  }));
  const viewerUrl=await page.evaluate(()=>PixelInvite.shareUrl(state.roomCode,'viewer'));
  const viewerErrors=[];
  const viewerPage=await browser.newPage({viewport:{width:1100,height:800}});
  viewerPage.on('pageerror',e=>viewerErrors.push('PAGEERROR: '+(e.stack||e.message)));
  viewerPage.on('console',m=>{if(m.type()==='error')viewerErrors.push('CONSOLE: '+m.text())});
  await viewerPage.goto(viewerUrl,{waitUntil:'networkidle'});
  await viewerPage.waitForFunction(()=>document.querySelector('#world')?.classList.contains('active'),null,{timeout:5000});
  const instantEntryAudit=await viewerPage.evaluate(()=>({
    screen:state.screen,
    role:state.accessRole,
    name:state.player.name,
    avatarBuilderActive:document.querySelector('#avatarBuilder')?.classList.contains('active')||false,
    localButtonVisible:document.querySelector('#viewerAvatarBtnV15')?.classList.contains('hidden')===false,
    localProfile:JSON.parse(localStorage.getItem('pixel-memory-viewer-avatar-v1')||'null'),
    hair:state.player.hair,outfit:state.player.outfit,item:state.player.item
  }));
  if(instantEntryAudit.screen!=='world'||instantEntryAudit.role!=='viewer'||instantEntryAudit.name!=='我'||instantEntryAudit.avatarBuilderActive||!instantEntryAudit.localButtonVisible) {
    throw new Error('V15.9 viewer did not enter instantly '+JSON.stringify(instantEntryAudit));
  }
  await page.waitForFunction(()=>state.net.viewerCount===1,null,{timeout:5000});
  await page.waitForTimeout(250);
  let spectatorAudit=await page.evaluate(()=>({
    players:state.players.size,
    onlineText:document.querySelector('#onlineCount')?.textContent||'',
    viewerCount:state.net.viewerCount,
    viewerPill:document.querySelector('#viewerPillV15')?.classList.contains('hidden')===false,
    leakedName:[...state.players.values()].some(p=>p.name==='隐形观众测试')
  }));
  if(spectatorAudit.players!==ownerPresenceBefore.players||spectatorAudit.onlineText!==ownerPresenceBefore.onlineText||spectatorAudit.viewerCount!==1||!spectatorAudit.viewerPill||spectatorAudit.leakedName) {
    throw new Error('V15.8 viewer leaked into participant presence '+JSON.stringify(spectatorAudit));
  }

  // Viewer can customize a local-only avatar after entry; owner still learns nothing.
  const ownerBeforeCustomize=await page.evaluate(()=>JSON.stringify([...state.players.values()]));
  await viewerPage.locator('#viewerAvatarBtnV15').click();
  await viewerPage.waitForSelector('#saveViewerAvatarV15',{timeout:3000});
  await viewerPage.locator('[data-viewer-hair="3"]').click();
  await viewerPage.locator('[data-viewer-outfit="sage"]').click();
  await viewerPage.locator('[data-viewer-item="🌷"]').click();
  await viewerPage.locator('#saveViewerAvatarV15').click();
  await viewerPage.waitForTimeout(180);
  const viewerCustomizeAudit=await viewerPage.evaluate(()=>({
    hair:state.player.hair,outfit:state.player.outfit,item:state.player.item,
    stored:JSON.parse(localStorage.getItem('pixel-memory-viewer-avatar-v1')||'null'),
    modalClosed:document.querySelector('#modal')?.classList.contains('hidden')!==false
  }));
  const ownerAfterCustomize=await page.evaluate(()=>JSON.stringify([...state.players.values()]));
  if(viewerCustomizeAudit.hair!=='3'||viewerCustomizeAudit.outfit!=='sage'||viewerCustomizeAudit.item!=='🌷'||viewerCustomizeAudit.stored?.hair!=='3'||viewerCustomizeAudit.stored?.outfit!=='sage'||viewerCustomizeAudit.stored?.item!=='🌷'||ownerAfterCustomize!==ownerBeforeCustomize) {
    throw new Error('V15.9 local-only viewer customization leaked or failed '+JSON.stringify(viewerCustomizeAudit));
  }

    // Server must ignore a forged viewer presence event even if someone bypasses the UI helper.
  await viewerPage.evaluate(()=>{
    state.channel?.postMessage({type:'hello',sender:state.player.id,player:{...state.player,name:'FORGED_VIEWER_LEAK'}});
    window.__ciViewerExtra=PixelNet.createChannel('ci-viewer-second-channel',state.roomCode,state.player.id);
  });
  await page.waitForTimeout(450);
  spectatorAudit=await page.evaluate(()=>({
    players:state.players.size,
    viewerCount:state.net.viewerCount,
    forged:[...state.players.values()].some(p=>p.name==='FORGED_VIEWER_LEAK')
  }));
  if(spectatorAudit.players!==ownerPresenceBefore.players||spectatorAudit.viewerCount!==1||spectatorAudit.forged) {
    throw new Error('V15.8 server-side invisible spectator guard failed '+JSON.stringify(spectatorAudit));
  }
  const viewerLocalAudit=await viewerPage.evaluate(()=>({
    role:state.accessRole,
    viewOnly:isViewOnly(),
    selfVisible:!!document.querySelector('#playersLayer .player.me'),
    participantCount:Number(document.querySelector('#onlineCount')?.textContent||0),
    viewerPillHidden:document.querySelector('#viewerPillV15')?.classList.contains('hidden')!==false
  }));
  if(viewerLocalAudit.role!=='viewer'||!viewerLocalAudit.viewOnly||!viewerLocalAudit.selfVisible||!viewerLocalAudit.viewerPillHidden) {
    throw new Error('V15.8 viewer local exploration UI failed '+JSON.stringify(viewerLocalAudit));
  }
  await viewerPage.evaluate(()=>window.__ciViewerExtra?.close?.());
  await viewerPage.close();
  await page.waitForFunction(()=>state.net.viewerCount===0,null,{timeout:5000});
  const spectatorClosed=await page.evaluate(()=>({
    viewerCount:state.net.viewerCount,
    pillHidden:document.querySelector('#viewerPillV15')?.classList.contains('hidden')!==false,
    players:state.players.size
  }));
  console.log('V15_9_INSTANT_SPECTATOR_AUDIT',{instantEntryAudit,open:spectatorAudit,viewerLocalAudit,viewerCustomizeAudit,closed:spectatorClosed,errors:viewerErrors});
  if(spectatorClosed.viewerCount!==0||!spectatorClosed.pillHidden||spectatorClosed.players!==ownerPresenceBefore.players||viewerErrors.length) {
    throw new Error('V15.8 spectator cleanup failed '+JSON.stringify({spectatorClosed,viewerErrors}));
  }

  // V15.10 D010=A: contributor must deliberately create a visible identity before entering.
  const contributorUrl=await page.evaluate(()=>PixelInvite.shareUrl(state.roomCode,'contributor'));
  const contributorErrors=[];
  const contributorPage=await browser.newPage({viewport:{width:1100,height:800}});
  contributorPage.on('pageerror',e=>contributorErrors.push('PAGEERROR: '+(e.stack||e.message)));
  contributorPage.on('console',m=>{if(m.type()==='error')contributorErrors.push('CONSOLE: '+m.text())});
  await contributorPage.goto(contributorUrl,{waitUntil:'networkidle'});
  await contributorPage.waitForFunction(()=>document.querySelector('#avatarBuilder')?.classList.contains('active'),null,{timeout:5000});
  const contributorEntryAudit=await contributorPage.evaluate(()=>({
    role:state.accessRole,
    screen:state.screen,
    worldActive:document.querySelector('#world')?.classList.contains('active')||false,
    noteVisible:document.querySelector('#contributorIdentityNoteV15')?.classList.contains('hidden')===false,
    noteText:document.querySelector('#contributorIdentityNoteV15')?.innerText||'',
    nameVisible:!!document.querySelector('#playerNameInput')?.offsetParent
  }));
  if(contributorEntryAudit.role!=='contributor'||contributorEntryAudit.screen!=='avatarBuilder'||contributorEntryAudit.worldActive||!contributorEntryAudit.noteVisible||!/作者身份/.test(contributorEntryAudit.noteText)||!contributorEntryAudit.nameVisible) {
    throw new Error('V15.10 contributor skipped ceremonial avatar setup '+JSON.stringify(contributorEntryAudit));
  }
  await contributorPage.locator('#playerNameInput').fill('参与者测试');
  await contributorPage.locator('[data-hair="3"]').click();
  await contributorPage.locator('[data-outfit="butter"]').click();
  await contributorPage.locator('[data-item="🎈"]').click();
  await contributorPage.locator('#enterWorldBtn').click();
  await contributorPage.waitForFunction(()=>document.querySelector('#world')?.classList.contains('active'),null,{timeout:5000});
  await page.waitForFunction(()=>[...state.players.values()].some(p=>p.name==='参与者测试'),null,{timeout:5000});
  const contributorVisibleAudit=await page.evaluate(()=>{
    const p=[...state.players.values()].find(p=>p.name==='参与者测试');
    return p?{name:p.name,hair:p.hair,outfit:p.outfit,item:p.item,actorId:p.actorId||''}:null;
  });
  if(!contributorVisibleAudit||contributorVisibleAudit.hair!=='3'||contributorVisibleAudit.outfit!=='butter'||contributorVisibleAudit.item!=='🎈'||contributorVisibleAudit.actorId) {
    throw new Error('V15.14 contributor appearance did not propagate privately '+JSON.stringify(contributorVisibleAudit));
  }

  // V15.12 D012=A: contributor can change visible appearance live, but current visit name stays fixed.
  const contributorAvatarButtonAudit=await contributorPage.evaluate(()=>({
    visible:document.querySelector('#viewerAvatarBtnV15')?.classList.contains('hidden')===false,
    label:document.querySelector('#viewerAvatarBtnV15')?.innerText||'',
    name:state.player.name
  }));
  if(!contributorAvatarButtonAudit.visible||contributorAvatarButtonAudit.name!=='参与者测试') {
    throw new Error('V15.12 contributor in-room avatar control missing '+JSON.stringify(contributorAvatarButtonAudit));
  }
  await contributorPage.locator('#viewerAvatarBtnV15').click();
  await contributorPage.waitForSelector('#saveContributorAvatarV15',{timeout:3000});
  const contributorEditorAudit=await contributorPage.evaluate(()=>({
    title:document.querySelector('#modal')?.innerText||'',
    hasNameInput:!!document.querySelector('#modal input[type="text"], #modal #playerNameInput'),
    playerName:state.player.name
  }));
  if(contributorEditorAudit.hasNameInput||contributorEditorAudit.playerName!=='参与者测试'||!/名字这次保持不变/.test(contributorEditorAudit.title)) {
    throw new Error('V15.12 contributor editor allows current-visit rename '+JSON.stringify(contributorEditorAudit));
  }
  await contributorPage.locator('[data-contributor-hair="2"]').click();
  await contributorPage.locator('[data-contributor-outfit="blue"]').click();
  await contributorPage.locator('[data-contributor-item="📷"]').click();
  await contributorPage.locator('#saveContributorAvatarV15').click();
  await page.waitForFunction(()=>{
    const p=[...state.players.values()].find(p=>p.name==='参与者测试');
    return !!p&&p.hair==='2'&&p.outfit==='blue'&&p.item==='📷';
  },null,{timeout:5000});
  const liveAppearanceAudit=await page.evaluate(()=>{
    const p=[...state.players.values()].find(p=>p.name==='参与者测试');
    return p?{name:p.name,hair:p.hair,outfit:p.outfit,item:p.item}:null;
  });
  const contributorStoredProfile=await contributorPage.evaluate(()=>{
    const key=Object.keys(localStorage).find(k=>k.startsWith('pixel-memory-contributor-profile-v1:'));
    return key?JSON.parse(localStorage.getItem(key)||'null'):null;
  });
  if(!liveAppearanceAudit||liveAppearanceAudit.name!=='参与者测试'||liveAppearanceAudit.hair!=='2'||liveAppearanceAudit.outfit!=='blue'||liveAppearanceAudit.item!=='📷'||contributorStoredProfile?.name!=='参与者测试'||contributorStoredProfile?.hair!=='2'||contributorStoredProfile?.outfit!=='blue'||contributorStoredProfile?.item!=='📷') {
    throw new Error('V15.12 live contributor appearance did not sync/persist '+JSON.stringify({liveAppearanceAudit,contributorStoredProfile}));
  }

  // V15.13 D013=A: create a memory under the first visible name.
  await contributorPage.evaluate(()=>openNoteModal());
  await contributorPage.locator('#noteText').fill('旧名留言');
  await contributorPage.locator('#saveNoteBtn').click();
  await page.waitForFunction(()=>state.notes.some(n=>n.text==='旧名留言'),null,{timeout:5000});
  const oldNameNote=await page.evaluate(()=>state.notes.find(n=>n.text==='旧名留言'));
  if(oldNameNote?.authorName!=='参与者测试'||oldNameNote?.by!=='参与者测试'||Object.prototype.hasOwnProperty.call(oldNameNote||{},'authorId')||oldNameNote?.isAuthor===true) {
    throw new Error('V15.14 public room leaked author linkage on first snapshot '+JSON.stringify(oldNameNote));
  }

  await contributorPage.evaluate(()=>broadcast('leave'));
  await page.waitForFunction(()=>![...state.players.values()].some(p=>p.name==='参与者测试'),null,{timeout:5000});

  // V15.11 D011=A: same actor returns to the full builder with prior visible profile prefilled.
  await contributorPage.goto(contributorUrl,{waitUntil:'networkidle'});
  await contributorPage.waitForFunction(()=>document.querySelector('#avatarBuilder')?.classList.contains('active'),null,{timeout:5000});
  const returningContributorAudit=await contributorPage.evaluate(()=>({
    screen:state.screen,
    worldActive:document.querySelector('#world')?.classList.contains('active')||false,
    name:document.querySelector('#playerNameInput')?.value||'',
    hair:document.querySelector('[data-hair].selected')?.dataset.hair||'',
    outfit:document.querySelector('[data-outfit].selected')?.dataset.outfit||'',
    item:document.querySelector('[data-item].selected')?.dataset.item||'',
    remembered:document.querySelector('#contributorIdentityNoteV15')?.classList.contains('returning')||false,
    noteText:document.querySelector('#contributorIdentityNoteV15')?.innerText||'',
    profileKeys:Object.keys(localStorage).filter(k=>k.startsWith('pixel-memory-contributor-profile-v1:'))
  }));
  if(returningContributorAudit.screen!=='avatarBuilder'||returningContributorAudit.worldActive||returningContributorAudit.name!=='参与者测试'||returningContributorAudit.hair!=='2'||returningContributorAudit.outfit!=='blue'||returningContributorAudit.item!=='📷'||!returningContributorAudit.remembered||!/记得你/.test(returningContributorAudit.noteText)||returningContributorAudit.profileKeys.length!==1) {
    throw new Error('V15.11 returning contributor profile was not prefilled '+JSON.stringify(returningContributorAudit));
  }
  const ownerBeforeReturningConfirm=await page.evaluate(()=>[...state.players.values()].some(p=>p.name==='参与者测试'));
  if(ownerBeforeReturningConfirm)throw new Error('V15.11 returning contributor became visible before confirming builder');

  await contributorPage.locator('#playerNameInput').fill('Lynn测试');
  await contributorPage.locator('#enterWorldBtn').click();
  await contributorPage.waitForFunction(()=>document.querySelector('#world')?.classList.contains('active'),null,{timeout:5000});
  await page.waitForFunction(()=>[...state.players.values()].some(p=>p.name==='Lynn测试'),null,{timeout:5000});
  await contributorPage.evaluate(()=>openNoteModal());
  await contributorPage.locator('#noteText').fill('新名留言');
  await contributorPage.locator('#saveNoteBtn').click();
  await page.waitForFunction(()=>state.notes.some(n=>n.text==='新名留言'),null,{timeout:5000});

  const historicalNameAudit=await page.evaluate(()=>{
    const oldNote=state.notes.find(n=>n.text==='旧名留言');
    const newNote=state.notes.find(n=>n.text==='新名留言');
    openNotesDrawer();
    const view=n=>n?{authorName:n.authorName,by:n.by,hasAuthorId:Object.prototype.hasOwnProperty.call(n,'authorId'),isAuthor:n.isAuthor===true}:null;
    return {oldNote:view(oldNote),newNote:view(newNote),drawerText:document.querySelector('#drawerBody')?.innerText||''};
  });
  const selfOwnershipAudit=await contributorPage.evaluate(async()=>{
    const room=await PixelNet.getRoom(state.roomCode);
    const oldNote=room.memory.notes.find(n=>n.text==='旧名留言');
    const newNote=room.memory.notes.find(n=>n.text==='新名留言');
    const view=n=>n?{authorName:n.authorName,by:n.by,hasAuthorId:Object.prototype.hasOwnProperty.call(n,'authorId'),isAuthor:n.isAuthor===true}:null;
    return {oldNote:view(oldNote),newNote:view(newNote)};
  });
  if(!historicalNameAudit.oldNote||!historicalNameAudit.newNote||
     historicalNameAudit.oldNote.hasAuthorId||historicalNameAudit.newNote.hasAuthorId||
     historicalNameAudit.oldNote.isAuthor||historicalNameAudit.newNote.isAuthor||
     historicalNameAudit.oldNote.authorName!=='参与者测试'||
     historicalNameAudit.newNote.authorName!=='Lynn测试'||
     historicalNameAudit.oldNote.by!=='参与者测试'||
     historicalNameAudit.newNote.by!=='Lynn测试'||
     !historicalNameAudit.drawerText.includes('参与者测试')||
     !historicalNameAudit.drawerText.includes('Lynn测试')||
     !selfOwnershipAudit.oldNote?.isAuthor||!selfOwnershipAudit.newNote?.isAuthor||
     selfOwnershipAudit.oldNote?.hasAuthorId||selfOwnershipAudit.newNote?.hasAuthorId) {
    throw new Error('V15.14 private alias linkage failed '+JSON.stringify({historicalNameAudit,selfOwnershipAudit}));
  }

  // V15.15 D015/D016/D018=A: private continuity drawer + author edit/delete controls + light edited marker.
  await contributorPage.evaluate(async()=>{
    const old=state.notes.find(n=>n.text==='旧名留言');
    if(!old)throw new Error('old note missing before V15.15 continuity audit');
    await commitMemoryOp({kind:'note:update',id:old.id,text:'旧名留言（修订）'});
    await new Promise(r=>setTimeout(r,120));
  });

  // V15.17 D025-D029=A: add a real older-year authored memory for search/collapse/export coverage.
  await contributorPage.evaluate(async()=>{
    const item={id:'v17-old-year-note',authorId:state.player.actorId,authorName:state.player.name,by:state.player.name,text:'跨年旅行回忆 · 海边散步',time:Date.now()-400*24*60*60*1000};
    await commitMemoryOp({kind:'note:add',item});
  });

  // V15.16 D020-D024=A: author-centric entry points, undo, recovery shortcut, filters and private timeline.
  await contributorPage.evaluate(()=>openContributorAvatarCustomizer());
  await contributorPage.waitForSelector('#openMyTracesFromAvatarV16',{timeout:3000});
  const avatarContinuityAudit=await contributorPage.evaluate(()=>({
    traces:document.querySelector('#openMyTracesFromAvatarV16')?.innerText||'',
    recovery:document.querySelector('#openIdentityRecoveryFromAvatarV16')?.innerText||''
  }));
  if(!/我留下的/.test(avatarContinuityAudit.traces)||!/换设备继续/.test(avatarContinuityAudit.recovery)){
    throw new Error('V15.16 contributor avatar continuity shortcuts missing '+JSON.stringify(avatarContinuityAudit));
  }
  await contributorPage.locator('#openMyTracesFromAvatarV16').click();
  await contributorPage.waitForSelector('#myTraceRecoveryV16',{timeout:3000});

  const privateTraceAudit=await contributorPage.evaluate(()=>({
    drawerText:document.querySelector('#drawerBody')?.innerText||'',
    noteEditButtons:document.querySelectorAll('[data-my-note-edit]').length,
    noteDeleteButtons:document.querySelectorAll('[data-my-note-delete]').length,
    title:document.querySelector('#drawerTitle')?.textContent||'',
    typeFilters:document.querySelectorAll('[data-trace-type-v16]').length,
    years:[...document.querySelectorAll('.trace-year-label-v16 b')].map(x=>x.textContent),
    names:[...document.querySelectorAll('#myTraceNameFilterV16 option')].map(x=>x.textContent),
    cards:document.querySelectorAll('.trace-card-v16').length
  }));
  if(privateTraceAudit.title!=='我留下的'||
     !privateTraceAudit.drawerText.includes('PRIVATE TIMELINE')||
     !privateTraceAudit.drawerText.includes('参与者测试')||
     !privateTraceAudit.drawerText.includes('Lynn测试')||
     !privateTraceAudit.drawerText.includes('旧名留言（修订）')||
     !privateTraceAudit.drawerText.includes('新名留言')||
     !privateTraceAudit.drawerText.includes('已编辑')||
     privateTraceAudit.noteEditButtons<2||privateTraceAudit.noteDeleteButtons<2||
     privateTraceAudit.typeFilters!==5||privateTraceAudit.cards<2||
     !privateTraceAudit.years.includes(String(new Date().getFullYear()))||
     !privateTraceAudit.names.includes('参与者测试')||!privateTraceAudit.names.includes('Lynn测试')){
    throw new Error('V15.16 private timeline / filters failed '+JSON.stringify(privateTraceAudit));
  }

  const yearCollapseAudit=await contributorPage.evaluate(()=>{
    const sections=[...document.querySelectorAll('[data-trace-year-section-v17]')];
    return {
      count:sections.length,
      states:sections.map(s=>({
        year:s.dataset.traceYearSectionV17,
        expanded:s.querySelector('[data-trace-year-toggle-v17]')?.getAttribute('aria-expanded'),
        hidden:s.querySelector('.trace-year-list-v16')?.classList.contains('hidden')
      }))
    };
  });
  if(yearCollapseAudit.count<2||yearCollapseAudit.states[0]?.expanded!=='true'||yearCollapseAudit.states.slice(1).some(x=>x.expanded!=='false'||!x.hidden)){
    throw new Error('V15.17 older years are not collapsed by default '+JSON.stringify(yearCollapseAudit));
  }

  await contributorPage.locator('#myTraceSearchV17').fill('跨年旅行');
  await contributorPage.locator('#myTraceSearchBtnV17').click();
  await contributorPage.waitForFunction(()=>document.querySelectorAll('.trace-card-v16').length===1);
  const searchAudit=await contributorPage.evaluate(()=>({
    text:document.querySelector('#drawerBody')?.innerText||'',
    cards:document.querySelectorAll('.trace-card-v16').length,
    open:[...document.querySelectorAll('[data-trace-year-toggle-v17]')].every(x=>x.getAttribute('aria-expanded')==='true')
  }));
  if(searchAudit.cards!==1||!searchAudit.text.includes('跨年旅行回忆')||!searchAudit.open) throw new Error('V15.17 private search did not surface/expand match '+JSON.stringify(searchAudit));
  await contributorPage.locator('#myTraceClearSearchV17').click();
  await contributorPage.waitForFunction(()=>document.querySelectorAll('.trace-card-v16').length>=3);

  const exportAudit=await contributorPage.evaluate(()=>{
    const html=PixelAuthorContinuityV17.buildExport([{
      kind:'note',label:'留言',ts:Date.now(),item:{text:'导出安全测试',authorName:'Lynn测试',authorId:'actor-secret-v17',actorToken:'token-secret-v17'}
    }]);
    return {
      version:PixelAuthorContinuityV17.version,
      hasMemory:html.includes('导出安全测试')&&html.includes('Lynn测试'),
      leaksActor:html.includes('actor-secret-v17')||html.includes('authorId'),
      leaksToken:html.includes('token-secret-v17')||html.includes('actorToken')
    };
  });
  if(exportAudit.version!=='15.17'||!exportAudit.hasMemory||exportAudit.leaksActor||exportAudit.leaksToken) throw new Error('V15.17 private export safety failed '+JSON.stringify(exportAudit));

  await contributorPage.locator('[data-trace-type-v16="note"]').click();
  await contributorPage.waitForFunction(()=>document.querySelectorAll('.trace-card-v16').length>=3);
  await contributorPage.selectOption('#myTraceNameFilterV16',{label:'参与者测试'});
  await contributorPage.waitForFunction(()=>{
    const text=document.querySelector('#drawerBody')?.innerText||'';
    return text.includes('旧名留言（修订）')&&!text.includes('新名留言');
  });
  const filteredTraceAudit=await contributorPage.evaluate(()=>({
    text:document.querySelector('#drawerBody')?.innerText||'',
    selected:document.querySelector('#myTraceNameFilterV16')?.value||'',
    resetVisible:!!document.querySelector('#myTraceResetFiltersV17')
  }));
  if(filteredTraceAudit.selected!=='参与者测试'||!filteredTraceAudit.text.includes('旧名留言（修订）')||filteredTraceAudit.text.includes('新名留言')||!filteredTraceAudit.resetVisible) throw new Error('V15.17 historical-name filtering failed '+JSON.stringify(filteredTraceAudit));
  await contributorPage.locator('#myTraceResetFiltersV17').click();
  await contributorPage.waitForFunction(()=>document.querySelectorAll('.trace-card-v16').length>=3&&document.querySelector('#myTraceNameFilterV16')?.value==='all');
  const resetFilterAudit=await contributorPage.evaluate(()=>({
    search:document.querySelector('#myTraceSearchV17')?.value||'',
    selectedName:document.querySelector('#myTraceNameFilterV16')?.value||'',
    activeTypes:document.querySelectorAll('[data-trace-type-v16].selected').length,
    allSelected:document.querySelector('[data-trace-type-v16="all"]')?.classList.contains('selected')||false
  }));
  if(resetFilterAudit.search||resetFilterAudit.selectedName!=='all'||resetFilterAudit.activeTypes!==1||!resetFilterAudit.allSelected) throw new Error('V15.17 filter reset failed '+JSON.stringify(resetFilterAudit));

  await contributorPage.locator('#myTraceRecoveryV16').click();
  await contributorPage.waitForSelector('#copyIdentityRecovery',{timeout:3000});
  const recoveryShortcutAudit=await contributorPage.evaluate(()=>({
    title:document.querySelector('#modalTitle')?.textContent||'',
    hasIdentity:!!document.querySelector('#copyIdentityRecovery'),
    hasImport:!!document.querySelector('#importRecoveryText')
  }));
  if(!recoveryShortcutAudit.hasIdentity||!recoveryShortcutAudit.hasImport||!/换设备/.test(recoveryShortcutAudit.title)) throw new Error('V15.16 author recovery shortcut failed '+JSON.stringify(recoveryShortcutAudit));
  await contributorPage.evaluate(()=>closeModal());

  const undoTargetId=await contributorPage.evaluate(()=>state.notes.find(n=>n.text==='新名留言')?.id||'');
  if(!undoTargetId)throw new Error('V15.16 undo target note missing');
  await contributorPage.evaluate(async(id)=>{
    const n=state.notes.find(x=>x.id===id);
    const oldConfirm=window.confirm;window.confirm=()=>true;
    try{await removeOwnNote(n,openMyTracesDrawer)}finally{window.confirm=oldConfirm}
  },undoTargetId);
  await contributorPage.waitForFunction(id=>!state.notes.some(n=>n.id===id),undoTargetId,{timeout:3000});
  await contributorPage.waitForSelector('#toast .toast-undo-v16',{timeout:3000});
  await contributorPage.locator('#toast .toast-undo-v16').click();
  await contributorPage.waitForFunction(id=>state.notes.some(n=>n.id===id&&n.text==='新名留言'),undoTargetId,{timeout:3000});
  const deleteUndoAudit=await contributorPage.evaluate(id=>({
    restored:state.notes.some(n=>n.id===id&&n.text==='新名留言'),
    toast:document.querySelector('#toast')?.innerText||''
  }),undoTargetId);
  if(!deleteUndoAudit.restored)throw new Error('V15.16 delete undo did not restore authored note '+JSON.stringify(deleteUndoAudit));
  const recoveryReminderAudit=await contributorPage.evaluate(async()=>{
    const key='pixel-memory-author-recovery-reminder-v17:'+state.player.actorId;
    localStorage.removeItem(key);
    PixelAuthorContinuityV17.remind();
    await new Promise(r=>setTimeout(r,2450));
    const first={
      marked:localStorage.getItem(key)==='shown',
      action:document.querySelector('#toast .toast-undo-v16')?.textContent||'',
      actionable:document.querySelector('#toast')?.classList.contains('has-action-v16')||false
    };
    toast('提醒测试已完成');
    PixelAuthorContinuityV17.remind();
    await new Promise(r=>setTimeout(r,120));
    const secondAction=document.querySelector('#toast')?.classList.contains('has-action-v16')||false;
    return {first,secondAction};
  });
  if(!recoveryReminderAudit.first.marked||!/保存身份钥匙/.test(recoveryReminderAudit.first.action)||!recoveryReminderAudit.first.actionable||recoveryReminderAudit.secondAction){
    throw new Error('V15.17 one-time recovery reminder failed '+JSON.stringify(recoveryReminderAudit));
  }

  console.log('V15_17_PRIVATE_ARCHIVE_AUDIT',{avatarContinuityAudit,privateTraceAudit,yearCollapseAudit,searchAudit,exportAudit,filteredTraceAudit,resetFilterAudit,recoveryShortcutAudit,deleteUndoAudit,recoveryReminderAudit});
  await contributorPage.evaluate(()=>broadcast('leave'));
  await page.waitForFunction(()=>![...state.players.values()].some(p=>p.name==='Lynn测试'),null,{timeout:5000});
  await contributorPage.close();
  console.log('V15_14_ALIAS_PRIVACY_AUDIT',{entry:contributorEntryAudit,live:liveAppearanceAudit,returning:returningContributorAudit,historical:historicalNameAudit,self:selfOwnershipAudit,errors:contributorErrors});
  if(contributorErrors.length)throw new Error('V15.13 contributor page errors '+JSON.stringify(contributorErrors));

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

  // V15.7 D007=B: independently rotatable collaborative + view-only links.
  const inviteCode=('I'+Math.random().toString(36).slice(2,7)).toUpperCase();
  const inviteCreateRes=await fetch(`${base}/api/rooms`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:inviteCode,world:{occasion:'双邀请测试'},memory:{mementos:[],notes:[],photos:[],activity:[]}})
  });
  if(!inviteCreateRes.ok) throw new Error('V15.7 invite room create failed '+inviteCreateRes.status);
  const inviteRoom=await inviteCreateRes.json();
  if(!inviteRoom.inviteToken||inviteRoom.inviteToken.length<24||!inviteRoom.viewInviteToken||inviteRoom.viewInviteToken.length<24) throw new Error('V15.7 dual invite tokens missing');
  if(inviteRoom.inviteToken===inviteRoom.viewInviteToken) throw new Error('V15.7 invite roles share the same token');

  let inviteRes=await fetch(`${base}/api/rooms/${inviteCode}`);
  if(inviteRes.status!==404) throw new Error('V15.7 room code alone opens protected room');

  inviteRes=await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':inviteRoom.inviteToken}});
  if(inviteRes.status!==200) throw new Error('V15.7 contributor invite cannot read room');
  const contributorRoom=await inviteRes.json();
  if(contributorRoom.accessRole!=='contributor') throw new Error('V15.7 contributor role not identified');

  inviteRes=await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':inviteRoom.viewInviteToken}});
  if(inviteRes.status!==200) throw new Error('V15.7 viewer invite cannot read room');
  const viewerRoom=await inviteRes.json();
  if(viewerRoom.accessRole!=='viewer') throw new Error('V15.7 viewer role not identified');
  if(viewerRoom.inviteHash||viewerRoom.viewInviteHash||viewerRoom.inviteToken||viewerRoom.viewInviteToken) throw new Error('V15.7 invite secrets leaked in room payload');

  const viewerActor={'Content-Type':'application/json','X-Room-Invite':inviteRoom.viewInviteToken,'X-Actor-Id':'viewer-a','X-Actor-Token':'viewer-secret'};
  inviteRes=await fetch(`${base}/api/rooms/${inviteCode}/ops`,{
    method:'POST',headers:viewerActor,
    body:JSON.stringify({scope:'memory',op:{kind:'note:add',item:{id:'viewer-note',text:'must fail',by:'viewer',time:Date.now()}}})
  });
  if(inviteRes.status!==403) throw new Error('V15.7 viewer invite can write memories');
  const viewerErr=await inviteRes.json();
  if(viewerErr.error!=='view_only') throw new Error('V15.7 viewer write rejection is not role-aware');

  const contributorActor={'Content-Type':'application/json','X-Room-Invite':inviteRoom.inviteToken,'X-Actor-Id':'contributor-a','X-Actor-Token':'contributor-secret'};
  inviteRes=await fetch(`${base}/api/rooms/${inviteCode}/ops`,{
    method:'POST',headers:contributorActor,
    body:JSON.stringify({scope:'memory',op:{kind:'note:add',item:{id:'contrib-note',text:'allowed',by:'contributor',time:Date.now()}}})
  });
  if(inviteRes.status!==200) throw new Error('V15.7 contributor invite cannot write');

  inviteRes=await fetch(`${base}/api/rooms/${inviteCode}/ops`,{
    method:'POST',headers:contributorActor,
    body:JSON.stringify({scope:'memory',op:{kind:'note:add',item:{id:'contrib-note',authorName:'替换名',by:'替换名',text:'replayed',time:Date.now()}}})
  });
  if(inviteRes.status!==200) throw new Error('V15.13 duplicate authored add request failed unexpectedly');
  const immutableRoom=await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':inviteRoom.inviteToken}}).then(r=>r.json());
  const immutableNote=immutableRoom.memory.notes.find(n=>n.id==='contrib-note');
  const selfImmutableRoom=await fetch(`${base}/api/rooms/${inviteCode}`,{headers:contributorActor}).then(r=>r.json());
  const selfImmutableNote=selfImmutableRoom.memory.notes.find(n=>n.id==='contrib-note');
  if(immutableNote?.authorName!=='contributor'||immutableNote?.by!=='contributor'||Object.prototype.hasOwnProperty.call(immutableNote||{},'authorId')||immutableNote?.isAuthor===true||
     selfImmutableNote?.authorName!=='contributor'||!selfImmutableNote?.isAuthor||Object.prototype.hasOwnProperty.call(selfImmutableNote||{},'authorId')) {
    throw new Error('V15.14 historical author privacy/immutability failed '+JSON.stringify({public:immutableNote,self:selfImmutableNote}));
  }

  const viewerUpload=new FormData();
  viewerUpload.append('file',new Blob(['viewer upload should fail'],{type:'text/plain'}),'viewer.txt');
  inviteRes=await fetch(`${base}/api/uploads`,{
    method:'POST',headers:{'X-Room-Code':inviteCode,'X-Room-Invite':inviteRoom.viewInviteToken,'X-Actor-Id':'viewer-a','X-Actor-Token':'viewer-secret'},body:viewerUpload
  });
  if(inviteRes.status!==403) throw new Error('V15.7 viewer invite can upload');

  const oldContributor=inviteRoom.inviteToken;
  const oldViewer=inviteRoom.viewInviteToken;
  let rotateRes=await fetch(`${base}/api/rooms/${inviteCode}/invite/viewer/rotate`,{
    method:'POST',headers:{'Content-Type':'application/json','X-Room-Owner':inviteRoom.ownerToken},body:'{}'
  });
  if(rotateRes.status!==200) throw new Error('V15.7 owner cannot rotate viewer invite');
  const viewerRotated=await rotateRes.json();
  if(!viewerRotated.viewInviteToken||viewerRotated.viewInviteToken===oldViewer) throw new Error('V15.7 viewer rotation failed');
  if((await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':oldViewer}})).status!==404) throw new Error('V15.7 old viewer invite still works');
  if((await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':viewerRotated.viewInviteToken}})).status!==200) throw new Error('V15.7 new viewer invite fails');
  if((await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':oldContributor}})).status!==200) throw new Error('V15.7 viewer rotation broke contributor invite');

  rotateRes=await fetch(`${base}/api/rooms/${inviteCode}/invite/contributor/rotate`,{
    method:'POST',headers:{'Content-Type':'application/json','X-Room-Owner':inviteRoom.ownerToken},body:'{}'
  });
  if(rotateRes.status!==200) throw new Error('V15.7 owner cannot rotate contributor invite');
  const contributorRotated=await rotateRes.json();
  if(!contributorRotated.inviteToken||contributorRotated.inviteToken===oldContributor) throw new Error('V15.7 contributor rotation failed');
  if((await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':oldContributor}})).status!==404) throw new Error('V15.7 old contributor invite still works');
  if((await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':contributorRotated.inviteToken}})).status!==200) throw new Error('V15.7 new contributor invite fails');
  if((await fetch(`${base}/api/rooms/${inviteCode}`,{headers:{'X-Room-Invite':viewerRotated.viewInviteToken}})).status!==200) throw new Error('V15.7 contributor rotation broke viewer invite');
  console.log('V15_7_DUAL_INVITE_AUDIT',{room:inviteCode,contributorVersion:contributorRotated.inviteVersion,viewerVersion:viewerRotated.viewInviteVersion,ok:true});

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

  const guestArchived=await fetch(`${base}/api/rooms/${lifecycleCode}`,{headers:{'X-Room-Invite':lifecycleRoom.inviteToken}});
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
  const guestRestored=await fetch(`${base}/api/rooms/${lifecycleCode}`,{headers:{'X-Room-Invite':lifecycleRoom.inviteToken}});
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
    method:'PUT',headers:{'Content-Type':'application/json','X-Room-Invite':curatorRoom.inviteToken},
    body:JSON.stringify({memory:{mementos:[{id:'bypass'}]}})
  });
  if(snapshotBypass.status!==400) throw new Error('V15.3 legacy snapshot write can bypass memory permissions');
  const guestA={'Content-Type':'application/json','X-Room-Invite':curatorRoom.inviteToken,'X-Actor-Id':'guest-author-a','X-Actor-Token':'guest-secret-a'};
  const guestB={'Content-Type':'application/json','X-Room-Invite':curatorRoom.inviteToken,'X-Actor-Id':'guest-intruder-b','X-Actor-Token':'guest-secret-b'};
  const hostH={'Content-Type':'application/json','X-Room-Owner':curatorRoom.ownerToken};
  const opRequest=(scope,op,headers)=>fetch(`${base}/api/rooms/${curatorCode}/ops`,{
    method:'POST',headers,body:JSON.stringify({scope,op})
  });

  let authRes=await opRequest('memory',{kind:'memento:add',item:{id:'guest-memory',authorId:'spoofed',authorHair:'3',authorOutfit:'blue',authorItem:'🎁',authorAvatar:{hair:'3'},type:'📷',title:'原始标题',meaning:'原始内容',by:'访客A',x:22,y:66,time:Date.now()}},guestA);
  if(authRes.status!==200) throw new Error('V15.3 author could not add memento');
  let authRoom=await fetch(`${base}/api/rooms/${curatorCode}`,{headers:{'X-Room-Invite':curatorRoom.inviteToken}}).then(r=>r.json());
  const publicGuestMemory=authRoom.memory.mementos.find(m=>m.id==='guest-memory');
  const authorRoom=await fetch(`${base}/api/rooms/${curatorCode}`,{headers:guestA}).then(r=>r.json());
  const selfGuestMemory=authorRoom.memory.mementos.find(m=>m.id==='guest-memory');
  if(!publicGuestMemory||Object.prototype.hasOwnProperty.call(publicGuestMemory,'authorId')||publicGuestMemory.isAuthor===true||!selfGuestMemory?.isAuthor||Object.prototype.hasOwnProperty.call(selfGuestMemory||{},'authorId')) throw new Error('V15.14 author identity leaked or private ownership missing');
  if(['authorHair','authorOutfit','authorItem','authorAvatar','authorAppearance','authorSprite'].some(k=>Object.prototype.hasOwnProperty.call(selfGuestMemory||{},k))) throw new Error('V15.15 historical avatar snapshot was not stripped');

  authRes=await opRequest('memory',{kind:'memento:move',id:'guest-memory',x:44,y:55},guestB);
  if(authRes.status!==403) throw new Error('V15.3 stranger can move another author memento');
  authRes=await opRequest('memory',{kind:'memento:move',id:'guest-memory',x:44,y:55},hostH);
  if(authRes.status!==200) throw new Error('V15.3 host curator cannot move participant memento');
  authRes=await opRequest('memory',{kind:'memento:update',id:'guest-memory',title:'房主不该能改'},hostH);
  if(authRes.status!==403) throw new Error('V15.3 host can rewrite participant memory content');
  authRes=await opRequest('memory',{kind:'memento:update',id:'guest-memory',title:'同名冒领',authorName:'访客A',by:'访客A'},guestB);
  if(authRes.status!==403) throw new Error('V15.15 same display name can reclaim another author memory');
  authRes=await opRequest('memory',{kind:'memento:update',id:'guest-memory',title:'作者修改后',meaning:'作者自己的修改'},guestA);
  if(authRes.status!==200) throw new Error('V15.3 author cannot edit own memento');
  const editedMemoryRoom=await fetch(`${base}/api/rooms/${curatorCode}`,{headers:{'X-Room-Invite':curatorRoom.inviteToken}}).then(r=>r.json());
  const editedMemory=editedMemoryRoom.memory.mementos.find(m=>m.id==='guest-memory');
  if(!editedMemory?.editedAt) throw new Error('V15.15 edited memento marker missing');
  authRes=await opRequest('memory',{kind:'note:add',item:{id:'guest-note',text:'原始留言',by:'访客A',time:Date.now()}},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author cannot add note for control audit');
  authRes=await opRequest('memory',{kind:'note:update',id:'guest-note',text:'同名冒领留言',authorName:'访客A',by:'访客A'},guestB);
  if(authRes.status!==403) throw new Error('V15.15 same-name actor can edit old note');
  authRes=await opRequest('memory',{kind:'note:update',id:'guest-note',text:'作者修订留言'},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author cannot edit own note');
  const editedNoteRoom=await fetch(`${base}/api/rooms/${curatorCode}`,{headers:guestA}).then(r=>r.json());
  const editedNote=editedNoteRoom.memory.notes.find(n=>n.id==='guest-note');
  if(!editedNote?.editedAt||editedNote.text!=='作者修订留言'||!editedNote.isAuthor) throw new Error('V15.15 note edit marker/ownership missing');
  authRes=await opRequest('memory',{kind:'note:remove',id:'guest-note'},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author cannot delete own note');

  authRes=await opRequest('memory',{kind:'photo:add',item:{id:'guest-photo',names:['访客A'],by:'访客A',time:Date.now()}},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author cannot add photo for delete audit');
  authRes=await opRequest('memory',{kind:'photo:remove',id:'guest-photo'},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author cannot delete own photo');

  authRes=await opRequest('memory',{kind:'memento:add',item:{id:'guest-memory-delete',type:'🌷',title:'作者可删',meaning:'删除权测试',by:'访客A',x:18,y:64,time:Date.now()}},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author delete memento setup failed');
  authRes=await opRequest('memory',{kind:'memento:remove',id:'guest-memory-delete'},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author cannot delete own memento');

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
  if(!restored.mementos?.some(m=>m.id==='guest-memory'&&m.authorName==='访客A'&&!Object.prototype.hasOwnProperty.call(m,'authorId'))) throw new Error('V15.14 curation restore lost public attribution or leaked authorId');

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
  const editedQuestRoom=await fetch(`${base}/api/rooms/${curatorCode}`,{headers:guestA}).then(r=>r.json());
  const editedQuest=editedQuestRoom.quest.items.find(q=>q.id==='guest-quest');
  if(!editedQuest?.editedAt||!editedQuest.isAuthor) throw new Error('V15.15 Outside edited marker/ownership missing');
  authRes=await opRequest('quest',{kind:'remove',id:'guest-quest'},guestA);
  if(authRes.status!==200) throw new Error('V15.15 author cannot delete own Outside memory');
  const postAuthorDeleteRevisions=await fetch(`${base}/api/rooms/${curatorCode}/revisions`,{headers:{'X-Room-Owner':curatorRoom.ownerToken}}).then(r=>r.json());
  if(!(postAuthorDeleteRevisions.revisions||[]).some(r=>r.kind==='quest')||!(postAuthorDeleteRevisions.revisions||[]).some(r=>r.kind==='mementos')) throw new Error('V15.15 author deletes did not leave recoverable host revisions');
  console.log('V15_15_AUTHOR_CONTINUITY_AUTH', {room:curatorCode, memoryRevision:memoryRev.id, ok:true});

  // Inject a real guest-authored memento into the active room so the host editor
  // must curate someone else's object, not merely its own.
  const liveGuestHeaders={'Content-Type':'application/json','X-Room-Invite':await page.evaluate(()=>PixelNet.getInviteToken(state.roomCode)),'X-Actor-Id':'live-guest-author','X-Actor-Token':'live-guest-secret'};
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
  await page.waitForSelector('#openInviteCenterV15',{timeout:3000});
  const recoveryEntry=await page.locator('#recoveryEntryV15').innerText();
  const retentionEntry=await page.locator('#retentionEntryV15').innerText();
  const inviteEntry=await page.locator('#inviteEntryV15').innerText();
  const shareUrlAudit=await page.evaluate(async()=>({
    contributor:await PixelInvite.shareUrl(state.roomCode,'contributor'),
    viewer:await PixelInvite.shareUrl(state.roomCode,'viewer')
  }));
  if(!/换设备恢复/.test(recoveryEntry)) throw new Error('V15.4 recovery center entry missing from room settings');
  if(!/30 天/.test(retentionEntry)) throw new Error('V15.5 retention center entry missing from room settings');
  if(!/秘密邀请/.test(inviteEntry)) throw new Error('V15.6 secret invite center missing from room settings');
  if(!/[?&]invite=/.test(shareUrlAudit.contributor)||!/[?&]room=/.test(shareUrlAudit.contributor)||/[?&]role=view/.test(shareUrlAudit.contributor)) throw new Error('V15.7 contributor share URL malformed');
  if(!/[?&]invite=/.test(shareUrlAudit.viewer)||!/[?&]room=/.test(shareUrlAudit.viewer)||!/[?&]role=view/.test(shareUrlAudit.viewer)) throw new Error('V15.7 viewer share URL malformed');
  const viewUiAudit=await page.evaluate(()=>{
    const before=state.notes.length;
    applyAccessMode('viewer');
    const blocked=memoryOp({kind:'note:add',item:{id:'ui-viewer-note',text:'no',by:'viewer',time:Date.now()}});
    openMusicDrawer();
    const audit={
      viewOnly:isViewOnly(),
      blocked,
      notesUnchanged:state.notes.length===before,
      noteHidden:document.querySelector('[data-dock="note"]')?.classList.contains('hidden'),
      settingsHidden:document.querySelector('#worldSettingsBtn')?.classList.contains('hidden'),
      questModeHidden:document.querySelector('#questModeBtn')?.classList.contains('hidden'),
      musicReadOnly:/VIEW ONLY/.test(document.querySelector('#drawerBody')?.innerText||'')
    };
    applyAccessMode('owner');
    closeDrawer();
    return audit;
  });
  console.log('V15_7_VIEW_UI_AUDIT',viewUiAudit);
  if(!viewUiAudit.viewOnly||viewUiAudit.blocked!==false||!viewUiAudit.notesUnchanged||!viewUiAudit.noteHidden||!viewUiAudit.settingsHidden||!viewUiAudit.questModeHidden||!viewUiAudit.musicReadOnly) throw new Error('V15.7 view-only UI/local write guard incomplete');
  await page.locator('#worldSettingsBtn').click();
  await page.waitForSelector('#roomDrawer:not(.hidden)', { timeout: 3000 });
  await page.waitForSelector('#startRoomEditorV15', { timeout: 3000 });
  const storageCopy = await page.locator('.pm-storage-state-v15').innerText();
  if (!storageCopy) throw new Error('V15 persistence status missing');

  await page.locator('#startRoomEditorV15').click();
  await page.waitForFunction(() => document.body.classList.contains('pm-room-editing-v15'));
  await page.waitForSelector('.pm-room-editor-toolbar-v15');

  const editorVisualAudit=await page.evaluate(()=>{
    const stage=document.querySelector('#worldStage');
    const halo=document.querySelector('.pm-editor-drop-halo-v18');
    const pseudo=getComputedStyle(stage,'::after');
    const hs=getComputedStyle(halo);
    return {
      promptLeft:pseudo.left,
      promptTop:pseudo.top,
      promptRadius:pseudo.borderRadius,
      promptBackground:pseudo.backgroundColor,
      haloExists:!!halo,
      haloOpacity:parseFloat(hs.opacity||'0'),
      haloZ:Number.parseFloat(hs.zIndex)||0
    };
  });
  console.log('V15_18_EDITOR_VISUAL_IDLE',editorVisualAudit);
  if(!editorVisualAudit.haloExists||editorVisualAudit.promptLeft==='50%'||parseFloat(editorVisualAudit.promptRadius)>14||editorVisualAudit.haloOpacity>.05){
    throw new Error('V15.18 editor still uses the centered white selection treatment '+JSON.stringify(editorVisualAudit));
  }

  const sofaBox = await page.locator('.room-sofa').boundingBox();
  if (!sofaBox) throw new Error('V15 editable sofa missing');
  await page.mouse.move(sofaBox.x + sofaBox.width/2, sofaBox.y + sofaBox.height/2);
  await page.mouse.down();
  await page.mouse.move(sofaBox.x + sofaBox.width/2 + 42, sofaBox.y + sofaBox.height/2 - 18, {steps:5});
  const dragHaloAudit=await page.evaluate(()=>{
    const halo=document.querySelector('.pm-editor-drop-halo-v18');
    const sofa=document.querySelector('.room-sofa');
    const h=getComputedStyle(halo),sr=sofa.getBoundingClientRect(),hr=halo.getBoundingClientRect();
    return {
      opacity:parseFloat(h.opacity||'0'),
      width:hr.width,height:hr.height,
      haloZ:Number.parseFloat(h.zIndex)||0,
      sofaZ:Number.parseFloat(getComputedStyle(sofa).zIndex)||0,
      left:parseFloat(halo.style.left)||0,
      top:parseFloat(halo.style.top)||0
    };
  });
  console.log('V15_18_EDITOR_DROP_HALO',dragHaloAudit);
  if(dragHaloAudit.opacity<.8||dragHaloAudit.width<60||dragHaloAudit.height>40||dragHaloAudit.haloZ>=dragHaloAudit.sofaZ||dragHaloAudit.left<=4||dragHaloAudit.top<=10){
    throw new Error('V15.18 grounded furniture drop halo failed '+JSON.stringify(dragHaloAudit));
  }
  await page.mouse.up();
  await page.waitForTimeout(180);
  const haloAfterDrop=await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.pm-editor-drop-halo-v18')).opacity||'1'));
  if(haloAfterDrop>.05) throw new Error('V15.18 furniture drop halo remains visible after placement');
  await page.waitForTimeout(100);

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
  if(Object.prototype.hasOwnProperty.call(curatorUiAudit.remote,'authorId')||curatorUiAudit.remote.authorName!=='访客') throw new Error('V15.14 curator UI leaked stable author identity or lost display attribution');
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
    const stageStyle=getComputedStyle(stage),worldStyle=getComputedStyle(world);
    const horizon=document.querySelector('.pm-horizon-layer');
    return {
      wrapper: !!world,
      active: stage?.classList.contains('pm-camera-active'),
      transform: worldStyle.transform,
      collisionCount: window.PixelMapRuntime?.collisionEllipses?.().length || 0,
      source: window.PixelMapRuntime?.source || '',
      stageW:sr.width,stageH:sr.height,
      worldW:state.worldW||0,worldH:state.worldH||0,
      center,
      stageBackgroundColor:stageStyle.backgroundColor,
      stageBackgroundImage:stageStyle.backgroundImage,
      worldBackgroundImage:worldStyle.backgroundImage,
      horizonInsideWorld:!!horizon?.closest('.pm-camera-world-v15'),
      horizonHeight:horizon?parseFloat(getComputedStyle(horizon).height):0
    };
  });
  console.log('V15_2_CAMERA_AUDIT', cameraAudit);
  if (!cameraAudit.wrapper || !cameraAudit.active || cameraAudit.collisionCount < 3 || cameraAudit.source !== 'tiled-json') throw new Error('V15.2 camera/Tiled collision runtime missing');
  if (cameraAudit.transform === 'none') throw new Error('V15 camera did not transform the quest world');
  if (!(cameraAudit.worldW > cameraAudit.stageW*1.08 || cameraAudit.worldH > cameraAudit.stageH*1.08)) throw new Error('V15.2 Outside world is not actually larger than the viewport');
  if (!cameraAudit.center || cameraAudit.center.x<0 || cameraAudit.center.x>100 || cameraAudit.center.y<0 || cameraAudit.center.y>100) throw new Error('V15.2 camera screen-to-world mapping invalid');
  if(cameraAudit.stageBackgroundImage!=='none'||!/rgb\(128,\s*155,\s*104\)/.test(cameraAudit.stageBackgroundColor)||!/linear-gradient/i.test(cameraAudit.worldBackgroundImage)||!cameraAudit.horizonInsideWorld){
    throw new Error('V15.18 Outside palette is still split between fixed viewport and moving world '+JSON.stringify(cameraAudit));
  }
  if(cameraAudit.horizonHeight>cameraAudit.worldH*.24) throw new Error('V15.18 Outside horizon is too dominant '+JSON.stringify(cameraAudit));

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

  console.log('SMOKE_OK V15.18 visual cohesion -> outdoor camera palette -> grounded furniture placement -> quieter landing cover -> private memory archive -> author continuity -> privacy -> recovery -> curator -> warm atlas -> tiled camera -> revisions -> join');
  await browser.close();
})().catch(async err => {
  console.error(err);
  process.exit(1);
});