import assert from 'node:assert/strict';
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
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

async function openScenario(scenario, route = '/guides/') {
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.route('https://**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'pagead2.googlesyndication.com'
      || url.hostname === 'www.googletagmanager.com') {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    }
    return route.abort();
  });
  await page.addInitScript(config => {
    if (config.gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });
    if (config.authority) localStorage.setItem('lc_consent_authority', config.authority);
    if (config.choice) localStorage.setItem('lc_test_cmp_choice', config.choice);
    if (config.legacyConsent) localStorage.setItem('lc_cookie_consent', JSON.stringify({
      value: config.legacyConsent,
      at: new Date().toISOString(),
    }));
    const isEurope = ['eea', 'uk', 'switzerland'].includes(config.region);
    const storedChoice = localStorage.getItem('lc_test_cmp_choice');
    const state = {
      choice: storedChoice || config.choice || null,
      revoked: false,
      usOptedOut: config.gppOptOut === true,
      listeners: [],
      gppListeners: [],
      mode: () => {
        const status = state.choice === 'accepted' ? 1 : 2;
        return {
          adStoragePurposeConsentStatus: status,
          adUserDataPurposeConsentStatus: status,
          adPersonalizationPurposeConsentStatus: state.choice === 'partial' ? 2 : status,
          analyticsStoragePurposeConsentStatus: status,
        };
      },
    };
    const tcData = () => ({
      gdprApplies: isEurope,
      eventStatus: state.choice ? 'tcloaded' : 'cmpuishown',
      tcString: state.choice && isEurope ? 'SIMULATED-ONLY' : '',
    });
    const emitTcf = () => state.listeners.forEach(callback => callback(tcData(), true));
    const notifyConsentMode = () => window.googlefc.callbackQueue
      .filter(item => item.CONSENT_MODE_DATA_READY)
      .forEach(item => item.CONSENT_MODE_DATA_READY());
    window.__lcCmpSimulation = {
      choose(choice) {
        state.choice = choice;
        localStorage.setItem('lc_test_cmp_choice', choice);
        emitTcf();
        notifyConsentMode();
      },
      getState: () => ({ choice: state.choice, revoked: state.revoked }),
      setUsOptOut(optedOut) {
        state.usOptedOut = optedOut;
        const pingData = {
          signalStatus: 'ready',
          applicableSections: [7],
          parsedSections: {
            usnat: [{
              MspaOptOut: optedOut ? 1 : 2,
              SaleOptOut: optedOut ? 1 : 2,
              SharingOptOut: optedOut ? 1 : 2,
              TargetedAdvertisingOptOut: optedOut ? 1 : 2,
            }],
          },
        };
        state.gppListeners.forEach(callback => callback({
          eventName: 'signalStatus',
          listenerId: 1,
          data: 'not ready',
          pingData: { signalStatus: 'not ready', applicableSections: [7], parsedSections: {} },
        }, true));
        state.gppListeners.forEach(callback => callback({
          eventName: 'signalStatus',
          listenerId: 1,
          data: 'ready',
          pingData,
        }, true));
      },
    };
    window.__tcfapi = (command, version, callback) => {
      if (command !== 'addEventListener') return callback(null, false);
      state.listeners.push(callback);
      callback(tcData(), true);
    };
    const queue = [];
    queue.push = function (item) {
      Array.prototype.push.call(this, item);
      if (item.CONSENT_API_READY) item.CONSENT_API_READY();
      if (item.CONSENT_MODE_DATA_READY) item.CONSENT_MODE_DATA_READY();
      if (item.INITIAL_US_STATES_OPT_OUT_DATA_READY) item.INITIAL_US_STATES_OPT_OUT_DATA_READY();
      if (item.CONSENT_DATA_READY) item.CONSENT_DATA_READY();
      return this.length;
    };
    window.__gpp = (command, callback) => {
      if (command !== 'addEventListener') return;
      state.gppListeners.push(callback);
      callback({
        eventName: 'listenerRegistered',
        listenerId: 1,
        pingData: {
          signalStatus: 'ready',
          applicableSections: [7],
          parsedSections: {
            usnat: [{
              MspaOptOut: state.usOptedOut ? 1 : 2,
            }],
          },
        },
      }, true);
    };
    window.googlefc = {
      callbackQueue: queue,
      usstatesoptout: {
        getInitialUsStatesOptOutStatus: () => config.usStatus ?? 1,
      },
      getGoogleConsentModeValues: () => state.mode(),
      showRevocationMessage() {
        state.choice = null;
        state.revoked = true;
        localStorage.removeItem('lc_test_cmp_choice');
        emitTcf();
        notifyConsentMode();
      },
    };
  }, scenario);
  await page.goto(`http://127.0.0.1:${address.port}${route}`, { waitUntil: 'domcontentloaded' });
  return { page, errors, requests };
}

try {
  for (const region of ['eea', 'uk', 'switzerland']) {
    const { page, errors, requests } = await openScenario({ region });
    assert.equal(await page.locator('#lc-consent-banner.is-visible').count(), 0, `${region}: custom banner is suppressed`);
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1, `${region}: first visit keeps AdSense requests paused`);
    assert.equal(await page.locator('script[data-lc-marketing="gtm"], script[data-lc-marketing="ga4"]').count(), 0,
      `${region}: no Google tags load before a decision in Basic Mode`);
    assert.ok(requests.some(url => url.includes('adsbygoogle.js')),
      `${region}: AdSense library can download while ad requests are paused`);
    assert.equal(requests.some(url => url.includes('googletagmanager.com/gtm.js') || url.includes('gtag/js?id=')), false,
      `${region}: GTM and GA4 script requests remain deferred before a decision`);

    await page.evaluate(() => window.__lcCmpSimulation.choose('accepted'));
    await page.waitForFunction(() => window.adsbygoogle.pauseAdRequests === 0);
    assert.equal(await page.locator('script[data-lc-marketing="gtm"]').count(), 1, `${region}: accepted decision loads GTM once`);
    assert.equal(await page.locator('script[data-lc-marketing="ga4"]').count(), 1, `${region}: accepted decision loads GA4 once`);
    assert.deepEqual(await page.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2]),
      { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' },
      `${region}: accepted CMP values update all Consent Mode v2 signals`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.adsbygoogle.pauseAdRequests === 0);
    assert.equal(await page.locator('script[data-lc-marketing="gtm"]').count(), 1, `${region}: returning visitor keeps one GTM loader`);
    assert.equal(await page.locator('script[data-lc-marketing="ga4"]').count(), 1, `${region}: returning visitor keeps one GA4 loader`);
    await page.locator('#lc-consent-manage').click();
    await page.waitForFunction(() => window.__lcCmpSimulation.getState().revoked);
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1, `${region}: simulated revocation pauses requests`);
    assert.deepEqual(await page.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2]),
      { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' },
      `${region}: simulated revocation denies all Consent Mode v2 signals`);
    assert.deepEqual(errors, [], `${region}: browser has no uncaught errors`);
    await page.close();
  }

  for (const choice of ['rejected', 'partial']) {
    const { page, errors } = await openScenario({ region: 'eea' });
    await page.evaluate(value => window.__lcCmpSimulation.choose(value), choice);
    assert.equal(await page.evaluate(() => window.adsbygoogle.pauseAdRequests), 1,
      `simulated European ${choice} keeps ad requests paused in Basic Mode`);
    assert.equal(await page.locator('script[data-lc-marketing="gtm"], script[data-lc-marketing="ga4"]').count(), 0,
      `simulated European ${choice} does not load Google tags in Basic Mode`);
    assert.deepEqual(await page.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2]),
      { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' },
      `simulated European ${choice} denies all Consent Mode v2 signals`);
    assert.deepEqual(errors, [], `simulated European ${choice} has no uncaught browser errors`);
    await page.close();
  }

  const { page: chile } = await openScenario({ region: 'chile' });
  await chile.locator('#lc-consent-banner.is-visible').waitFor();
  await chile.locator('#lc-consent-manage').click();
  await chile.locator('.lc-consent-reject').click();
  assert.equal(await chile.evaluate(() => window.adsbygoogle.pauseAdRequests), 1, 'Chile: reject keeps ad requests paused');
  await chile.locator('#lc-consent-manage').click();
  await chile.locator('.lc-consent-accept').click();
  await chile.waitForFunction(() => window.adsbygoogle.pauseAdRequests === 0);
  assert.equal(await chile.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2].ad_personalization),
    'granted', 'Chile: explicit legacy acceptance grants the configured ad signals');
  await chile.goto(`http://127.0.0.1:${address.port}/about.html`, { waitUntil: 'domcontentloaded' });
  assert.ok(await chile.evaluate(() => localStorage.getItem('lc_consent_authority') === 'legacy'
    && JSON.parse(localStorage.getItem('lc_cookie_consent')).value === 'accepted'),
  'Chile: decision persists across navigation to a page without AdSense');
  await chile.close();

  const { page: usOptOut } = await openScenario({
    region: 'us-state',
    usStatus: 3,
    gppOptOut: true,
    choice: 'accepted',
    legacyConsent: 'accepted',
  });
  assert.equal(await usOptOut.evaluate(() => window.adsbygoogle.requestNonPersonalizedAds), 1,
    'US opt-out: simulated state sets AdSense NPA treatment');
  assert.equal(await usOptOut.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2].ad_personalization),
    'denied', 'US opt-out: Consent Mode personalization remains denied');
  await usOptOut.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await usOptOut.evaluate(() => window.adsbygoogle.requestNonPersonalizedAds), 1,
    'US opt-out: reload preserves the simulated GPP restriction');
  assert.equal(await usOptOut.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2].ad_personalization),
    'denied', 'US opt-out: reload does not restore local personalized-ad consent');
  await usOptOut.locator('#lc-consent-manage').click();
  await usOptOut.waitForURL(/\/guides\/\?lc-manage-consent=1$/);
  await usOptOut.close();

  const { page: dynamicGpp } = await openScenario({
    region: 'us-state',
    usStatus: 2,
    legacyConsent: 'accepted',
  });
  assert.equal(await dynamicGpp.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2].ad_personalization),
    'granted', 'US state before opt-out: existing accepted choice sets the configured signals');
  await dynamicGpp.evaluate(() => window.__lcCmpSimulation.setUsOptOut(true));
  assert.equal(await dynamicGpp.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2].ad_personalization),
    'denied', 'GPP state change: an opt-out denies Consent Mode ad signals');
  assert.equal(await dynamicGpp.evaluate(() => window.adsbygoogle.requestNonPersonalizedAds), 1,
    'GPP state change: AdSense is switched to non-personalized requests');
  assert.equal(await dynamicGpp.evaluate(() => window.adsbygoogle.pauseAdRequests), 0,
    'GPP opt-out permits only eligible NPA requests in the simulation');
  await dynamicGpp.evaluate(() => window.__lcCmpSimulation.setUsOptOut(false));
  assert.equal(await dynamicGpp.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2].ad_personalization),
    'granted', 'GPP state change: clearing opt-out restores only the existing accepted choice');
  assert.equal(await dynamicGpp.evaluate(() => window.adsbygoogle.pauseAdRequests), 0,
    'a valid GPP transition keeps an accepted request eligible');
  await dynamicGpp.close();

  const { page: gpc } = await openScenario({
    region: 'chile',
    gpc: true,
    legacyConsent: 'accepted',
  });
  assert.equal(await gpc.locator('script[data-lc-marketing="gtm"], script[data-lc-marketing="ga4"]').count(), 0,
    'GPC: Google analytics tags are not loaded');
  await gpc.locator('.lc-consent-accept').click();
  assert.equal(await gpc.evaluate(() => window.adsbygoogle.pauseAdRequests), 1, 'GPC: AdSense requests remain paused');
  assert.equal(await gpc.evaluate(() => window.dataLayer.filter(item => item[0] === 'consent' && item[1] === 'update').at(-1)[2].ad_personalization),
    'denied', 'GPC: personalized advertising remains denied');
  await gpc.close();

  const { page: legalEs } = await openScenario({
    region: 'eea',
    authority: 'google-europe',
    choice: 'accepted',
  }, '/es/privacy.html');
  assert.equal(await legalEs.locator('#lc-consent-banner.is-visible').count(), 0, 'Spanish legal page has no competing custom CMP');
  await legalEs.locator('#lc-consent-manage').click();
  await legalEs.waitForURL(/\/es\/guides\/\?lc-manage-consent=1$/);
  assert.equal(await legalEs.evaluate(() => window.__lcCmpSimulation.getState().revoked), true,
    'Spanish page routes privacy management to a page with the Google CMP integration');
  await legalEs.close();
  console.log('SIMULATED Google Privacy & Messaging browser checks passed; no live Google CMP, TCF string, GPP, geo targeting, or AdSense requests were tested.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
