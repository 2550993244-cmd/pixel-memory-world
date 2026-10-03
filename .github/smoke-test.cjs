const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const base = 'http://127.0.0.1:8787';
  await page.goto(base, { waitUntil: 'networkidle' });

  // V13 control language must be loaded.
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
  if (v13Styles.primaryRadius === '0px' || v13Styles.iconRadius === '0px') throw new Error('V13 rounded control styling missing');

  async function active(id) {
    await page.waitForFunction(id => document.getElementById(id)?.classList.contains('active'), id);
  }

  // Landing core buttons.
  await page.locator('#createWorldBtn').click();
  await active('creator');

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

  // Avatar choices + enter room.
  await page.locator('[data-hair="2"]').click();
  await page.locator('[data-outfit="blue"]').click();
  await page.locator('[data-item="📷"]').click();
  await page.locator('#playerNameInput').fill('测试玩家');
  await page.locator('#enterWorldBtn').click();
  await active('world');
  await page.waitForSelector('#playersLayer .player', { timeout: 5000 });

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