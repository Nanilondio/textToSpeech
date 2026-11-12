import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../consent.js', import.meta.url), 'utf8');
const buildSource = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
const guideIndex = await readFile(new URL('../guides/index.html', import.meta.url), 'utf8');
const supportPage = await readFile(new URL('../support/index.html', import.meta.url), 'utf8');
const supportPageEs = await readFile(new URL('../es/support/index.html', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');

const adsenseTag = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7086938365759492" crossorigin="anonymous"></script>';
assert.equal((buildSource.match(new RegExp(adsenseTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, 'build template has one AdSense tag');
assert.equal((guideIndex.match(new RegExp(adsenseTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, 'guide index has one AdSense tag');
assert.doesNotMatch(source, /loadScriptOnce\(\s*['"]adsense['"]/, 'consent does not dynamically load AdSense');
assert.doesNotMatch(source, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/, 'consent has no duplicate AdSense URL');
assert.ok(buildSource.includes('if (/^https?:\\/\\//i.test(raw)) return null;'), 'external HTTP(S) resources are not validated as local paths');
assert.ok(buildSource.includes('if (/^(?:https?:|\\/\\/|data:|blob:)/i.test(src)) return match;'), 'Spanish generation preserves external script URLs');
assert.match(supportPage, /<title>Support ListeningClassroom<\/title>/, 'English support title is generated');
assert.match(supportPageEs, /<title>Apoya a ListeningClassroom<\/title>/, 'Spanish support title is generated');
assert.match(supportPage, /rel="canonical" href="https:\/\/listeningclassroom\.com\/support\/"/, 'English support canonical is correct');
assert.match(supportPageEs, /rel="canonical" href="https:\/\/listeningclassroom\.com\/es\/support\/"/, 'Spanish support canonical is correct');
assert.doesNotMatch(supportPage + supportPageEs, /adsbygoogle|google-adsense-account/, 'support pages omit AdSense');
assert.equal((supportPage.match(/href="https:\/\/paypal\.me\/listeningclassroom"/g) || []).length, 8, 'English support options use the confirmed PayPal.Me URL');
assert.equal((supportPageEs.match(/href="https:\/\/paypal\.me\/listeningclassroom"/g) || []).length, 4, 'Spanish support options use the confirmed PayPal.Me URL');
assert.equal((supportPage.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 8, 'all English payment links open safely in a new tab');
assert.match(sitemap, /<loc>https:\/\/listeningclassroom\.com\/support\/<\/loc>/, 'English support URL is listed in the sitemap');
assert.match(sitemap, /<loc>https:\/\/listeningclassroom\.com\/es\/support\/<\/loc>/, 'Spanish support URL is listed in the sitemap');

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class Element {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.document = document;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.classList = new ClassList();
    this.style = {};
    this.hidden = false;
    this.textContent = '';
    this._id = '';
    this._queries = new Map();
  }
  set id(value) { this._id = value; this.document.ids.set(value, this); }
  get id() { return this._id; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
    if (name === 'data-lc-marketing') this.dataset.lcMarketing = String(value);
  }
  appendChild(child) {
    this.children.push(child);
    if (child.id) this.document.ids.set(child.id, child);
    if (this === this.document.head && child.tagName === 'script') queueMicrotask(() => child.onload?.());
    return child;
  }
  remove() { this.removed = true; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  async click() { for (const callback of this.listeners.click || []) await callback(); }
  querySelector(selector) {
    if (!this._queries.has(selector)) this._queries.set(selector, new Element('span', this.document));
    return this._queries.get(selector);
  }
}

class FakeStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function makeContext(initialState = null, pathname = '/', defaultsSent = false, options = {}) {
  const document = {
    readyState: 'complete',
    ids: new Map(),
    documentElement: { lang: options.lang || 'en' },
    head: null,
    body: null,
    createElement(tagName) { return new Element(tagName, document); },
    getElementById(id) { return document.ids.get(id) || null; },
    querySelector(selector) {
      if (selector.startsWith('script[data-lc-marketing=')) {
        return document.head.children.find(child => child.dataset.lcMarketing === selector.match(/"([^"]+)"/)?.[1]) || null;
      }
      if (selector === 'script[src*="adsbygoogle.js"]' && options.hasAdSense !== false) {
        return { src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' };
      }
      return null;
    },
    querySelectorAll(selector) { return selector === '[data-support-option]' ? supportLinks : []; },
    addEventListener() {},
  };
  document.head = new Element('head', document);
  document.body = new Element('body', document);
  const supportLinks = ['2', '5', '10', 'custom'].map(option => {
    const link = new Element('a', document);
    link.dataset.supportOption = option;
    return link;
  });
  const localStorage = new FakeStorage();
  if (options.authority) localStorage.setItem('lc_consent_authority', options.authority);
  if (options.rawConsent !== undefined) localStorage.setItem('lc_cookie_consent', options.rawConsent);
  if (initialState) {
    const stored = typeof initialState === 'string' ? { value: initialState, at: new Date().toISOString() } : initialState;
    localStorage.setItem('lc_cookie_consent', JSON.stringify(stored));
  }
  const events = [];
  const gppListeners = [];
  const tcfListeners = [];
  const callbackQueue = [];
  callbackQueue.push = function (entry) {
    Array.prototype.push.call(this, entry);
    for (const [key, callback] of Object.entries(entry)) {
      if (key === 'CONSENT_API_READY') callback();
      if (key === 'CONSENT_MODE_DATA_READY') callback();
      if (key === 'INITIAL_US_STATES_OPT_OUT_DATA_READY') callback();
      if (key === 'CONSENT_DATA_READY') callback();
    }
    return this.length;
  };
  const gppPingData = (optedOut, signalStatus = 'ready') => {
    const prefix = options.gppPrefix || 'usnat';
    const fields = prefix === 'usnat'
      ? ['MspaOptOut']
      : prefix === 'usca'
        ? ['SaleOptOut', 'SharingOptOut']
        : ['SaleOptOut', 'TargetedAdvertisingOptOut'];
    const values = Object.fromEntries(fields.map(field => [field, optedOut ? 1 : 2]));
    if (options.gppIncomplete) delete values[fields.at(-1)];
    if (options.gppSectionGpc) values.Gpc = true;
    return {
      signalStatus,
      applicableSections: options.gppApplicableSections ?? [options.gppSectionId || (prefix === 'usnat' ? 7 : prefix === 'usca' ? 8 : prefix === 'usco' ? 10 : 9)],
      parsedSections: options.gppSections || { [prefix]: [values] },
    };
  };
  const window = {
    localStorage,
    location: { pathname, search: options.search || '', assigned: null, assign(value) { this.assigned = value; } },
    navigator: { globalPrivacyControl: options.gpc === true },
    dataLayer: [],
    adsbygoogle: Object.assign([], { pauseAdRequests: 1 }),
    googlefc: {
      callbackQueue,
      usstatesoptout: { getInitialUsStatesOptOutStatus: () => options.usStatus ?? 1 },
      getGoogleConsentModeValues: () => options.modeValues || {
        adStoragePurposeConsentStatus: 3,
        adUserDataPurposeConsentStatus: 3,
        adPersonalizationPurposeConsentStatus: 3,
        analyticsStoragePurposeConsentStatus: 3,
      },
      showRevocationMessage() { window.revocationShown = true; },
    },
    ...(options.gppUnavailable ? {} : { __gpp(command, callback) {
      if (command !== 'addEventListener') return;
      gppListeners.push(callback);
      callback({ eventName: 'listenerRegistered', listenerId: 1, pingData: gppPingData(options.gppOptOut === true, options.gppInitialSignalStatus || 'ready') }, true);
    } }),
    setTimeout(callback) { callback(); },
    dispatchEvent(event) { events.push(event.type); },
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const emitGppOptOut = (optedOut, transition = true) => {
    if (transition) {
      gppListeners.forEach(callback => callback({
        eventName: 'signalStatus',
        listenerId: 1,
        data: 'not ready',
        pingData: gppPingData(optedOut, 'not ready'),
      }, true));
    }
    gppListeners.forEach(callback => callback({
      eventName: 'signalStatus',
      listenerId: 1,
      data: 'ready',
      pingData: gppPingData(optedOut),
    }, true));
  };
  const emitGppFailure = () => gppListeners.forEach(callback => callback(null, false));
  const emitGppUnexpected = () => gppListeners.forEach(callback => callback({
    eventName: 'signalStatus',
    listenerId: 1,
    data: 'unexpected',
    pingData: { signalStatus: 'error', applicableSections: [], parsedSections: {} },
  }, true));
  const emitTcf = (overrides = {}) => tcfListeners.forEach(callback => callback({
    gdprApplies: options.gdprApplies ?? false,
    eventStatus: options.eventStatus || 'tcloaded',
    tcString: options.tcString || (options.gdprApplies ? 'simulated-tc-string' : ''),
    ...overrides,
  }, true));
  window.__tcfapi = (command, version, callback) => {
    if (command !== 'addEventListener') return callback(null, false);
    tcfListeners.push(callback);
    emitTcf();
  };
  if (defaultsSent) {
    window.__lcConsentDefaultsSent = true;
    window.dataLayer.push(['consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500,
    }]);
  }
  const context = { window, document, localStorage, Date, Intl, URLSearchParams, CustomEvent: window.CustomEvent, console };
  vm.runInNewContext(source, context);
  return { ...context, events, supportLinks, emitGppOptOut, emitGppFailure, emitGppUnexpected, emitTcf };
}

async function settle() { await new Promise(resolve => setImmediate(resolve)); }

async function choose(context, buttonSelector) {
  const banner = context.document.getElementById('lc-consent-banner');
  await banner.querySelector(buttonSelector).click();
  await settle();
}

function saved(context) {
  return JSON.parse(context.localStorage.getItem('lc_cookie_consent')).value;
}

const consentEvents = context => context.window.dataLayer.filter(entry => entry?.[0] === 'consent');
const expectedConsent = value => ({
  ad_storage: value === 'accepted' ? 'granted' : 'denied',
  ad_user_data: value === 'accepted' ? 'granted' : 'denied',
  ad_personalization: value === 'accepted' ? 'granted' : 'denied',
  analytics_storage: value === 'rejected' ? 'denied' : 'granted',
});

for (const [initial, choice, selector] of [
  [null, 'accepted', '.lc-consent-accept'],
  [null, 'limited', '.lc-consent-limited'],
  [null, 'rejected', '.lc-consent-reject'],
  ['accepted', 'rejected', '.lc-consent-reject'],
  ['accepted', 'limited', '.lc-consent-limited'],
  ['limited', 'accepted', '.lc-consent-accept'],
  ['limited', 'rejected', '.lc-consent-reject'],
  ['rejected', 'accepted', '.lc-consent-accept'],
]) {
  const context = makeContext(initial);
  await settle();
  if (initial) await context.document.getElementById('lc-consent-manage').click();
  await choose(context, selector);
  assert.equal(saved(context), choice, `${initial || 'new'} -> ${choice} persists`);
  assert.ok(context.events.includes(`lc-consent:${choice}`), `${choice} event is emitted`);
  const latestConsent = consentEvents(context).at(-1);
  assert.equal(latestConsent?.[1], 'update', `${choice} updates consent`);
  assert.deepEqual({ ...latestConsent?.[2] }, expectedConsent(choice), `${choice} maps to the expected Consent Mode v2 signals`);
}

const accepted = makeContext('accepted');
await settle();
assert.equal(accepted.document.head.children.filter(node => node.tagName === 'script').length, 2, 'accepted loads GTM and GA4 once');
assert.equal(new Set(accepted.document.head.children.filter(node => node.tagName === 'script').map(node => node.src)).size, 2, 'accepted scripts have unique sources');
await accepted.document.getElementById('lc-consent-manage').click();
await choose(accepted, '.lc-consent-reject');
await accepted.document.getElementById('lc-consent-manage').click();
await choose(accepted, '.lc-consent-accept');
assert.equal(accepted.window.dataLayer.filter(entry => entry?.event === 'gtm.js').length, 1,
  'revoking and re-accepting does not duplicate GTM initialization');
assert.equal(accepted.window.dataLayer.filter(entry => entry?.[0] === 'config' && entry?.[1] === 'G-E1D8VDYM6D').length, 1,
  'revoking and re-accepting does not duplicate direct GA4 configuration');

const earlyDefaults = makeContext('accepted', '/', true);
await settle();
assert.equal(consentEvents(earlyDefaults).filter(entry => entry[1] === 'default').length, 1, 'an early page default is not initialized twice');
assert.equal(consentEvents(earlyDefaults).at(-1)?.[1], 'update', 'a saved choice updates early page defaults');
assert.deepEqual({ ...consentEvents(earlyDefaults).at(-1)[2] }, expectedConsent('accepted'), 'a saved acceptance grants the expected consent types');

const supportEvents = context => context.window.dataLayer.filter(entry => entry?.[0] === 'event');
const support = makeContext('accepted', '/support/', false, { hasAdSense: false, authority: 'legacy' });
await settle();
assert.equal(support.document.head.children.filter(node => node.tagName === 'script').length, 0,
  'support page without AdSense does not load GTM or GA4 from a stale regional choice');
await support.supportLinks.find(link => link.dataset.supportOption === '5').click();
assert.equal(supportEvents(support).length, 0, 'support contribution choice is not sent without current regional consent');
await support.document.getElementById('lc-consent-manage').click();
assert.equal(support.window.location.assigned, '/guides/?lc-manage-consent=1',
  'support privacy management routes to a page that can resolve CMP region');

const expired = makeContext({ value: 'rejected', at: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString() });
await settle();
assert.ok(expired.document.getElementById('lc-consent-banner').classList.contains('is-visible'),
  `expired decisions show the banner (authority=${expired.localStorage.getItem('lc_consent_authority')}, visible=${expired.document.getElementById('lc-consent-banner').classList.contains('is-visible')}, state=${expired.localStorage.getItem('lc_cookie_consent')})`);

assert.match(source, /MARKETING_SCRIPT_PROMISES\.delete\(key\)/, 'failed script loads release their retry lock');
assert.match(source, /analytics_storage: value !== 'rejected' && !hasGpcSignal\(\) \? 'granted' : 'denied'/,
  'limited preserves analytics storage except when GPC is active');

const invalidStoredConsent = makeContext(null, '/', true, { rawConsent: '{"value":"approved","at":"2025-01-01T00:00:00.000Z"}' });
await settle();
assert.equal(invalidStoredConsent.document.head.children.filter(node => node.tagName === 'script').length, 0,
  'unknown persisted values do not load tags or become consent');
assert.equal(invalidStoredConsent.document.getElementById('lc-consent-banner').classList.contains('is-visible'), true,
  'unknown persisted values leave the choice undecided');

const europeanDenied = makeContext(null, '/', true, { gdprApplies: true, modeValues: {
  adStoragePurposeConsentStatus: 2,
  adUserDataPurposeConsentStatus: 2,
  adPersonalizationPurposeConsentStatus: 2,
  analyticsStoragePurposeConsentStatus: 2,
} });
await settle();
assert.equal(europeanDenied.document.head.children.filter(node => node.tagName === 'script').length, 0,
  'simulated European rejection does not load GTM or GA4 in basic mode');
assert.equal(europeanDenied.window.adsbygoogle.pauseAdRequests, 1,
  'simulated European rejection keeps AdSense requests paused');

const europeanGranted = makeContext(null, '/', true, { gdprApplies: true, modeValues: {
  adStoragePurposeConsentStatus: 1,
  adUserDataPurposeConsentStatus: 1,
  adPersonalizationPurposeConsentStatus: 1,
  analyticsStoragePurposeConsentStatus: 1,
} });
await settle();
assert.equal(europeanGranted.document.head.children.filter(node => node.tagName === 'script').length, 2,
  'simulated European grant loads GTM and GA4 only after all four purposes are granted');
assert.equal(europeanGranted.window.adsbygoogle.pauseAdRequests, 0,
  'simulated European grant resumes AdSense requests');
assert.deepEqual({ ...consentEvents(europeanGranted).at(-1)[2] }, expectedConsent('accepted'),
  'simulated European grant updates all four Consent Mode v2 signals');

const europeanNotApplicable = makeContext(null, '/', true, { gdprApplies: true, modeValues: {
  adStoragePurposeConsentStatus: 3,
  adUserDataPurposeConsentStatus: 3,
  adPersonalizationPurposeConsentStatus: 3,
  analyticsStoragePurposeConsentStatus: 3,
} });
await settle();
assert.equal(europeanNotApplicable.document.head.children.filter(node => node.tagName === 'script').length, 0,
  'a not-applicable status is not treated as affirmative permission in Basic Mode');
assert.equal(europeanNotApplicable.window.adsbygoogle.pauseAdRequests, 1,
  'a not-applicable status keeps AdSense requests paused');

const europeanTransitionsOptions = {
  gdprApplies: true,
  modeValues: {
    adStoragePurposeConsentStatus: 2,
    adUserDataPurposeConsentStatus: 2,
    adPersonalizationPurposeConsentStatus: 2,
    analyticsStoragePurposeConsentStatus: 2,
  },
};
const europeanTransitions = makeContext(null, '/', true, europeanTransitionsOptions);
await settle();
assert.equal(europeanTransitions.window.adsbygoogle.pauseAdRequests, 1,
  'a European rejection starts with requests paused');
europeanTransitionsOptions.modeValues = {
  adStoragePurposeConsentStatus: 1,
  adUserDataPurposeConsentStatus: 1,
  adPersonalizationPurposeConsentStatus: 1,
  analyticsStoragePurposeConsentStatus: 1,
};
europeanTransitions.emitTcf({ eventStatus: 'useractioncomplete' });
await settle();
assert.equal(europeanTransitions.window.adsbygoogle.pauseAdRequests, 0,
  'a later European acceptance updates Consent Mode and resumes eligible requests');
europeanTransitionsOptions.modeValues = {
  adStoragePurposeConsentStatus: 2,
  adUserDataPurposeConsentStatus: 2,
  adPersonalizationPurposeConsentStatus: 2,
  analyticsStoragePurposeConsentStatus: 2,
};
europeanTransitions.emitTcf({ eventStatus: 'useractioncomplete' });
await settle();
assert.deepEqual({ ...consentEvents(europeanTransitions).at(-1)[2] }, expectedConsent('rejected'),
  'a European revocation sends denied values for all four Consent Mode signals');
assert.equal(europeanTransitions.window.adsbygoogle.pauseAdRequests, 1,
  'a European revocation pauses subsequent AdSense requests');

const gpc = makeContext('accepted', '/', true, { gpc: true });
await settle();
assert.equal(gpc.document.head.children.filter(node => node.tagName === 'script').length, 0,
  'GPC prevents GTM and GA4 script loading before and after the local choice');
await choose(gpc, '.lc-consent-accept');
assert.equal(consentEvents(gpc).at(-1)?.[2]?.ad_personalization, 'denied',
  'GPC keeps advertising personalization denied after an analytics choice');
assert.equal(gpc.window.adsbygoogle.pauseAdRequests, 1, 'GPC keeps AdSense requests paused');

const unavailableCmp = makeContext(null, '/', true, { gdprApplies: false, usStatus: 0 });
await settle();
assert.equal(unavailableCmp.localStorage.getItem('lc_consent_authority'), 'unavailable',
  'an unresolved Google CMP region is recorded as unavailable');
assert.equal(unavailableCmp.document.getElementById('lc-consent-banner').classList.contains('is-visible'), false,
  'an unresolved region does not trigger a competing legacy consent dialog');
assert.equal(unavailableCmp.window.adsbygoogle.pauseAdRequests, 1,
  'an unresolved Google CMP region keeps AdSense requests paused');

const unavailableGpp = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 2,
  gppUnavailable: true,
});
await settle();
assert.equal(unavailableGpp.localStorage.getItem('lc_consent_authority'), 'unavailable',
  'a US-state region without a GPP signal fails closed');
assert.equal(unavailableGpp.window.adsbygoogle.pauseAdRequests, 1,
  'a missing GPP signal pauses requests despite a stored local acceptance');
assert.equal(consentEvents(unavailableGpp).at(-1)?.[2]?.ad_personalization, 'denied',
  'a missing GPP signal does not grant ad personalization');

const incompleteGpp = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 2,
  gppIncomplete: true,
});
await settle();
assert.equal(incompleteGpp.window.adsbygoogle.pauseAdRequests, 1,
  'incomplete applicable GPP fields fail closed');
assert.equal(consentEvents(incompleteGpp).at(-1)?.[2]?.ad_personalization, 'denied',
  'incomplete applicable GPP fields cannot authorize stored consent');

const delayedGpp = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 2,
  gppInitialSignalStatus: 'not ready',
});
await settle();
assert.equal(delayedGpp.window.adsbygoogle.pauseAdRequests, 1,
  'a not-ready GPP signal holds requests while the CMP completes');
delayedGpp.emitGppOptOut(false, false);
await settle();
assert.equal(delayedGpp.window.adsbygoogle.pauseAdRequests, 0,
  'a later valid ready GPP signal resolves the fail-closed state');

const mismatchedGppSection = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 2,
  gppApplicableSections: [8],
});
await settle();
assert.equal(mismatchedGppSection.window.adsbygoogle.pauseAdRequests, 1,
  'a parsed GPP section not declared applicable cannot authorize ad requests');

const chile = makeContext(null, '/', true, { gdprApplies: false, usStatus: 1 });
await settle();
await choose(chile, '.lc-consent-accept');
assert.equal(consentEvents(chile).at(-1)?.[2]?.ad_personalization, 'granted',
  'simulated Chile/other-region acceptance follows the legacy consent choice');
assert.equal(chile.window.adsbygoogle.pauseAdRequests, 0,
  'simulated Chile/other-region acceptance resumes AdSense requests');

const chileWithUsSection = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 1,
  gppOptOut: true,
});
await settle();
assert.equal(consentEvents(chileWithUsSection).at(-1)?.[2]?.ad_personalization, 'granted',
  'a US section outside Google’s applicable jurisdiction does not restrict a Chilean visitor');
assert.equal(chileWithUsSection.window.adsbygoogle.requestNonPersonalizedAds, undefined,
  'a non-applicable US GPP opt-out does not set NPA');

const californiaGppOptOut = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 2,
  gppPrefix: 'usca',
  gppApplicableSections: [8],
  gppOptOut: true,
});
await settle();
assert.equal(consentEvents(californiaGppOptOut).at(-1)?.[2]?.ad_personalization, 'denied',
  'a California section is interpreted only when its matching section ID is applicable');

const europeanWithUsGpp = makeContext(null, '/', true, {
  gdprApplies: true,
  usStatus: 3,
  gppOptOut: true,
  modeValues: {
    adStoragePurposeConsentStatus: 1,
    adUserDataPurposeConsentStatus: 1,
    adPersonalizationPurposeConsentStatus: 1,
    analyticsStoragePurposeConsentStatus: 1,
  },
});
await settle();
assert.equal(europeanWithUsGpp.window.adsbygoogle.pauseAdRequests, 0,
  'an inapplicable US GPP opt-out does not replace European CMP consent status');
assert.equal(consentEvents(europeanWithUsGpp).at(-1)?.[2]?.ad_personalization, 'granted',
  'European Consent Mode values remain governed by the European CMP, not a US section');

const usOptOut = makeContext('accepted', '/', true, { gdprApplies: false, usStatus: 3, gppOptOut: true });
await settle();
assert.equal(consentEvents(usOptOut).at(-1)?.[2]?.ad_personalization, 'denied',
  'simulated US state opt-out keeps Consent Mode ad signals denied');
assert.equal(usOptOut.window.adsbygoogle.requestNonPersonalizedAds, 1,
  'simulated US state opt-out sets the AdSense non-personalized request flag');
assert.equal(usOptOut.window.adsbygoogle.pauseAdRequests, 0,
  'eligible opt-out requests are not confused with a full request block when GPC is absent');
assert.equal(consentEvents(usOptOut).at(-1)?.[2]?.analytics_storage, 'granted',
  'US advertising opt-out remains separate from an already accepted local analytics choice');
await usOptOut.document.getElementById('lc-consent-manage').click();
assert.equal(usOptOut.window.location.assigned, '/guides/?lc-manage-consent=1',
  'US state privacy management routes to a page with the Google default opt-out entry point');

const dynamicGpp = makeContext('accepted', '/', true, { gdprApplies: false, usStatus: 2 });
await settle();
assert.equal(consentEvents(dynamicGpp).at(-1)?.[2]?.ad_personalization, 'granted',
  'an explicit US-state acceptance permits the configured signals before an opt-out update');
dynamicGpp.emitGppOptOut(true);
assert.equal(consentEvents(dynamicGpp).at(-1)?.[2]?.ad_personalization, 'denied',
  'a subsequent GPP opt-out revokes Consent Mode advertising signals');
assert.equal(dynamicGpp.window.adsbygoogle.requestNonPersonalizedAds, 1,
  'a subsequent GPP opt-out switches accepted AdSense requests to non-personalized treatment');
assert.equal(dynamicGpp.window.adsbygoogle.pauseAdRequests, 0,
  'a GPP opt-out does not incorrectly treat denied personalization as no eligible ad request');
dynamicGpp.emitGppOptOut(false);
assert.equal(consentEvents(dynamicGpp).at(-1)?.[2]?.ad_personalization, 'granted',
  'a later explicit GPP opt-in restores only the existing local accepted choice');
assert.equal(dynamicGpp.window.adsbygoogle.requestNonPersonalizedAds, 0,
  'a later explicit GPP opt-in clears the non-personalized request flag');

const gppFailure = makeContext('accepted', '/', true, { gdprApplies: false, usStatus: 2 });
await settle();
gppFailure.emitGppFailure();
assert.equal(gppFailure.window.adsbygoogle.pauseAdRequests, 1,
  'loss of a previously ready GPP API fails closed');
assert.equal(consentEvents(gppFailure).at(-1)?.[2]?.ad_personalization, 'denied',
  'a GPP API error cannot restore a previous local acceptance');

const gppUnexpected = makeContext('accepted', '/', true, { gdprApplies: false, usStatus: 2 });
await settle();
gppUnexpected.emitGppUnexpected();
assert.equal(gppUnexpected.window.adsbygoogle.pauseAdRequests, 1,
  'an unexpected GPP readiness state fails closed');

const contradictoryInitialOptOut = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 3,
  gppOptOut: false,
});
await settle();
assert.equal(contradictoryInitialOptOut.window.adsbygoogle.pauseAdRequests, 1,
  'a contradictory initial GPP no-opt-out does not cancel Google’s initial opt-out');
assert.equal(consentEvents(contradictoryInitialOptOut).at(-1)?.[2]?.ad_personalization, 'denied',
  'a contradictory initial GPP no-opt-out cannot override the opt-out with local acceptance');
contradictoryInitialOptOut.emitGppOptOut(false);
await settle();
assert.equal(contradictoryInitialOptOut.window.adsbygoogle.pauseAdRequests, 0,
  'a later explicit, ready GPP transition can resolve the contradictory initial signals');
assert.equal(consentEvents(contradictoryInitialOptOut).at(-1)?.[2]?.ad_personalization, 'granted',
  'only a subsequent GPP transition, not the initial contradiction, can restore the saved choice');

const gppWithGpc = makeContext('accepted', '/', true, {
  gdprApplies: false,
  usStatus: 1,
  gppSectionGpc: true,
});
await settle();
assert.equal(gppWithGpc.window.adsbygoogle.pauseAdRequests, 1,
  'a GPC signal embedded in GPP remains effective outside an applicable US-state section');
assert.equal(gppWithGpc.window.dataLayer.filter(entry => entry?.[0] === 'consent' && entry[1] === 'update').at(-1)?.[2]?.analytics_storage,
  'denied',
  'a GPP GPC signal denies analytics Consent Mode as well as ad signals');

const europeanRevocation = makeContext('accepted', '/', true, {
  gdprApplies: true,
  search: '?lc-manage-consent=1',
  modeValues: {
    adStoragePurposeConsentStatus: 2,
    adUserDataPurposeConsentStatus: 2,
    adPersonalizationPurposeConsentStatus: 2,
    analyticsStoragePurposeConsentStatus: 2,
  },
});
await settle();
assert.equal(europeanRevocation.window.revocationShown, true,
  'simulated EU, UK, or Switzerland privacy button invokes the queued CMP revocation API');

const noAdsEuropeanPage = makeContext('accepted', '/privacy.html', false, {
  hasAdSense: false,
  authority: 'google-europe',
  lang: 'es',
});
await settle();
await noAdsEuropeanPage.document.getElementById('lc-consent-manage').click();
assert.equal(noAdsEuropeanPage.window.location.assigned, '/es/guides/?lc-manage-consent=1',
  'a Spanish no-AdSense page routes revocation to the Spanish page that loads Google CMP');
assert.equal(noAdsEuropeanPage.document.getElementById('lc-consent-banner').classList.contains('is-visible'), false,
  'a no-AdSense European page does not display a competing custom consent banner');

const noAdsUsPage = makeContext('accepted', '/privacy.html', false, {
  hasAdSense: false,
  authority: 'google-us',
});
await settle();
assert.equal(noAdsUsPage.document.head.children.filter(node => node.tagName === 'script').length, 0,
  'a no-AdSense US-state page does not load Google tags without rechecking the GPP state');
await noAdsUsPage.document.getElementById('lc-consent-manage').click();
assert.equal(noAdsUsPage.window.location.assigned, '/guides/?lc-manage-consent=1',
  'a no-AdSense US-state page routes to Google privacy options');

console.log('consent tests passed (Google CMP cases are simulated; no live Google integration was exercised)');
