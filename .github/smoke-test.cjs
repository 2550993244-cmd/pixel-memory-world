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

  // V15 P1-P4 systems must be present as real runtime capabilities.
  const v15Diag = await page.evaluate(() => ({
    runtime: window.PixelV15 || null,
    sceneVersion: window.PixelSceneMap?.version || null,
    layers: Object.keys(window.PixelSceneMap?.outdoor?.layers || {}),
    hasSystemsCss: !!document.querySelector('link[href*="systems-v15.css"]'),
    hasSystemsJs: !!document.querySelector('script[src*="systems-v15.js"]'),
    hasEditorApi: !!window.PixelRoomEditor,
    hasActionApi: !!window.PixelCharacterActions
  }));
  console.log('V15_DIAG', v15Diag);
  if (v15Diag.runtime?.version !== '15.0') throw new Error('V15 runtime missing');
  if (v15Diag.sceneVersion !== '15.0') throw new Error('V15 layered scene map missing');
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
  await page.locator('#playerNameInput').fill('测试玩家');
  await page.locator('#enterWorldBtn').click();
  await active('world');
  await page.waitForSelector('#playersLayer .player', { timeout: 5000 });

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
  await page.waitForTimeout(260);
  const cameraAudit = await page.evaluate(() => ({
    wrapper: !!document.querySelector('.pm-camera-world-v15'),
    active: document.querySelector('#questStage')?.classList.contains('pm-camera-active'),
    transform: getComputedStyle(document.querySelector('.pm-camera-world-v15')).transform,
    collisionCount: window.PixelSceneMap?.outdoor?.layers?.collision?.ellipses?.length || 0
  }));
  console.log('V15_CAMERA_AUDIT', cameraAudit);
  if (!cameraAudit.wrapper || !cameraAudit.active || cameraAudit.collisionCount < 3) throw new Error('V15 camera/layered collision runtime missing');
  if (cameraAudit.transform === 'none') throw new Error('V15 camera did not transform the quest world');
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

  console.log('SMOKE_OK V15 landing -> creator -> actions -> owner editor -> keepsake -> outside camera -> room -> join');
  await browser.close();
})().catch(async err => {
  console.error(err);
  process.exit(1);
});