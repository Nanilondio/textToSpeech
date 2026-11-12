import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://listeningclassroom.com';
const PUBLISHER_ID = 'ca-pub-7086938365759492';
const htmlFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // tools/ contains local-only benchmark files excluded from the published repository.
      if (!['.git', 'node_modules', 'vendor', 'tools'].includes(entry.name)) {
        await walk(path.join(directory, entry.name));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(path.join(directory, entry.name));
    }
  }
}

await walk(ROOT);

const adsTxt = (await readFile(path.join(ROOT, 'ads.txt'), 'utf8')).trim();
const consentSource = await readFile(path.join(ROOT, 'consent.js'), 'utf8');
assert.equal(adsTxt, `google.com, pub-${PUBLISHER_ID.slice(7)}, DIRECT, f08c47fec0942fa0`, 'ads.txt authorizes only the current publisher');

const pagesWithAdSense = [];
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const publisherIds = [...html.matchAll(/ca-pub-\d+/g)].map(match => match[0]);
  assert.ok(publisherIds.every(id => id === PUBLISHER_ID), `${path.relative(ROOT, file)} has no obsolete publisher ID`);

  const adScripts = [...html.matchAll(/<script\b[^>]*src="([^"]*adsbygoogle\.js[^"]*)"[^>]*><\/script>/g)];
  assert.ok(adScripts.length <= 1, `${path.relative(ROOT, file)} has at most one AdSense script`);
  if (adScripts.length) {
    pagesWithAdSense.push(file);
    assert.ok(adScripts[0][1].includes(`client=${PUBLISHER_ID}`), `${path.relative(ROOT, file)} uses the current publisher`);
    const defaultIndex = html.indexOf('window.gtag("consent","default"');
    assert.ok(defaultIndex >= 0 && defaultIndex < adScripts[0].index, `${path.relative(ROOT, file)} sets Consent Mode before AdSense`);
    for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      assert.match(html.slice(defaultIndex, adScripts[0].index), new RegExp(`${key}:"denied"`), `${path.relative(ROOT, file)} denies ${key} by default`);
    }
    assert.match(html.slice(defaultIndex, adScripts[0].index), /window\.adsbygoogle\.pauseAdRequests=1/,
      `${path.relative(ROOT, file)} pauses ad requests before loading AdSense`);
    assert.match(html.slice(defaultIndex, adScripts[0].index), /window\.googlefc\.callbackQueue=window\.googlefc\.callbackQueue\|\|\[\]/,
      `${path.relative(ROOT, file)} initializes the Google Privacy & messaging callback queue`);
  }
}
assert.ok(pagesWithAdSense.length > 0, 'generated resource pages include AdSense');

const read = file => readFile(path.join(ROOT, file), 'utf8');
const [privacy, privacyEs, terms, termsEs, about, aboutEs, home, homeEs] = await Promise.all([
  read('privacy.html'), read('es/privacy.html'), read('terms.html'), read('es/terms.html'),
  read('about.html'), read('es/about.html'), read('index.html'), read('es/index.html'),
]);
for (const [locale, page] of [['English privacy', privacy], ['Spanish privacy', privacyEs]]) {
  assert.match(page, /Consent Mode v2/, `${locale} explains Consent Mode v2`);
  assert.match(page, /AdSense.*(?:before|antes)|(?:before|antes).*AdSense/i, `${locale} explains AdSense can load before a choice`);
  assert.match(page, /Google Fonts/, `${locale} discloses Google Fonts`);
  assert.doesNotMatch(page, /does not control AdSense|no controla.*AdSense/i, `${locale} does not claim that AdSense is outside consent signals`);
}
for (const [locale, page] of [['English terms', terms], ['Spanish terms', termsEs]]) {
  assert.match(page, /AdSense/i, `${locale} describes the AdSense integration`);
  assert.match(page, /Google Fonts/, `${locale} discloses Google Fonts`);
  assert.match(page, /GitHub Pages/, `${locale} identifies the hosting provider`);
  assert.match(page, /PayPal/, `${locale} identifies the payment destination`);
}
for (const [locale, page] of [['English About', about], ['Spanish About', aboutEs]]) {
  assert.match(page, /IP address|dirección IP/i, `${locale} discloses technical request data`);
  assert.doesNotMatch(page, /No user accounts or personal data are collected|No se recopilan cuentas de usuario ni datos personales/i, `${locale} avoids an absolute no-data claim`);
}
assert.match(home, /IP address and browser information/, 'English homepage describes technical request data');
assert.match(homeEs, /dirección IP e información del navegador/, 'Spanish homepage describes technical request data');

for (const page of [privacy, privacyEs]) {
  assert.match(page, /Contact|Contacto/, 'privacy page provides a contact heading');
}
assert.match(privacy, /address in section 8/, 'English privacy contact reference points to the correct section');
assert.match(privacyEs, /dirección de la sección 8/, 'Spanish privacy contact reference points to the correct section');
for (const [file, page, lang] of [
  ['privacy.html', privacy, 'en'], ['es/privacy.html', privacyEs, 'es'],
  ['terms.html', terms, 'en'], ['es/terms.html', termsEs, 'es'],
]) {
  assert.match(page, new RegExp(`<html lang="${lang}"`), `${file} declares its document language`);
  assert.match(page, /<main id="main">[\s\S]*<h1[\s>]/, `${file} has a main landmark containing a page heading`);
  const links = [...page.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  assert.ok(links.length > 0, `${file} includes navigation links`);
  for (const [, attributes, label] of links) {
    assert.ok(attributes.includes('aria-label') || label.replace(/<[^>]*>/g, '').trim(), `${file} has no empty link name`);
  }
}

const sitemap = await read('sitemap.xml');
assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset\b[\s\S]*<\/urlset>\s*$/, 'sitemap has an XML urlset');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.ok(urls.length > 0, 'sitemap contains URLs');
assert.equal(new Set(urls).size, urls.length, 'sitemap URLs are unique');
for (const rawUrl of urls) {
  const url = new URL(rawUrl);
  assert.equal(url.origin, SITE, `${rawUrl} uses the canonical origin`);
  assert.equal(url.search, '', `${rawUrl} has no query string`);
  assert.equal(url.hash, '', `${rawUrl} has no fragment`);
  const relative = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '');
  const pagePath = path.join(ROOT, relative);
  const targetPath = url.pathname.endsWith('/') ? path.join(pagePath, 'index.html') : pagePath;
  await access(targetPath);
  const html = await readFile(targetPath, 'utf8');
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual(canonicals, [rawUrl], `${rawUrl} has one matching canonical`);
  const ogUrls = [...html.matchAll(/<meta property="og:url" content="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual(ogUrls, [rawUrl], `${rawUrl} has one matching Open Graph URL`);
  const enUrl = url.pathname.startsWith('/es/')
    ? `${SITE}${url.pathname.replace(/^\/es/, '')}`
    : rawUrl;
  const esUrl = url.pathname.startsWith('/es/')
    ? rawUrl
    : `${SITE}/es${url.pathname}`;
  assert.ok(html.includes(`hreflang="en" href="${enUrl}"`), `${rawUrl} declares its English alternate`);
  assert.ok(html.includes(`hreflang="es" href="${esUrl}"`), `${rawUrl} declares its Spanish alternate`);
  assert.ok(html.includes(`hreflang="x-default" href="${enUrl}"`), `${rawUrl} declares its x-default alternate`);
}

const robots = await read('robots.txt');
assert.ok(robots.includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt points to the canonical sitemap');
assert.equal((await read('CNAME')).trim(), 'listeningclassroom.com', 'CNAME matches the canonical host');
assert.match(consentSource, /CONSENT_API_READY[\s\S]*showRevocationMessage\(\)/,
  'CMP revocation is invoked through the documented Google callback queue');
for (const file of [
  'index.html', 'es/index.html', 'about.html', 'es/about.html',
  'contact.html', 'es/contact.html', 'privacy.html', 'es/privacy.html',
  'terms.html', 'es/terms.html', 'generator/index.html',
  'es/generator/index.html', 'support/index.html', 'es/support/index.html',
]) {
  assert.doesNotMatch(await read(file), /adsbygoogle\.js/, `${file} does not load AdSense`);
}

console.log(`AdSense compliance checks passed: ${htmlFiles.length} HTML files, ${pagesWithAdSense.length} AdSense pages, ${urls.length} canonical sitemap URLs.`);
