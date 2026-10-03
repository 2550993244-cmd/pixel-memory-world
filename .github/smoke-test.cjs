const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const base = 'http://127.0.0.1:8787';
  await page.goto(base, { waitUntil: 'networkidle' });

  async function active(id) {
    await page.waitForFunction(id => document.getElementById(id)?.classList.contains('active'), id);
  }

  // Landing core buttons.
  await page.locator('#createWorldBtn').click();
  await active('creator');

  // Creator choices must remain clickable.
  await page.locator('[data-occasion="纪念日"]').click();
  if (!(await page.locator('[data-occasion="纪念日"]').evaluate(el => el.classList.contains('selected')))) throw new Error('occasion choice did not select');
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

  // Outside must open and return.
  await page.locator('#questDoor').click();
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