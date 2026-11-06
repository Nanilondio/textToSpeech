import assert from 'node:assert/strict';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeExternal = route => new URL(route.request().url()).hostname === 'cdn.jsdelivr.net'
  ? route.continue()
  : route.abort();
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml'
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const file = pathname.endsWith('/') ? path.join(target, 'index.html') : target;
    if (!statSync(file).isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mimeTypes[path.extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', routeExternal);
  await page.addInitScript(() => localStorage.setItem('lc_cookie_consent', JSON.stringify({
    value: 'rejected', at: new Date().toISOString()
  })));
  await page.goto(`http://127.0.0.1:${address.port}/generator/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#btn-generate').count(), 1);
  assert.equal(await page.locator('#btn-download').count(), 1);
  assert.equal(await page.locator('#dialogue-voice-2').inputValue(), 'am_echo');
  const activityLayout = page.locator('.lc-activity-layout');
  const activityCard = page.locator('[data-activity-generator]');
  const helpCard = page.locator('.lc-activity-help');
  assert.equal(await activityCard.getByRole('heading', { name: 'Word Search' }).count(), 1);
  const referenceWidths = await Promise.all([
    activityCard.evaluate(element => element.getBoundingClientRect().width),
    page.locator('.layout > .tool-card').evaluate(element => element.getBoundingClientRect().width),
    helpCard.evaluate(element => element.getBoundingClientRect().width),
    page.locator('.sidebar > .tips-card').evaluate(element => element.getBoundingClientRect().width)
  ]);
  assert.ok(Math.abs(referenceWidths[0] - referenceWidths[1]) < 1);
  assert.ok(Math.abs(referenceWidths[2] - referenceWidths[3]) < 1);
  assert.equal(await activityLayout.locator('.lc-activity-source-option input').count(), 3);
  assert.equal(await activityLayout.locator('input[value="single"]').isChecked(), true);

  await page.locator('.tab-btn[data-mode="dialogue"]').click();
  assert.equal(await activityLayout.locator('input[value="dialogue"]').isChecked(), true);
  await page.locator('#dialogue-text').fill(
    'Speaker 1: The teacher visits the school.\\nSpeaker 2: Students learn science in the classroom.'
  );
  await activityLayout.locator('input[value="custom"]').check();
  const customText = activityCard.locator('.lc-activity-custom-text');
  assert.equal(await customText.isVisible(), true);
  await customText.fill('The musician plays violin beside the river.');
  await activityCard.getByRole('button', { name: 'Choose words' }).click();
  assert.ok(await activityCard.getByText('musician', { exact: true }).count());
  assert.ok(await activityCard.getByText('violin', { exact: true }).count());
  await page.locator('.tab-btn[data-mode="single"]').click();
  assert.equal(await activityLayout.locator('input[value="single"]').isChecked(), true);
  assert.equal(await customText.isHidden(), true);
  await page.locator('.tab-btn[data-mode="dialogue"]').click();
  assert.equal(await activityLayout.locator('input[value="dialogue"]').isChecked(), true);
  const activityRoot = activityCard;
  assert.equal(await activityRoot.locator('.lc-activity-controls select').count(), 0);
  assert.equal(await activityRoot.getByRole('heading', { name: 'Word Search' }).count(), 1);
  assert.ok(await activityRoot.locator('.lc-ws-suggestion').count() >= 4);
  await activityRoot.locator('.lc-ws-fields input[type="number"]').fill('4');
  await activityRoot.locator('.lc-ws-suggestion input').evaluateAll(inputs => {
    inputs.forEach((input, index) => { input.checked = index < 4; input.dispatchEvent(new Event('change', { bubbles: true })); });
  });
  const helpHeightBeforePuzzle = await helpCard.evaluate(element => element.getBoundingClientRect().height);
  await activityRoot.getByRole('button', { name: 'Generate word search' }).click();
  const helpHeightAfterPuzzle = await helpCard.evaluate(element => element.getBoundingClientRect().height);
  assert.ok(Math.abs(helpHeightBeforePuzzle - helpHeightAfterPuzzle) < 1);
  assert.ok(await activityRoot.locator('.lc-ws-cell').count() >= 64);
  assert.equal(await activityRoot.locator('.lc-ws-solution').isHidden(), true);
  assert.equal(await activityRoot.getByRole('button', { name: 'Hint' }).count(), 0);
  assert.equal(await activityRoot.getByRole('button', { name: 'Print worksheet' }).count(), 0);
  const imageDownloadPromise = page.waitForEvent('download');
  await activityRoot.getByRole('button', { name: 'Download as image' }).click();
  const imageDownload = await imageDownloadPromise;
  assert.match(imageDownload.suggestedFilename(), /\.png$/);
  assert.deepEqual(readFileSync(await imageDownload.path()).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  await page.locator('#dialogue-text').fill('Speaker 1: The astronaut explores the galaxy.');
  await activityRoot.getByRole('button', { name: 'Update from text' }).waitFor();
  await page.evaluate(() => { window.confirm = () => false; });
  await activityRoot.getByRole('button', { name: 'Update from text' }).click();
  assert.equal(await activityRoot.getByText('astronaut', { exact: true }).count(), 0);
  await page.evaluate(() => { window.confirm = () => true; });
  await activityRoot.getByRole('button', { name: 'Update from text' }).click();
  assert.ok(await activityRoot.getByText('astronaut', { exact: true }).count());
  await activityRoot.getByRole('button', { name: 'Hide activity' }).click();
  await activityRoot.getByRole('button', { name: 'Show activity' }).click();

  await page.locator('#dialogue-text').fill('');
  assert.equal(await activityRoot.getByRole('button', { name: 'Choose words' }).isDisabled(), true);
  await page.locator('#dialogue-text').fill('The gardener grows vegetables in the garden.');
  assert.equal(await activityRoot.getByRole('button', { name: 'Choose words' }).isDisabled(), false);

  async function generateAudio(mode, text, voices = []) {
    await page.locator(`.tab-btn[data-mode="${mode}"]`).click();
    await page.locator(mode === 'single' ? '#download-text' : '#dialogue-text').fill(text);
    if (mode === 'single' && voices[0]) await page.locator('#voice-select').selectOption(voices[0]);
    if (mode === 'dialogue') {
      if (voices[0]) await page.locator('#dialogue-voice-1').selectOption(voices[0]);
      if (voices[1]) await page.locator('#dialogue-voice-2').selectOption(voices[1]);
    }
    await page.locator('#btn-generate').click();
    await page.waitForFunction(() => {
      const statusText = document.getElementById('status-text').textContent;
      return statusText.startsWith('Preview ready') || document.getElementById('dot').classList.contains('error');
    }, undefined, { timeout: 180000 });
    const statusText = await page.locator('#status-text').textContent();
    assert.match(statusText, /^Preview ready/, `${mode} audio generation failed: ${statusText}`);
  }
  async function generateAndDownload(mode, text, voices) {
    await generateAudio(mode, text, voices);
    const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
    await page.locator('#btn-download').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /\.mp3$/);
  }
  await generateAndDownload('single', 'Hello there.');
  await generateAndDownload('dialogue', 'Speaker 1: Hello there.\nSpeaker 2: How are you?', ['am_echo', 'af_bella']);
  assert.deepEqual(
    await page.locator('#voice-select option').evaluateAll(options => options.map(option => option.value)),
    ['af_heart', 'af_bella', 'am_echo', 'bf_emma', 'bm_george']
  );
  await generateAudio('single', 'Hello there.', ['am_echo']);

  const standalone = await page.evaluate(async () => {
    const { WordSearch } = await import('/assets/js/activities/word-search.js');
    const container = document.createElement('div');
    container.id = 'standalone-word-search-test';
    container.style.cssText = 'position:fixed;top:10px;left:10px;width:560px;height:850px;overflow:auto;z-index:1000;background:#fff';
    document.body.append(container);
    const instance = WordSearch.mount(container, { words: ['SCHOOL'], title: 'At School', difficulty: 'hard' });
    window.wordSearchTestInstance = instance;
    const { grid } = instance.getState();
    if (container.querySelector('.lc-ws-worksheet-title').textContent !== 'At School') {
      throw new Error('Standalone activity title was not applied.');
    }
    if (container.querySelectorAll('.lc-ws-fields select')[1].value !== 'hard') {
      throw new Error('Standalone activity difficulty was not applied.');
    }
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid.length; column++) {
        for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]]) {
          const endRow = row + 5 * rowStep;
          const endColumn = column + 5 * columnStep;
          if (endRow < 0 || endRow >= grid.length || endColumn < 0 || endColumn >= grid.length) continue;
          const word = Array.from({ length: 6 }, (_, index) => grid[row + index * rowStep][column + index * columnStep]).join('');
          if (word === 'SCHOOL') return { start: [row, column], end: [endRow, endColumn] };
        }
      }
    }
    throw new Error('Generated word could not be located for the pointer test.');
  });
  const startCell = page.locator(`.lc-ws-cell[data-row="${standalone.start[0]}"][data-column="${standalone.start[1]}"]`).last();
  const endCell = page.locator(`.lc-ws-cell[data-row="${standalone.end[0]}"][data-column="${standalone.end[1]}"]`).last();
  await endCell.scrollIntoViewIfNeeded();
  await startCell.scrollIntoViewIfNeeded();
  const start = await startCell.boundingBox();
  const end = await endCell.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  const selectedCells = await page.locator('#standalone-word-search-test .lc-ws-cell.is-selecting').evaluateAll(cells =>
    cells.map(cell => [Number(cell.dataset.row), Number(cell.dataset.column)]));
  assert.equal(selectedCells.length, 6, JSON.stringify({ start: standalone.start, end: standalone.end, selectedCells, start, end }));
  await page.mouse.up();
  const standaloneRoot = page.locator('#standalone-word-search-test');
  assert.equal(
    await standaloneRoot.locator('.lc-ws-word-list li.is-found').count(),
    1,
    JSON.stringify({
      start: standalone.start,
      end: standalone.end,
      status: await standaloneRoot.locator('.lc-ws-status').textContent(),
      selected: await standaloneRoot.locator('.lc-ws-cell.is-selecting').count()
    })
  );
  assert.ok(await standaloneRoot.locator('.lc-ws-cell.is-found[aria-pressed="true"]').count() >= 6);
  await standaloneRoot.getByRole('button', { name: 'Reset activity' }).click();
  assert.equal(await standaloneRoot.locator('.lc-ws-word-list li.is-found').count(), 0);

  const keyboardSelection = await page.evaluate(() => {
    const { grid } = window.wordSearchTestInstance.getState();
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid.length; column++) {
        for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]]) {
          const endRow = row + 5 * rowStep;
          const endColumn = column + 5 * columnStep;
          if (endRow < 0 || endRow >= grid.length || endColumn < 0 || endColumn >= grid.length) continue;
          if (Array.from({ length: 6 }, (_, index) => grid[row + index * rowStep][column + index * columnStep]).join('') === 'SCHOOL') {
            return { start: [row, column], end: [endRow, endColumn] };
          }
        }
      }
    }
    throw new Error('Generated word could not be located for the keyboard test.');
  });
  const keyboardStart = standaloneRoot.locator(`.lc-ws-cell[data-row="${keyboardSelection.start[0]}"][data-column="${keyboardSelection.start[1]}"]`);
  const keyboardEnd = standaloneRoot.locator(`.lc-ws-cell[data-row="${keyboardSelection.end[0]}"][data-column="${keyboardSelection.end[1]}"]`);
  await keyboardStart.focus();
  await keyboardStart.press('Enter');
  await keyboardEnd.focus();
  await keyboardEnd.press('Enter');
  assert.equal(await standaloneRoot.locator('.lc-ws-word-list li.is-found').count(), 1);
  await standaloneRoot.evaluate(element => { element.style.cssText = ''; });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await standaloneRoot.locator('.lc-ws-board').evaluate(board => board.getBoundingClientRect().right <= window.innerWidth), true);

  assert.deepEqual(errors, []);
  const spanishPage = await browser.newPage();
  const spanishErrors = [];
  spanishPage.on('pageerror', error => spanishErrors.push(error.message));
  await spanishPage.route('https://**/*', routeExternal);
  await spanishPage.addInitScript(() => localStorage.setItem('lc_cookie_consent', JSON.stringify({
    value: 'rejected', at: new Date().toISOString()
  })));
  await spanishPage.goto(`http://127.0.0.1:${address.port}/es/generator/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await spanishPage.locator('#dialogue-voice-2').inputValue(), 'am_echo');
  assert.equal(await spanishPage.locator('[data-activity-generator]').getByRole('heading', {
    name: 'Sopa de letras', exact: true
  }).count(), 1);
  assert.equal(await spanishPage.locator('#btn-generate').count(), 1);
  await spanishPage.locator('.tab-btn[data-mode="dialogue"]').click();
  await spanishPage.locator('#dialogue-text').fill('Speaker 1: The student studies science.');
  await spanishPage.locator('[data-activity-generator]').getByRole('button', { name: 'Elegir palabras' }).click();
  assert.ok(await spanishPage.locator('.lc-ws-instructions').textContent());
  assert.deepEqual(spanishErrors, []);

  console.log('activity browser tests passed: EN/ES pages, Echo dialogue default, single/dialogue audio and MP3 download, word-search PNG download, stale-text confirmation, hide/show, mouse/keyboard selection, reset, responsive layout, standalone mount');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
