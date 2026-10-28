import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../consent.js', import.meta.url), 'utf8');

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

function makeContext(initialState = null) {
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
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  document.head = new Element('head', document);
  document.body = new Element('body', document);
  const localStorage = new FakeStorage();
  if (initialState) {
    const stored = typeof initialState === 'string' ? { value: initialState, at: new Date().toISOString() } : initialState;
    localStorage.setItem('lc_cookie_consent', JSON.stringify(stored));
  }
  const events = [];
  const window = {
    localStorage,
    dataLayer: [],
    dispatchEvent(event) { events.push(event.type); },
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const context = { window, document, localStorage, Date, Intl, URLSearchParams, CustomEvent: window.CustomEvent, console };
  vm.runInNewContext(source, context);
  return { ...context, events };
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
assert.equal(accepted.document.head.children.filter(node => node.tagName === 'script').length, 3, 'accepted loads three services once');
assert.equal(new Set(accepted.document.head.children.filter(node => node.tagName === 'script').map(node => node.src)).size, 3, 'accepted scripts have unique sources');

const expired = makeContext({ value: 'rejected', at: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString() });
await settle();
assert.ok(expired.document.getElementById('lc-consent-banner').classList.contains('is-visible'), 'expired decisions show the banner');

assert.match(source, /MARKETING_SCRIPT_PROMISES\.delete\(key\)/, 'failed script loads release their retry lock');
assert.match(source, /analytics_storage: value === 'rejected' \? 'denied' : 'granted'/, 'limited preserves analytics storage');
console.log('consent tests passed');
