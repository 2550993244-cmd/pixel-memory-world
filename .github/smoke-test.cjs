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
  if (v14Diag.pixelV14?.version !== '14.1') throw new Error('V14 bootstrap missing | ' + errors.join(' | '));
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

  // Room controls: dock + settings should still be clickable after the visual rewrite.
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

  console.log('SMOKE_OK landing -> creator -> avatar -> room -> outside -> room -> join');
  await browser.close();
})().catch(async err => {
  console.error(err);
  process.exit(1);
});