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

function makeContext(initialState = null, pathname = '/') {
  const document = {
    readyState: 'complete',
    ids: new Map(),
    documentElement: { lang: 'en' },
    head: null,
    body: null,
    createElement(tagName) { return new Element(tagName, document); },
    getElementById(id) { return document.ids.get(id) || null; },
    querySelector(selector) {
      if (selector.startsWith('script[data-lc-marketing=')) {
        return document.head.children.find(child => child.dataset.lcMarketing === selector.match(/"([^"]+)"/)?.[1]) || null;
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
  if (initialState) {
    const stored = typeof initialState === 'string' ? { value: initialState, at: new Date().toISOString() } : initialState;
    localStorage.setItem('lc_cookie_consent', JSON.stringify(stored));
  }
  const events = [];
  const window = {
    localStorage,
    location: { pathname },
    dataLayer: [],
    dispatchEvent(event) { events.push(event.type); },
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const context = { window, document, localStorage, Date, Intl, URLSearchParams, CustomEvent: window.CustomEvent, console };
  vm.runInNewContext(source, context);
  return { ...context, events, supportLinks };
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
}

const accepted = makeContext('accepted');
await settle();
assert.equal(accepted.document.head.children.filter(node => node.tagName === 'script').length, 2, 'accepted loads GTM and GA4 once');
assert.equal(new Set(accepted.document.head.children.filter(node => node.tagName === 'script').map(node => node.src)).size, 2, 'accepted scripts have unique sources');

const supportEvents = context => context.window.dataLayer.filter(entry => entry?.[0] === 'event');
const support = makeContext('accepted', '/support/');
await settle();
assert.equal(supportEvents(support).filter(entry => entry[1] === 'support_page_view').length, 1, 'accepted support page sends one page-view event');
await support.supportLinks.find(link => link.dataset.supportOption === '5').click();
const supportClick = supportEvents(support).find(entry => entry[1] === 'support_click');
assert.equal(supportClick?.[2]?.support_option, '5', 'support click records only the selected amount option');
await support.document.getElementById('lc-consent-manage').click();
await choose(support, '.lc-consent-reject');
await support.supportLinks[0].click();
assert.equal(supportEvents(support).filter(entry => entry[1] === 'support_click').length, 1, 'rejecting consent prevents subsequent support events');
await support.document.getElementById('lc-consent-manage').click();
await choose(support, '.lc-consent-accept');
assert.equal(supportEvents(support).filter(entry => entry[1] === 'support_page_view').length, 1, 're-consenting does not duplicate the support page-view event');

const rejectedSupport = makeContext('rejected', '/es/support/');
await settle();
await rejectedSupport.supportLinks[0].click();
assert.equal(supportEvents(rejectedSupport).length, 0, 'rejected analytics consent prevents support events');

const limitedSupport = makeContext('limited', '/es/support/');
await settle();
assert.equal(supportEvents(limitedSupport).filter(entry => entry[1] === 'support_page_view').length, 1, 'limited analytics consent permits one support page-view event');
await limitedSupport.supportLinks.find(link => link.dataset.supportOption === 'custom').click();
const customClick = supportEvents(limitedSupport).find(entry => entry[1] === 'support_click');
assert.equal(customClick?.[2]?.support_option, 'custom', 'custom support option is reported without payment data');

const expired = makeContext({ value: 'rejected', at: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString() });
await settle();
assert.ok(expired.document.getElementById('lc-consent-banner').classList.contains('is-visible'), 'expired decisions show the banner');

assert.match(source, /MARKETING_SCRIPT_PROMISES\.delete\(key\)/, 'failed script loads release their retry lock');
assert.match(source, /analytics_storage: value === 'rejected' \? 'denied' : 'granted'/, 'limited preserves analytics storage');
console.log('consent tests passed');
