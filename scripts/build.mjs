#!/usr/bin/env node
/**
 * ListeningClassroom — static build script (bilingual inline toggle)
 *
 * Reads JSON exercises and Markdown guides from /data/ and writes fully
 * static HTML pages. Each generated page contains BOTH English and Spanish
 * content inline, wrapped in `<div class="lang-content lang-XX">`. A small
 * JS snippet at the bottom (matching the one already in about.html /
 * contact.html) reads localStorage["lang"] and toggles which block is
 * visible. The lang switcher uses the existing `data-lang` button pattern.
 *
 * No runtime server, no external dependencies, no bundler. Pure Node.js.
 *
 * Usage:
 *   node scripts/build.mjs                 # build into current dir
 *   node scripts/build.mjs --dry-run       # parse and report, write nothing
 *   node scripts/build.mjs --base https://listeningclassroom.com
 */

import { promises as fs } from 'node:fs';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const baseArg = argv.find(a => a.startsWith('--base='));
const SITE = (baseArg ? baseArg.split('=')[1] : 'https://listeningclassroom.com')
  .replace(/\/+$/, '');

// ── Helpers ─────────────────────────────────────────────────────────────────
const log = (...a) => console.log('[build]', ...a);

const readText = (p) => readFileSync(p, 'utf8');
const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

const slugify = (s) =>
  String(s).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const htmlEscape = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const attrEscape = (s) => htmlEscape(s)
  .replace(/\n/g, '&#10;')
  .replace(/\r/g, '&#13;')
  .replace(/\t/g, '&#9;');

const titleCaseSlug = (slug) => {
  const small = new Set(['a', 'an', 'and', 'at', 'the', 'of', 'in', 'on', 'for', 'to', 'with', 'by']);
  return String(slug).split('-').map((w, i) => {
    if (i !== 0 && small.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
};

const ensureDir = async (p) => { await fs.mkdir(p, { recursive: true }); };

async function writeIfChanged(filePath, content) {
  if (DRY_RUN) return;
  content = content.replace(/[ \t]+\n/g, '\n');
  const existing = existsSync(filePath) ? readText(filePath) : null;
  if (existing === content) return;
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

// ── UI translations for inline labels ───────────────────────────────────────
const UI = {
  en: {
    skipToContent: 'Skip to main content',
    home: 'Home', exercises: 'Exercises', guides: 'Guides', levels: 'Levels',
    howItWorks: 'How it works', faq: 'FAQ', about: 'About', contact: 'Contact',
    listeningExercises: 'Listening Exercises',
    vocabulary: 'Vocabulary', dialogue: 'Dialogue',
    transcript: 'Transcript', learningFocus: 'Learning focus', answerKey: 'Answer key',
    comprehensionQuestions: 'Comprehension Questions',
    trueFalse: 'True / False', teacherTips: 'Teacher Tips',
    relatedExercises: 'Related Exercises',
    openInGenerator: '🎙 Open in Listening Generator',
    openGenerator: 'Open Generator',
    continuePractising: 'Continue practising',
    advertisement: 'Advertisement',
    availableExercises: 'Available Exercises',
    allGuides: 'All Guides',
    footerCopy: 'Free text-to-speech for educators',
    privacy: 'Privacy', terms: 'Terms', generator: 'Generator',
    trueAnswer: 'True', falseAnswer: 'False',
    topic: 'Topic',
    exercisesCount: (n) => `${n} exercises`,
    minutes: 'minutes',
    readingTime: 'read',
  },
  es: {
    skipToContent: 'Saltar al contenido principal',
    home: 'Inicio', exercises: 'Ejercicios', guides: 'Guías', levels: 'Niveles',
    howItWorks: 'Cómo funciona', faq: 'Preguntas', about: 'Acerca de', contact: 'Contacto',
    listeningExercises: 'Ejercicios de escucha',
    vocabulary: 'Vocabulario', dialogue: 'Diálogo',
    transcript: 'Transcripción', learningFocus: 'Enfoque de aprendizaje', answerKey: 'Respuestas',
    comprehensionQuestions: 'Preguntas de comprensión',
    trueFalse: 'Verdadero / Falso', teacherTips: 'Consejos para el docente',
    relatedExercises: 'Ejercicios relacionados',
    openInGenerator: '🎙 Abrir en el generador de audio',
    openGenerator: 'Abrir generador',
    continuePractising: 'Seguir practicando',
    advertisement: 'Publicidad',
    availableExercises: 'Ejercicios disponibles',
    allGuides: 'Todas las guías',
    footerCopy: 'Texto a voz gratis para docentes',
    privacy: 'Privacidad', terms: 'Términos', generator: 'Generador',
    trueAnswer: 'Verdadero', falseAnswer: 'Falso',
    topic: 'Tema',
    exercisesCount: (n) => `${n} ejercicios`,
    minutes: 'minutos',
    readingTime: 'de lectura',
  },
};

// ── Tiny Markdown renderer ──────────────────────────────────────────────────
function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const inline = (s) => htmlEscape(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const level = h[1].length; out.push(`<h${level}>${inline(h[2])}</h${level}>`); i++; continue; }
    if (line.startsWith('> ')) { const buf = []; while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; } out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
    if (/^\s*[-*]\s+/.test(line)) { const items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; } out.push('<ul>' + items.map(it => `<li>${inline(it)}</li>`).join('') + '</ul>'); continue; }
    if (/^\s*\d+\.\s+/.test(line)) { const items = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; } out.push('<ol>' + items.map(it => `<li>${inline(it)}</li>`).join('') + '</ol>'); continue; }
    if (!line.trim()) { i++; continue; }
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function parseFrontMatter(src) {
  if (!src.startsWith('---')) return { meta: {}, body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: src };
  const header = src.slice(3, end).trim();
  const body = src.slice(end + 4).replace(/^\n/, '');
  const meta = {};
  for (const line of header.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith('[') && value.endsWith(']')) {
      try { value = JSON.parse(value); } catch { /* ignore */ }
    }
    meta[m[1]] = value;
  }
  return { meta, body };
}

// ── Load content ────────────────────────────────────────────────────────────
async function loadExercises() {
  const dirs = ['a1', 'a2', 'b1'];
  const out = [];
  for (const level of dirs) {
    const dir = path.join(ROOT, 'data', 'exercises', level);
    if (!existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = JSON.parse(readText(path.join(dir, f)));
      data._level = level;
      out.push(data);
    }
  }
  return out;
}

async function loadGuides() {
  const dir = path.join(ROOT, 'data', 'guides');
  if (!existsSync(dir)) return [];
  const files = await fs.readdir(dir);
  const enFiles = files.filter(f => f.endsWith('.md') && !f.endsWith('.es.md'));
  const out = [];
  for (const f of enFiles) {
    const slug = f.replace(/\.md$/, '');
    const enSrc = readText(path.join(dir, f));
    const { meta: enMeta, body: enBody } = parseFrontMatter(enSrc);

    const esFile = f.replace(/\.md$/, '.es.md');
    const esPath = path.join(dir, esFile);
    let esMeta = {}, esBody = null;
    if (existsSync(esPath)) {
      const esSrc = readText(esPath);
      const parsed = parseFrontMatter(esSrc);
      esMeta = parsed.meta;
      esBody = parsed.body;
    }

    out.push({
      ...enMeta,
      slug,
      _body: enBody,
      _esBody: esBody,
      _esMeta: esMeta,
    });
  }
  return out;
}

// ── Layout pieces ───────────────────────────────────────────────────────────
// Inline-toggle JS, copied from the existing about/contact pages so generated
// pages behave identically.
const TOGGLE_JS = `
<script>
  // Language switcher — toggles .lang-content blocks based on localStorage
  const saved = localStorage.getItem('lang') || 'en';
  function applyLang(lang) {
    localStorage.setItem('lang', lang);
    document.querySelectorAll('.lang-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.lang === lang));
    document.querySelectorAll('.lang-content').forEach(el =>
      el.hidden = !el.classList.contains('lang-' + lang));
  }
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.addEventListener('click', () => applyLang(b.dataset.lang)));
  applyLang(saved);
</script>
`;

function renderHead({ titleEn, titleEs, descriptionEn, descriptionEs, canonical, jsonLd = [], extraHead = '', robots = 'index, follow' }) {
  return `<!DOCTYPE html>
<html lang="en" data-es-title="${attrEscape(titleEs)}" data-es-description="${attrEscape(descriptionEs)}">
<head>
<meta charset="UTF-8">
<meta name="google-adsense-account" content="ca-pub-7086938365759492">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="${htmlEscape(robots)}">
<title>${htmlEscape(titleEn)}</title>
<meta name="description" content="${htmlEscape(descriptionEn)}">
<link rel="canonical" href="${htmlEscape(canonical)}">
<link rel="alternate" hreflang="en" href="${htmlEscape(canonical)}">
<link rel="alternate" hreflang="es" href="${htmlEscape(canonical.replace(SITE + '/', SITE + '/es/'))}">
<link rel="alternate" hreflang="x-default" href="${htmlEscape(canonical)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="shortcut icon" href="/favicon.svg">
<meta property="og:type" content="website">
<meta property="og:title" content="${htmlEscape(titleEn)}">
<meta property="og:description" content="${htmlEscape(descriptionEn)}">
<meta property="og:url" content="${htmlEscape(canonical)}">
<meta property="og:image" content="${SITE}/logo.svg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${htmlEscape(titleEn)}">
<meta name="twitter:description" content="${htmlEscape(descriptionEn)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
<script defer src="/consent.js"></script>
<script defer src="/assets/js/site.js"></script>
${jsonLd.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
${extraHead}
</head>
<body>`;
}

// Build a Spanish URL from the already-rendered bilingual page. This keeps the
// migration reversible while giving search engines a real, language-specific
// document instead of relying on a client-side language toggle.
function spanishPathFromEnglish(filePath) {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
  return path.join(ROOT, 'es', relative);
}

function renderSpanishDocument(html) {
  const decodeEntities = value => String(value || '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const title = decodeEntities(html.match(/data-es-title="([^"]*)"/)?.[1] || '');
  const description = decodeEntities(html.match(/data-es-description="([^"]*)"/)?.[1] || '');
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const visibleTitle = decodeEntities((headings.at(-1)?.[1] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()) || title;
  const currentCrumbs = [...html.matchAll(/<span aria-current="page">([^<]+)<\/span>/g)];
  const visibleCrumb = decodeEntities(currentCrumbs.at(-1)?.[1] || visibleTitle);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || SITE + '/';
  const spanishCanonical = canonical.replace(SITE + '/', SITE + '/es/');
  const explicitMain = html.indexOf('<main id="main">');
  const contentMarkers = ['ENGLISH VERSION', 'ENGLISH CONTENT', 'CONTENT ──']
    .map(marker => html.indexOf(marker))
    .filter(index => index >= 0);
  const contentMarker = contentMarkers.length ? Math.min(...contentMarkers) : -1;
  const mainStart = explicitMain >= 0 ? explicitMain : html.indexOf('<div class="lang-content lang-en">', contentMarker);
  const mainEnd = explicitMain >= 0 ? html.indexOf('</main>', mainStart) : html.indexOf('<footer', mainStart);
  const main = explicitMain >= 0
    ? html.slice(mainStart + '<main id="main">'.length, mainEnd)
    : html.slice(mainStart, mainEnd);
  const esMarker = '<div class="lang-content lang-es" hidden>';
  const esStart = main.indexOf(esMarker);
  const wrapperEnd = main.lastIndexOf('</div>');
  if (esStart < 0 || wrapperEnd < esStart) throw new Error(`Spanish content block not found for ${canonical}`);
  let body = main.slice(esStart + esMarker.length, wrapperEnd);
  body = body.replace(/href="\/(?!\/)/g, 'href="/es/');
  body = body.replace(/href="\/es\/es\//g, 'href="/es/');
  // Manual pages and the generator do not yet have Spanish URL variants.
  body = body.replace(/href="\/es\/(about|contact|privacy|terms|generator)\.html?"/g, 'href="/$1.html"');
  const doc = html
    .replace(/<html lang="en"[^>]*>/, '<html lang="es">')
    .replace(/<div class="lang-content lang-en">[\s\S]*?<\/div>/, '')
    .replace(/<div class="lang-content lang-es" hidden>/, '<div>')
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]+">/, `<link rel="canonical" href="${spanishCanonical}">`)
    .replace(new RegExp(`<link rel="alternate" hreflang="en" href="[^"]+">`), `<link rel="alternate" hreflang="en" href="${canonical}">`)
    .replace(new RegExp(`<link rel="alternate" hreflang="es" href="[^"]+">`), `<link rel="alternate" hreflang="es" href="${spanishCanonical}">`)
    .replace(
      html.slice(mainStart, explicitMain >= 0 ? mainEnd + '</main>'.length : mainEnd),
      explicitMain >= 0 ? `<main id="main">${body}</main>` : body
    )
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${spanishCanonical}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${description}">`);
  let localized = doc;
  localized = localized.replace(/<header class="site">[\s\S]*?<\/header>/, renderLocalizedHeader(spanishCanonical, canonical));
  localized = localized.replace(/<footer(?: class="site")?>[\s\S]*?<\/footer>/, renderLocalizedFooter());
  localized = localized.replace(/(<script\b[^>]*\bsrc=")[^/][^"]*(")/g, (match, before, after) => {
    const src = match.slice(before.length, -after.length);
    return `${before}/${src}${after}`;
  });
  const finalEs = localized.lastIndexOf('<div class="lang-content lang-es" hidden>');
  const finalEn = localized.lastIndexOf('<div class="lang-content lang-en">', finalEs);
  if (finalEn >= 0 && finalEs > finalEn) {
    const finalEnd = localized.lastIndexOf('</div>');
    localized = localized.slice(0, finalEn) + localized.slice(finalEs + '<div class="lang-content lang-es" hidden>'.length, finalEnd) + localized.slice(finalEnd + '</div>'.length);
  }
  localized = localized.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (full, json) => {
    try {
      const data = JSON.parse(json);
      if (data && (data['@type'] === 'LearningResource' || data['@type'] === 'Article' || data['@type'] === 'WebPage')) {
        data.name = visibleTitle;
        data.description = description;
      }
      if (data?.['@type'] === 'Article') {
        data.headline = visibleTitle;
        delete data.author;
      }
      if (data?.['@type'] === 'LearningResource') {
        const slug = data.url.split('/').filter(Boolean).at(-1);
        const exercise = guideExerciseCatalog.find(item => item.slug === slug);
        if (exercise?.es?.topicName) data.teaches = exercise.es.topicName;
      }
      if (data?.['@type'] === 'ItemList') {
        data.name = 'Ejercicios de escucha en inglés';
        for (const item of data.itemListElement || []) {
          const slug = item.url?.split('/').filter(Boolean).at(-1);
          const exercise = guideExerciseCatalog.find(candidate => candidate.slug === slug);
          if (exercise?.es?.title) item.name = exercise.es.title;
        }
      }
      if (data?.['@type'] === 'WebApplication') {
        data.name = 'ListeningClassroom — Generador de audio en inglés';
        data.description = description;
        data.url = spanishCanonical;
        if (data.audience) data.audience.audienceType = 'Docentes y estudiantes de inglés';
        data.featureList = ['Generación de diálogos en inglés con dos voces', 'Descarga de audio MP3', 'Velocidad de habla ajustable', 'Texto a voz en el navegador'];
      }
      if (data && data['@type'] === 'BreadcrumbList' && Array.isArray(data.itemListElement)) {
        data.itemListElement = data.itemListElement.map((item, index) => ({
          ...item,
          name: index === 0 ? 'Inicio' : index === 1 ? (canonical.includes('/guides/') ? 'Guías' : 'Ejercicios de escucha') : visibleCrumb,
        }));
      }
      const visit = (value, key = '') => {
        if (Array.isArray(value)) return value.map(item => visit(item, key));
        if (!value || typeof value !== 'object') {
          if (key === 'inLanguage' && value === 'en') return 'es';
          if ((key === 'url' || key === 'item') && typeof value === 'string' && value.startsWith(SITE + '/')) {
            return value.replace(SITE + '/', SITE + '/es/');
          }
          return value;
        }
        return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, visit(childValue, childKey)]));
      };
      return `<script type="application/ld+json">${JSON.stringify(visit(data))}</script>`;
    } catch {
      return full;
    }
  });
  if (!localized.includes('hreflang="en"')) {
    localized = localized.replace('</head>', `<link rel="alternate" hreflang="en" href="${canonical}"><link rel="alternate" hreflang="es" href="${spanishCanonical}"><link rel="alternate" hreflang="x-default" href="${canonical}">\n</head>`);
  }
  return localized
    .replace(/href="\/resources\//g, 'href="/es/resources/')
    .replace(/href="\/guides\//g, 'href="/es/guides/')
    .replace(/href="\/levels\//g, 'href="/es/levels/')
    .replace(/href="\/topics\//g, 'href="/es/topics/')
    .replace(/<button class="lang-btn active" data-lang="en">EN<\/button>/, '<button class="lang-btn" data-lang="en">EN</button>')
    .replace(/<button class="lang-btn" data-lang="es">ES<\/button>/, '<button class="lang-btn active" data-lang="es">ES</button>');
}

function renderLocalizedHeader(spanishUrl, englishUrl) {
  const pathname = new URL(spanishUrl).pathname;
  const active = pathname.includes('/resources/') ? 'resources'
    : pathname.includes('/guides') ? 'guides'
      : pathname.includes('/levels') ? 'levels'
        : pathname.includes('/about') ? 'about'
          : pathname.includes('/contact') ? 'contact' : '';
  const nav = [
    ['resources', '/es/resources/listening-exercises/', 'Ejercicios'],
    ['guides', '/es/guides/', 'Guías'],
    ['levels', '/es/levels/a1/', 'Niveles'],
    ['', '/es/#how-it-works', 'Cómo funciona'],
    ['', '/es/#faq', 'Preguntas'],
    ['about', '/es/about.html', 'Acerca de'],
    ['contact', '/es/contact.html', 'Contacto'],
  ].map(([key, href, label]) => `<a href="${href}"${key && key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ');
  return `<header class="site">
  <a href="/es/" class="logo">Listening<span>Classroom</span></a>
  <div class="header-right">
    <nav class="site-nav" aria-label="Principal">${nav}</nav>
    <div class="lang-switcher"><a class="lang-btn" href="${englishUrl}" lang="en">EN</a><a class="lang-btn active" href="${spanishUrl}" lang="es" aria-current="page">ES</a></div>
  </div>
</header>`;
}

function renderLocalizedFooter() {
  return `<footer class="site">
  <p>© ${new Date().getFullYear()} ListeningClassroom.com · Herramienta de texto a voz y recursos de escucha en inglés</p>
  <p class="links">
    <a href="/es/resources/listening-exercises/">Ejercicios</a> ·
    <a href="/es/guides/">Guías</a> ·
    <a href="/es/levels/a1/">Niveles</a> ·
    <a href="/es/generator/">Generador</a> ·
    <a href="/es/about.html">Acerca de</a> ·
    <a href="/es/contact.html">Contacto</a> ·
    <a href="/es/privacy.html">Privacidad</a> ·
    <a href="/es/terms.html">Términos</a>
  </p>
</footer>`;
}

async function writeSpanishVariant(englishPath) {
  const spanishPath = spanishPathFromEnglish(englishPath);
  const source = readText(englishPath);
  await writeIfChanged(spanishPath, renderSpanishDocument(source));
  return spanishPath;
}

async function writeManualSpanishVariant(englishPath, titleEs, descriptionEs, spanishPath = null) {
  const source = readText(englishPath)
    .replace('<html lang="en">', `<html lang="en" data-es-title="${attrEscape(titleEs)}" data-es-description="${attrEscape(descriptionEs)}">`);
  const outputPath = spanishPath || spanishPathFromEnglish(englishPath);
  await writeIfChanged(outputPath, renderSpanishDocument(source));
  return outputPath;
}

async function writeGeneratorSpanishVariant() {
  const sourcePath = path.join(ROOT, 'generator/index.html');
  const outputPath = path.join(ROOT, 'es/generator/index.html');
  const canonical = `${SITE}/generator/`;
  const spanishCanonical = `${SITE}/es/generator/`;
  const title = 'Generador de diálogos en inglés — Audio MP3 con dos voces | ListeningClassroom';
  const description = 'Crea audio de diálogos en inglés con dos voces, ajusta la velocidad y descarga un archivo MP3 para clases y actividades de escucha.';
  let source = readText(sourcePath)
    .replace('<html lang="en">', '<html lang="es">')
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]+">/, `<link rel="canonical" href="${spanishCanonical}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${spanishCanonical}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${description}">`)
    .replace(/"description": "Free English text-to-speech and dialogue generator for ESL teachers\. Assign two voices to a conversation and download the result as an MP3 audio file\.",/, `"description": "${description}",`)
    .replace(/"url": "https:\/\/listeningclassroom\.com\/generator\/"/, `"url": "${spanishCanonical}"`)
    .replace(/"audienceType": "Teachers, ESL educators"/, '"audienceType": "Docentes y estudiantes de inglés"')
    .replace(/"featureList": \["Two-voice English dialogue generation", "Downloadable MP3 audio", "Adjustable speech speed", "Browser-based text to speech"\]/,
      '"inLanguage": "es", "featureList": ["Generación de diálogos en inglés con dos voces", "Descarga de audio MP3", "Velocidad de habla ajustable", "Texto a voz en el navegador"]')
    .replace('</head>', `<link rel="alternate" hreflang="en" href="${canonical}"><link rel="alternate" hreflang="es" href="${spanishCanonical}"><link rel="alternate" hreflang="x-default" href="${canonical}">\n</head>`)
    .replace("let currentLang = localStorage.getItem('lang') || 'en';", "let currentLang = localStorage.getItem('lang') || 'es';")
    .replace(/href="\/resources\//g, 'href="/es/resources/')
    .replace(/href="\/guides\//g, 'href="/es/guides/')
    .replace(/href="\/levels\//g, 'href="/es/levels/')
    .replace(/href="\/about\.html"/g, 'href="/es/about.html"')
    .replace(/href="\/contact\.html"/g, 'href="/es/contact.html"');
  await writeIfChanged(outputPath, source);
}

function renderHeader(current = '') {
  const isActive = (key) => current === key ? ' aria-current="page"' : '';
  const navLinksEn = `
      <a href="/resources/listening-exercises/"${isActive('resources')}>Exercises</a>
      <a href="/guides/"${isActive('guides')}>Guides</a>
      <a href="/levels/a1/"${isActive('levels')}>Levels</a>
      <a href="/#how-it-works">How it works</a>
      <a href="/#faq">FAQ</a>
      <a href="/about.html"${isActive('about')}>About</a>
      <a href="/contact.html"${isActive('contact')}>Contact</a>`;
  const navLinksEs = `
      <a href="/resources/listening-exercises/"${isActive('resources')}>Ejercicios</a>
      <a href="/guides/"${isActive('guides')}>Guías</a>
      <a href="/levels/a1/"${isActive('levels')}>Niveles</a>
      <a href="/#how-it-works">Cómo funciona</a>
      <a href="/#faq">Preguntas</a>
      <a href="/about.html"${isActive('about')}>Acerca de</a>
      <a href="/contact.html"${isActive('contact')}>Contacto</a>`;
  return `
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site">
  <a href="/" class="logo">Listening<span>Classroom</span></a>
  <div class="header-right">
    <div class="lang-content lang-en">
      <nav class="site-nav" aria-label="Main">${navLinksEn}
      </nav>
    </div>
    <div class="lang-content lang-es" hidden>
      <nav class="site-nav" aria-label="Principal">${navLinksEs}
      </nav>
    </div>
    <div class="lang-switcher">
      <button class="lang-btn active" data-lang="en">EN</button>
      <button class="lang-btn" data-lang="es">ES</button>
    </div>
  </div>
</header>`;
}

function renderFooter() {
  return `
<footer class="site">
  <p>© ${new Date().getFullYear()} ListeningClassroom.com · Free text-to-speech for educators</p>
  <p class="links">
    <a href="/resources/listening-exercises/">Exercises</a> ·
    <a href="/guides/">Guides</a> ·
    <a href="/levels/a1/">Levels</a> ·
    <a href="/generator/">Generator</a> ·
    <a href="/about.html">About</a> ·
    <a href="/contact.html">Contact</a> ·
    <a href="/privacy.html">Privacy</a> ·
    <a href="/terms.html">Terms</a>
  </p>
</footer>`;
}

function breadcrumbsJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

function pageWrap({ current, bodyEn, bodyEs, jsonLd = [] }) {
  return `${renderHeader(current)}
<main id="main">
<div class="lang-content lang-en">${bodyEn}</div>
<div class="lang-content lang-es" hidden>${bodyEs}</div>
</main>
${renderFooter()}
${TOGGLE_JS}
</body>
</html>`;
}

function dialogueToString(dialogue) {
  return dialogue.map(d => `Speaker ${d.speaker}: ${d.text}`).join('\n');
}

// ── Page renderers ──────────────────────────────────────────────────────────

let guideExerciseCatalog = [];

function renderExerciseBlock(ex, lang) {
  const ui = UI[lang];
  const title = (lang === 'es' && ex.es?.title) ? ex.es.title : ex.title;
  const description = (lang === 'es' && ex.es?.description) ? ex.es.description : ex.description;
  const topicName = (lang === 'es' && ex.es?.topicName) ? ex.es.topicName : ex.topicName;
  const vocab = (lang === 'es' && ex.es?.vocabulary) ? ex.es.vocabulary : ex.vocabulary;
  const questions = (lang === 'es' && ex.es?.questions) ? ex.es.questions : ex.questions;
  const trueFalse = (lang === 'es' && ex.es?.trueFalse) ? ex.es.trueFalse : ex.trueFalse;
  const tips = (lang === 'es' && ex.es?.teacherTips) ? ex.es.teacherTips : ex.teacherTips;
  const learningObjectives = lang === 'es' ? ex.es?.learningObjectives : ex.learningObjectives;
  const beforeListening = lang === 'es' ? ex.es?.beforeListening : ex.beforeListening;
  const extensionActivity = lang === 'es' ? ex.es?.extensionActivity : ex.extensionActivity;

  const homeCrumb = lang === 'es' ? 'Inicio' : 'Home';
  const breadcrumbHtml = `
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">${homeCrumb}</a><span class="sep">/</span>
  <a href="/resources/listening-exercises/">${ui.listeningExercises}</a><span class="sep">/</span>
  <span aria-current="page">${htmlEscape(title)}</span>
</nav>`;

  const vocabHtml = (vocab && vocab.length) ? `
<section class="exercise-block">
  <h2>${ui.vocabulary}</h2>
  <div class="vocab-list">
    ${vocab.map(v => `
      <div class="vocab-item">
        <span class="word">${htmlEscape(v.word)}</span>
        <span class="def">${htmlEscape(v.definition)}</span>
      </div>`).join('')}
  </div>
</section>` : '';

  const dialogueText = dialogueToString(ex.dialogue || []);
  const dialogueHtml = `
<section class="exercise-block">
  <h2>${ui.transcript}</h2>
  <div class="dialogue-block">
    ${ex.dialogue.map(d => `
      <div class="dialogue-line speaker-${d.speaker}">
        <span class="who">Speaker ${d.speaker}</span>
        <span class="text">${htmlEscape(d.text)}</span>
      </div>`).join('')}
  </div>
  <div class="dialogue-actions">
    <button type="button" class="btn-generate" data-generate-text="${attrEscape(dialogueText)}">
      ${ui.openInGenerator}
    </button>
    <a class="btn-generate" href="/generator/">${ui.openGenerator}</a>
  </div>
</section>
  <div class="ad-slot" data-slot="exercises-after-dialogue"><span class="ad-label">${ui.advertisement}</span></div>`;

  const focusHtml = (learningObjectives && learningObjectives.length) ? `
<section class="exercise-block">
  <h2>${ui.learningFocus}</h2>
  <ul>${learningObjectives.map(item => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
</section>` : '';

  const beforeHtml = (beforeListening && beforeListening.length) ? `
<section class="exercise-block">
  <h2>${lang === 'es' ? 'Antes de escuchar' : 'Before listening'}</h2>
  <ul>${beforeListening.map(item => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
</section>` : '';

  const questionsHtml = (questions && questions.length) ? `
<section class="exercise-block">
  <h2>${ui.comprehensionQuestions}</h2>
  ${questions.map((q, i) => `
    <div class="question">
      <div class="q-text">${i + 1}. ${htmlEscape(q.q)}</div>
      <ol class="options">
        ${q.options.map(o => `<li>${htmlEscape(o)}</li>`).join('')}
      </ol>
    </div>`).join('')}
</section>` : '';

  const tfHtml = (trueFalse && trueFalse.length) ? `
<section class="exercise-block">
  <h2>${ui.trueFalse}</h2>
  ${trueFalse.map(tf => `
    <div class="tf-item">
      <div class="statement">${htmlEscape(tf.statement)}</div>
      <div class="answer">${tf.answer ? ui.trueAnswer : ui.falseAnswer} — ${htmlEscape(tf.explanation)}</div>
    </div>`).join('')}
</section>` : '';

  const tipsHtml = (tips && tips.length) ? `
<section class="tips-block">
  <h2>${ui.teacherTips}</h2>
  <ul>
    ${tips.map(t => `<li>${htmlEscape(t)}</li>`).join('')}
  </ul>
</section>` : '';

  const answersHtml = (questions && questions.length) ? `
<section class="exercise-block answer-key">
  <h2>${ui.answerKey}</h2>
  <ol>${questions.map(q => `<li>${htmlEscape(q.options[q.answer])}</li>`).join('')}</ol>
</section>` : '';

  const extensionHtml = (extensionActivity && extensionActivity.length) ? `
<section class="exercise-block">
  <h2>${lang === 'es' ? 'Actividad de ampliación' : 'Extension activity'}</h2>
  <ul>${extensionActivity.map(item => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
</section>` : '';

  const teachingGuide = ['at-school', 'at-the-supermarket', 'daily-routine', 'introducing-yourself', 'my-family', 'weekend-plans'].includes(ex.slug)
    ? 'how-to-build-listening-activities-for-a1-and-a2-students'
    : 'how-to-create-listening-exercises-for-esl-students';
  const guideLink = `<section class="exercise-block related-guide"><h2>${lang === 'es' ? 'Idea para docentes' : 'Teaching idea'}</h2><p>${lang === 'es' ? 'Consulta la guía sobre ' : 'See our guide to '}<a href="/guides/${teachingGuide}/">${lang === 'es' ? 'diseñar actividades de escucha' : 'designing listening activities'}</a>.</p></section>`;

  const relatedHtml = (ex.relatedExercises && ex.relatedExercises.length) ? `
<section class="exercise-block">
  <h2>${ui.relatedExercises}</h2>
  <div class="related-grid">
    ${ex.relatedExercises.map(r => `<a class="resource-card" href="/resources/listening-exercises/${r}/">
      <div class="meta"><span class="badge">${ui.continuePractising}</span></div>
      <h3>${htmlEscape(titleCaseSlug(r))}</h3>
    </a>`).join('')}
  </div>
</section>` : '';

  const levelLabel = lang === 'es' ? `Nivel ${ex.level.toUpperCase()}` : `Level ${ex.level.toUpperCase()}`;

  return `
${breadcrumbHtml}
<article>
  <header class="exercise-header">
    <h1>${htmlEscape(title)}</h1>
    <p>${htmlEscape(description || '')}</p>
    <div class="meta-row">
      <a class="badge level-${ex.level}" href="/levels/${ex.level}/">${levelLabel}</a>
      <a class="badge topic" href="/topics/${ex.topic}/">${htmlEscape(topicName || ex.topic)}</a>
      ${ex.duration ? `<span class="duration">⏱ ${htmlEscape(lang === 'es' ? ex.duration.replace(/\bminutes?\b/gi, 'minutos') : ex.duration)}</span>` : ''}
    </div>
  </header>
  ${vocabHtml}
  ${focusHtml}
  ${beforeHtml}
  ${dialogueHtml}
  ${questionsHtml}
  ${tfHtml}
  ${answersHtml}
  ${tipsHtml}
  ${extensionHtml}
  ${guideLink}
  <div class="ad-slot" data-slot="exercises-after-questions"><span class="ad-label">${ui.advertisement}</span></div>
  ${relatedHtml}
</article>`;
}

function renderExercise(ex) {
  const url = `${SITE}/resources/listening-exercises/${ex.slug}/`;
  const titleEn = `${ex.title} — ${ex.level.toUpperCase()} English Listening Exercise`;
  const titleEs = `${ex.es?.title || ex.title} — Ejercicio de escucha en inglés ${ex.level.toUpperCase()}`;
  const descriptionEn = ex.description || ex.summary || `Practice English listening with this ${ex.level.toUpperCase()} exercise: ${ex.title}.`;
  const descriptionEs = ex.es?.description || ex.es?.summary || `Practica la escucha en inglés con este ejercicio de nivel ${ex.level.toUpperCase()}: ${ex.es?.title || ex.title}.`;

  const breadcrumbsLd = breadcrumbsJsonLd([
    { name: 'Home', url: SITE + '/' },
    { name: 'Listening Exercises', url: SITE + '/resources/listening-exercises/' },
    { name: ex.title, url },
  ]);

  const educationalLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: ex.title,
    description: ex.description,
    educationalLevel: ex.level.toUpperCase(),
    learningResourceType: 'Listening exercise',
    inLanguage: 'en',
    isAccessibleForFree: true,
    url,
    provider: { '@type': 'Organization', name: 'ListeningClassroom', url: SITE },
    teaches: ex.topicName || ex.topic,
  };

  return renderHead({
    titleEn, titleEs, descriptionEn, descriptionEs,
    canonical: url,
    ogType: 'article',
    jsonLd: [educationalLd, breadcrumbsLd],
  }) + pageWrap({
    current: 'resources',
    bodyEn: renderExerciseBlock(ex, 'en'),
    bodyEs: renderExerciseBlock(ex, 'es'),
    jsonLd: [],
  });
}

function renderExerciseCard(e, lang) {
  const title = (lang === 'es' && e.es?.title) ? e.es.title : e.title;
  const summary = (lang === 'es' && e.es?.summary) ? e.es.summary : e.summary;
  const topicName = (lang === 'es' && e.es?.topicName) ? e.es.topicName : e.topicName;
  return `<a class="resource-card" href="/resources/listening-exercises/${e.slug}/">
  <div class="meta">
    <span class="badge level-${e.level}">${e.level.toUpperCase()}</span>
    <span class="badge topic">${htmlEscape(topicName || e.topic)}</span>
  </div>
  <h3>${htmlEscape(title)}</h3>
  <p>${htmlEscape(summary || '')}</p>
</a>`;
}

function renderExerciseIndexBlock(exercises, lang) {
  const ui = UI[lang];
  const byLevel = { a1: [], a2: [], b1: [] };
  exercises.forEach(e => { if (byLevel[e.level]) byLevel[e.level].push(e); });

  const homeCrumb = lang === 'es' ? 'Inicio' : 'Home';
  const heroTitle = lang === 'es'
    ? 'Ejercicios de escucha en inglés por nivel'
    : 'English Listening Exercises by Level';
  const heroLead = lang === 'es'
    ? 'Ejercicios de escucha gratuitos listos para el aula. Cada diálogo se abre directamente en el generador de audio para que ajustes voz y velocidad, y luego descargues el MP3 para tu clase.'
    : 'Free, classroom-ready listening practice. Each dialogue opens directly in the audio generator so you can adjust voice and speed, then download the MP3 for your lesson.';

  return `
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">${homeCrumb}</a><span class="sep">/</span>
  <span aria-current="page">${ui.listeningExercises}</span>
</nav>
<header class="hero">
  <span class="eyebrow">${ui.listeningExercises}</span>
  <h1>${heroTitle}</h1>
  <p class="lead">${heroLead}</p>
</header>

${['a1', 'a2', 'b1'].map(lvl => `
<section class="section">
  <h2>${ui.levels} ${lvl.toUpperCase()} <span class="count">${ui.exercisesCount(byLevel[lvl].length)}</span></h2>
  <div class="card-grid">${byLevel[lvl].map(e => renderExerciseCard(e, lang)).join('')}</div>
</section>`).join('')}

<div class="ad-slot" data-slot="resource-index-bottom"><span class="ad-label">${ui.advertisement}</span></div>`;
}

function renderExerciseIndex(exercises) {
  const url = `${SITE}/resources/listening-exercises/`;
  const titleEn = 'English Listening Exercises by Level (A1, A2, B1) — Free';
  const titleEs = 'Ejercicios de escucha en inglés por nivel (A1, A2, B1) — Gratis';
  const descriptionEn = 'Browse free English listening exercises organised by CEFR level. Each dialogue can be opened in the audio generator and downloaded as MP3.';
  const descriptionEs = 'Explora ejercicios de escucha gratuitos en inglés organizados por nivel MCER. Cada diálogo se puede abrir en el generador de audio y descargar como MP3.';

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'English Listening Exercises',
    itemListElement: exercises.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/resources/listening-exercises/${e.slug}/`,
      name: e.title,
    })),
  };

  return renderHead({
    titleEn, titleEs, descriptionEn, descriptionEs,
    canonical: url,
    jsonLd: [itemListLd, breadcrumbsJsonLd([
      { name: 'Home', url: SITE + '/' },
      { name: 'Listening Exercises', url },
    ])],
  }) + pageWrap({
    current: 'resources',
    bodyEn: renderExerciseIndexBlock(exercises, 'en'),
    bodyEs: renderExerciseIndexBlock(exercises, 'es'),
    jsonLd: [],
  });
}

function renderLevelBlock(levelMeta, exercises, lang) {
  const ui = UI[lang];
  const lvl = levelMeta.id;
  const displayName = (lang === 'es' && levelMeta.es) ? levelMeta.es.nameLong : levelMeta.nameLong;
  const displayDesc = (lang === 'es' && levelMeta.es) ? levelMeta.es.description : levelMeta.description;
  const filtered = exercises.filter(e => e.level === lvl);
  const homeCrumb = lang === 'es' ? 'Inicio' : 'Home';
  const emptyMsg = lang === 'es' ? 'Aún no hay ejercicios en este nivel. Vuelve pronto.' : 'No exercises yet at this level. Check back soon.';

  return `
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">${homeCrumb}</a><span class="sep">/</span>
  <a href="/resources/listening-exercises/">${ui.listeningExercises}</a><span class="sep">/</span>
  <span aria-current="page">${htmlEscape(levelMeta.code)}</span>
</nav>
<header class="hero">
  <span class="eyebrow">${ui.levels} ${levelMeta.code}</span>
  <h1>${htmlEscape(displayName)}</h1>
  <p class="lead">${htmlEscape(displayDesc)}</p>
</header>

<section class="section">
  <h2>${ui.availableExercises} <span class="count">${filtered.length}</span></h2>
  ${filtered.length ? `<div class="card-grid">${filtered.map(e => renderExerciseCard(e, lang)).join('')}</div>` : `<p>${emptyMsg}</p>`}
</section>

<div class="ad-slot" data-slot="level-bottom"><span class="ad-label">${ui.advertisement}</span></div>`;
}

function renderLevel(levelMeta, exercises) {
  const url = `${SITE}/levels/${levelMeta.id}/`;
  const hasExercises = exercises.some(e => e.level === levelMeta.id);
  const titleEn = `${levelMeta.code} English Listening Exercises — Free Dialogues`;
  const titleEs = `Ejercicios de escucha ${levelMeta.code} — Diálogos gratis`;
  const descriptionEn = `Free ${levelMeta.code} English listening exercises. ${levelMeta.description} Open any dialogue in the audio generator and download as MP3.`;
  const descriptionEs = `Ejercicios de escucha ${levelMeta.code} gratis. ${(levelMeta.es && levelMeta.es.description) || levelMeta.description} Abre cualquier diálogo en el generador de audio y descárgalo como MP3.`;

  return renderHead({
    titleEn, titleEs, descriptionEn, descriptionEs,
    canonical: url,
    jsonLd: [breadcrumbsJsonLd([
      { name: 'Home', url: SITE + '/' },
      { name: 'Listening Exercises', url: SITE + '/resources/listening-exercises/' },
      { name: levelMeta.code, url },
    ])],
    robots: hasExercises ? 'index, follow' : 'noindex, follow',
  }) + pageWrap({
    current: 'levels',
    bodyEn: renderLevelBlock(levelMeta, exercises, 'en'),
    bodyEs: renderLevelBlock(levelMeta, exercises, 'es'),
    jsonLd: [],
  });
}

function renderTopicBlock(topicMeta, exercises, lang, topicContent = null) {
  const ui = UI[lang];
  const id = topicMeta.id;
  const displayName = (lang === 'es' && topicMeta.es) ? topicMeta.es.name : topicMeta.name;
  const displayDesc = (lang === 'es' && topicMeta.es) ? topicMeta.es.description : topicMeta.description;
  const filtered = exercises.filter(e => e.topic === id);
  const homeCrumb = lang === 'es' ? 'Inicio' : 'Home';
  const emptyMsg = lang === 'es' ? 'Aún no hay ejercicios para este tema. Vuelve pronto.' : 'No exercises yet for this topic. Check back soon.';
  const editorial = topicContent?.[lang];
  const editorialHtml = editorial ? `
<section class="section topic-editorial">
  <h2>${htmlEscape(editorial.heading)}</h2>
  ${editorial.paragraphs.map(paragraph => `<p>${htmlEscape(paragraph)}</p>`).join('\n  ')}
  <h3>${htmlEscape(editorial.skillsHeading)}</h3>
  <ul>${editorial.skills.map(skill => `<li>${htmlEscape(skill)}</li>`).join('')}</ul>
  <p><a href="/guides/${editorial.guideSlug}/">${htmlEscape(editorial.guideLinkText)}</a></p>
</section>` : '';

  return `
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">${homeCrumb}</a><span class="sep">/</span>
  <a href="/resources/listening-exercises/">${ui.listeningExercises}</a><span class="sep">/</span>
  <span aria-current="page">${htmlEscape(displayName)}</span>
</nav>
<header class="hero">
  <span class="eyebrow">${ui.topic}</span>
  <h1>${htmlEscape(displayName)}</h1>
  <p class="lead">${htmlEscape(displayDesc)}</p>
</header>

${editorialHtml}

<section class="section">
  <h2>${ui.exercises} <span class="count">${filtered.length}</span></h2>
  ${filtered.length ? `<div class="card-grid">${filtered.map(e => renderExerciseCard(e, lang)).join('')}</div>` : `<p>${emptyMsg}</p>`}
</section>

<div class="ad-slot" data-slot="topic-bottom"><span class="ad-label">${ui.advertisement}</span></div>`;
}

function renderTopic(topicMeta, exercises, topicContent = null) {
  const url = `${SITE}/topics/${topicMeta.id}/`;
  const displayNameEn = topicMeta.name;
  const displayNameEs = (topicMeta.es && topicMeta.es.name) || topicMeta.name;
  const titleEn = `${displayNameEn} — English Listening Exercises`;
  const titleEs = `${displayNameEs} — Ejercicios de escucha en inglés`;
  const descriptionEn = `${topicMeta.description} Browse free English listening exercises on the topic of ${displayNameEn.toLowerCase()}.`;
  const descriptionEs = `${(topicMeta.es && topicMeta.es.description) || topicMeta.description} Explora ejercicios de escucha en inglés gratis sobre ${displayNameEs.toLowerCase()}.`;

  return renderHead({
    titleEn, titleEs, descriptionEn, descriptionEs,
    canonical: url,
    jsonLd: [breadcrumbsJsonLd([
      { name: 'Home', url: SITE + '/' },
      { name: 'Listening Exercises', url: SITE + '/resources/listening-exercises/' },
      { name: displayNameEn, url },
    ])],
  }) + pageWrap({
    current: 'resources',
    bodyEn: renderTopicBlock(topicMeta, exercises, 'en', topicContent),
    bodyEs: renderTopicBlock(topicMeta, exercises, 'es', topicContent),
    jsonLd: [],
  });
}

function renderGuideBlock(g, lang) {
  const ui = UI[lang];
  const useEs = lang === 'es' && g._esBody;
  const title = useEs && g._esMeta?.title ? g._esMeta.title : g.title;
  const description = useEs && g._esMeta?.description ? g._esMeta.description : g.description;
  const readingTime = useEs && g._esMeta?.readingTime ? g._esMeta.readingTime : g.readingTime;
  const date = g.date;
  const bodySource = (useEs ? g._esBody : g._body).replace(/^\s*#\s+.*\n/, '');
  const html = renderMarkdown(bodySource);
  const recommendations = {
    'how-to-build-listening-activities-for-a1-and-a2-students': ['at-school', 'daily-routine', 'at-the-restaurant'],
    'how-to-create-dictation-activities': ['daily-routine', 'weekend-plans', 'at-the-airport'],
    'how-to-create-listening-exercises-for-esl-students': ['asking-for-directions', 'at-the-restaurant', 'making-a-complaint'],
    'how-to-practice-english-pronunciation-with-audio': ['introducing-yourself', 'giving-advice', 'job-interview'],
    'how-to-use-text-to-speech-in-english-classes': ['at-school', 'at-the-restaurant', 'job-interview'],
  }[g.slug] || [];
  const relatedExercises = recommendations
    .map(slug => guideExerciseCatalog.find(exercise => exercise.slug === slug))
    .filter(Boolean);
  const relatedHeading = lang === 'es' ? 'Práctica relacionada' : 'Related listening practice';
  const generatorText = lang === 'es' ? 'Crear audio para otra actividad' : 'Create audio for another activity';
  const homeCrumb = lang === 'es' ? 'Inicio' : 'Home';
  const readingLabel = lang === 'es' ? 'de lectura' : 'read';

  return `
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">${homeCrumb}</a><span class="sep">/</span>
  <a href="/guides/">${ui.guides}</a><span class="sep">/</span>
  <span aria-current="page">${htmlEscape(title)}</span>
</nav>
<article class="guide-article">
  <header>
    <h1>${htmlEscape(title)}</h1>
    <p class="lead" style="color: var(--muted); max-width: none; margin: 0 0 1rem 0;">${htmlEscape(description || '')}</p>
    <div class="guide-meta">
      ${readingTime ? `<span>${htmlEscape(readingTime)} ${readingLabel}</span>` : ''}
      ${g.level && g.level !== 'all' ? `<span>${lang === 'es' ? `Para profesores de ${g.level.toUpperCase()}` : `For ${g.level.toUpperCase()} teachers`}</span>` : ''}
      ${g.level === 'all' ? `<span>${lang === 'es' ? 'Para todos los docentes' : 'For all teachers'}</span>` : ''}
      ${date ? `<span>${htmlEscape(date)}</span>` : ''}
    </div>
  </header>
  ${html}
  <section class="section related-guide-resources">
    <h2>${relatedHeading}</h2>
    <div class="card-grid">${relatedExercises.map(ex => `<a class="resource-card" href="/resources/listening-exercises/${ex.slug}/"><div class="meta"><span class="badge level-${ex.level}">${ex.level.toUpperCase()}</span></div><h3>${htmlEscape(lang === 'es' ? (ex.es?.title || ex.title) : ex.title)}</h3><p>${htmlEscape(lang === 'es' ? (ex.es?.summary || ex.summary) : ex.summary)}</p></a>`).join('')}</div>
    <p><a href="/generator/">${generatorText}</a></p>
  </section>
</article>
<div class="ad-slot" data-slot="guide-bottom"><span class="ad-label">${ui.advertisement}</span></div>`;
}

function renderGuide(g) {
  const url = `${SITE}/guides/${g.slug}/`;
  const titleEn = `${g.title} — ListeningClassroom`;
  const titleEs = `${(g._esMeta?.title) || g.title} — ListeningClassroom`;
  const descriptionEn = g.description || g.title;
  const descriptionEs = (g._esMeta?.description) || g.description || titleEs;

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    inLanguage: 'en',
    url,
    publisher: { '@type': 'Organization', name: 'ListeningClassroom', url: SITE },
    datePublished: g.date || new Date().toISOString().slice(0, 10),
  };

  return renderHead({
    titleEn, titleEs, descriptionEn, descriptionEs,
    canonical: url,
    ogType: 'article',
    jsonLd: [articleLd, breadcrumbsJsonLd([
      { name: 'Home', url: SITE + '/' },
      { name: 'Guides', url: SITE + '/guides/' },
      { name: g.title, url },
    ])],
  }) + pageWrap({
    current: 'guides',
    bodyEn: renderGuideBlock(g, 'en'),
    bodyEs: renderGuideBlock(g, 'es'),
    jsonLd: [],
  });
}

function renderGuideIndexBlock(guides, lang) {
  const ui = UI[lang];
  const list = guides.map(g => {
    const useEs = lang === 'es' && g._esBody;
    const title = useEs && g._esMeta?.title ? g._esMeta.title : g.title;
    const readingTime = useEs && g._esMeta?.readingTime ? g._esMeta.readingTime : g.readingTime;
    return `<a class="list-row" href="/guides/${g.slug}/">
  <span>${htmlEscape(title)}</span>
  <span class="meta">${readingTime ? htmlEscape(readingTime) : ''}</span>
</a>`;
  }).join('');
  const homeCrumb = lang === 'es' ? 'Inicio' : 'Home';
  const titleH1 = lang === 'es' ? 'Guías didácticas de escucha para ESL' : 'ESL Listening Teaching Guides';
  const lead = lang === 'es'
    ? 'Guías prácticas para usar audio y texto a voz en la enseñanza del inglés. Pensadas para docentes que quieren métodos claros, no artículos genéricos.'
    : 'Practical guides for using audio and text-to-speech in English language teaching. Built for teachers who want clear methods, not generic SEO articles.';

  return `
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">${homeCrumb}</a><span class="sep">/</span>
  <span aria-current="page">${ui.guides}</span>
</nav>
<header class="hero">
  <span class="eyebrow">${lang === 'es' ? 'Guías didácticas' : 'Teaching Guides'}</span>
  <h1>${titleH1}</h1>
  <p class="lead">${lead}</p>
</header>

<section class="section">
  <h2>${ui.allGuides} <span class="count">${guides.length}</span></h2>
  ${list}
</section>`;
}

function renderGuideIndex(guides) {
  const url = `${SITE}/guides/`;
  const titleEn = 'ESL Teaching Guides — ListeningClassroom';
  const titleEs = 'Guías didácticas para docentes de ESL — ListeningClassroom';
  const descriptionEn = 'Practical guides for ESL teachers on listening exercises, dictation, pronunciation, and using text-to-speech in the classroom.';
  const descriptionEs = 'Guías prácticas para docentes de ESL sobre ejercicios de escucha, dictado, pronunciación y uso de texto a voz en el aula.';

  return renderHead({
    titleEn, titleEs, descriptionEn, descriptionEs,
    canonical: url,
    jsonLd: [breadcrumbsJsonLd([
      { name: 'Home', url: SITE + '/' },
      { name: 'Guides', url },
    ])],
  }) + pageWrap({
    current: 'guides',
    bodyEn: renderGuideIndexBlock(guides, 'en'),
    bodyEs: renderGuideIndexBlock(guides, 'es'),
    jsonLd: [],
  });
}

// ── Sitemap + robots ────────────────────────────────────────────────────────
function renderSitemap(urls) {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u === SITE + '/' || u === SITE + '/generator/' ? 'weekly' : 'monthly'}</changefreq>
  </url>`).join('\n')}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
}

async function validateGeneratedPages() {
  const roots = ['resources', 'levels', 'topics', 'guides', 'es'];
  const files = [];
  async function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) files.push(file);
    }
  }
  for (const root of roots) await walk(path.join(ROOT, root));
  for (const file of ['index.html', 'generator/index.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html']) {
    const absolute = path.join(ROOT, file);
    if (existsSync(absolute)) files.push(absolute);
  }

  const failures = [];
  const internalTarget = (raw, sourceFile) => {
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(raw)) return null;
    let parsed;
    try { parsed = new URL(raw, `${SITE}/${path.relative(ROOT, sourceFile).replace(/\\/g, '/')}`); }
    catch { return null; }
    if (parsed.origin !== new URL(SITE).origin) return null;
    let pathname;
    try { pathname = decodeURIComponent(parsed.pathname); }
    catch { return `${sourceFile}: invalid encoded URL ${raw}`; }
    const target = path.resolve(ROOT, `.${pathname}`);
    if (!target.startsWith(ROOT + path.sep) && target !== ROOT) return `${sourceFile}: target escapes site root: ${raw}`;
    let targetFile = target;
    if (existsSync(targetFile) && statSync(targetFile).isDirectory()) targetFile = path.join(targetFile, 'index.html');
    else if (!path.extname(targetFile)) targetFile = path.join(targetFile, 'index.html');
    if (!existsSync(targetFile)) return `${path.relative(ROOT, sourceFile)}: broken link ${raw}`;
    return null;
  };
  for (const file of files) {
    const html = readText(file);
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    const spanish = relative === 'es' || relative.startsWith('es/');
    const required = [
      ['title', /<title>[^<]+<\/title>/],
      ['description', /<meta name="description" content="[^"]+">/],
      ['canonical', /<link rel="canonical" href="https:\/\/listeningclassroom\.com\//],
      ['h1', /<h1[\s>]/],
    ];
    if (spanish) required.push(
      ['lang=es', /<html lang="es">/],
      ['hreflang=en', /hreflang="en"/],
      ['hreflang=es', /hreflang="es"/],
      ['hreflang=x-default', /hreflang="x-default"/],
    );
    for (const [label, pattern] of required) {
      if (!pattern.test(html)) failures.push(`${relative}: missing ${label}`);
    }
    for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      try { JSON.parse(match[1]); }
      catch { failures.push(`${relative}: invalid JSON-LD`); }
    }
    for (const match of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
      const problem = internalTarget(match[1], file);
      if (problem) failures.push(problem);
    }
  }
  if (failures.length) throw new Error(`Generated-page validation failed:\n${failures.join('\n')}`);
  log(`Validated metadata, JSON-LD and local links in ${files.length} site HTML pages.`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  log(`Site base: ${SITE}`);
  log(`Dry run: ${DRY_RUN}`);

  const exercises = await loadExercises();
  guideExerciseCatalog = exercises;
  const guides = await loadGuides();
  const levels = await readJson(path.join(ROOT, 'data', 'levels.json'));
  const topics = await readJson(path.join(ROOT, 'data', 'topics.json'));
  const topicContent = await readJson(path.join(ROOT, 'data', 'topic-content.json'));
  const pedagogy = await readJson(path.join(ROOT, 'data', 'pedagogy.json'));
  const pedagogyEs = await readJson(path.join(ROOT, 'data', 'pedagogy.es.json'));
  for (const ex of exercises) {
    const additions = pedagogy[ex.slug];
    if (additions) Object.assign(ex, additions);
    if (pedagogyEs[ex.slug]) ex.es = { ...(ex.es || {}), ...pedagogyEs[ex.slug] };
  }

  log(`Loaded ${exercises.length} exercises, ${guides.length} guides, ${levels.levels.length} levels, ${topics.topics.length} topics.`);

  const urls = new Set();
  urls.add(`${SITE}/`);
  urls.add(`${SITE}/generator/`);
  urls.add(`${SITE}/about.html`);
  urls.add(`${SITE}/contact.html`);
  urls.add(`${SITE}/privacy.html`);
  urls.add(`${SITE}/terms.html`);

  // Manual pages already contain reviewed Spanish content. Publish separate
  // Spanish documents while keeping the existing English URLs stable.
  const manualSpanish = [
    ['index.html', 'ListeningClassroom — Audio y ejercicios de escucha en inglés', 'Genera audio de diálogos en inglés con dos voces y explora ejercicios gratuitos de escucha organizados por nivel.', 'es/index.html', `${SITE}/es/`],
    ['about.html', 'Acerca de ListeningClassroom — Proyecto independiente', 'Conoce ListeningClassroom, un proyecto independiente con una herramienta de texto a voz y recursos de escucha en inglés.', 'es/about.html', `${SITE}/es/about.html`],
    ['contact.html', 'Contacto — ListeningClassroom', 'Contacta con ListeningClassroom para enviar comentarios, preguntas o informes sobre la herramienta de audio y los recursos.', 'es/contact.html', `${SITE}/es/contact.html`],
    ['privacy.html', 'Política de privacidad — ListeningClassroom', 'Consulta cómo ListeningClassroom gestiona los datos, las cookies, la analítica y los servicios publicitarios.', 'es/privacy.html', `${SITE}/es/privacy.html`],
    ['terms.html', 'Términos de uso — ListeningClassroom', 'Condiciones de uso de la herramienta de texto a voz y los recursos educativos de ListeningClassroom.', 'es/terms.html', `${SITE}/es/terms.html`],
  ];
  for (const [file, titleEs, descriptionEs, output, url] of manualSpanish) {
    await writeManualSpanishVariant(path.join(ROOT, file), titleEs, descriptionEs, path.join(ROOT, output));
    urls.add(url);
  }
  await writeGeneratorSpanishVariant();
  urls.add(`${SITE}/es/generator/`);

  // Resource index
  const idxPath = path.join(ROOT, 'resources/listening-exercises/index.html');
  await writeIfChanged(idxPath, renderExerciseIndex(exercises));
  urls.add(`${SITE}/resources/listening-exercises/`);
  await writeSpanishVariant(idxPath);
  urls.add(`${SITE}/es/resources/listening-exercises/`);

  // Each exercise
  for (const ex of exercises) {
    const p = path.join(ROOT, 'resources/listening-exercises', ex.slug, 'index.html');
    await writeIfChanged(p, renderExercise(ex));
    urls.add(`${SITE}/resources/listening-exercises/${ex.slug}/`);
    await writeSpanishVariant(p);
    urls.add(`${SITE}/es/resources/listening-exercises/${ex.slug}/`);
  }

  // Each level
  for (const lvl of levels.levels) {
    const p = path.join(ROOT, 'levels', lvl.id, 'index.html');
    await writeIfChanged(p, renderLevel(lvl, exercises));
    // Only add to sitemap if there are exercises at this level.
    if (exercises.some(e => e.level === lvl.id)) {
      urls.add(`${SITE}/levels/${lvl.id}/`);
      urls.add(`${SITE}/es/levels/${lvl.id}/`);
    }
    // Empty levels remain noindex but their Spanish counterpart keeps links
    // from other level navigation valid without entering the sitemap.
    await writeSpanishVariant(p);
  }

  // Each topic (only those with exercises)
  const seenTopics = new Set(exercises.map(e => e.topic));
  for (const t of topics.topics) {
    if (!seenTopics.has(t.id)) continue;
    const p = path.join(ROOT, 'topics', t.id, 'index.html');
    await writeIfChanged(p, renderTopic(t, exercises, topicContent[t.id]));
    urls.add(`${SITE}/topics/${t.id}/`);
    await writeSpanishVariant(p);
    urls.add(`${SITE}/es/topics/${t.id}/`);
  }

  // Guides index + each guide
  const gIdx = path.join(ROOT, 'guides/index.html');
  await writeIfChanged(gIdx, renderGuideIndex(guides));
  urls.add(`${SITE}/guides/`);
  await writeSpanishVariant(gIdx);
  urls.add(`${SITE}/es/guides/`);
  for (const g of guides) {
    const p = path.join(ROOT, 'guides', g.slug, 'index.html');
    await writeIfChanged(p, renderGuide(g));
    urls.add(`${SITE}/guides/${g.slug}/`);
    await writeSpanishVariant(p);
    urls.add(`${SITE}/es/guides/${g.slug}/`);
  }

  // Sitemap
  const sortedUrls = [...urls].sort();
  await writeIfChanged(path.join(ROOT, 'sitemap.xml'), renderSitemap(sortedUrls));
  log(`Wrote sitemap.xml with ${sortedUrls.length} URLs.`);

  await validateGeneratedPages();

  // robots.txt
  await writeIfChanged(path.join(ROOT, 'robots.txt'), renderRobots());

  // Manifest (used by homepage generator if needed)
  const manifest = {
    site: SITE,
    generatedAt: new Date().toISOString(),
    counts: {
      exercises: exercises.length,
      guides: guides.length,
      levels: levels.levels.length,
      topics: topics.topics.length,
    },
    exercises: exercises.map(e => ({
      slug: e.slug,
      title: e.title,
      titleEs: e.es?.title,
      level: e.level,
      topic: e.topic,
      topicName: e.topicName,
      summary: e.summary,
    })),
    guides: guides.map(g => ({ slug: g.slug, title: g.title, description: g.description, readingTime: g.readingTime })),
    levels: levels.levels,
    topics: topics.topics,
  };
  await ensureDir(path.join(ROOT, 'data'));
  await fs.writeFile(path.join(ROOT, 'data', 'manifest.json'), JSON.stringify(manifest, null, 2));

  log('Build complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
