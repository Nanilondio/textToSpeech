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
import { readFileSync, existsSync } from 'node:fs';
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

function renderHead({ titleEn, titleEs, descriptionEn, descriptionEs, canonical, jsonLd = [], extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-KTXQJMMH');</script>
  <!-- End Google Tag Manager -->
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-E1D8VDYM6D"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-E1D8VDYM6D');
  </script>
<meta charset="UTF-8">
<meta name="google-adsense-account" content="ca-pub-7086938365759492">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="index, follow">
<title>${htmlEscape(titleEn)}</title>
<meta name="description" content="${htmlEscape(descriptionEn)}">
<link rel="canonical" href="${htmlEscape(canonical)}">
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
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KTXQJMMH"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
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

function renderExerciseBlock(ex, lang) {
  const ui = UI[lang];
  const title = (lang === 'es' && ex.es?.title) ? ex.es.title : ex.title;
  const description = (lang === 'es' && ex.es?.description) ? ex.es.description : ex.description;
  const topicName = (lang === 'es' && ex.es?.topicName) ? ex.es.topicName : ex.topicName;
  const vocab = (lang === 'es' && ex.es?.vocabulary) ? ex.es.vocabulary : ex.vocabulary;
  const questions = (lang === 'es' && ex.es?.questions) ? ex.es.questions : ex.questions;
  const trueFalse = (lang === 'es' && ex.es?.trueFalse) ? ex.es.trueFalse : ex.trueFalse;
  const tips = (lang === 'es' && ex.es?.teacherTips) ? ex.es.teacherTips : ex.teacherTips;

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
  <h2>${ui.dialogue}</h2>
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

  const questionsHtml = (questions && questions.length) ? `
<section class="exercise-block">
  <h2>${ui.comprehensionQuestions}</h2>
  ${questions.map((q, i) => `
    <div class="question">
      <div class="q-text">${i + 1}. ${htmlEscape(q.q)}</div>
      <ol class="options">
        ${q.options.map(o => `<li>${htmlEscape(o)}</li>`).join('')}
      </ol>
      <div class="answer">${htmlEscape(q.options[q.answer])}</div>
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
      <span class="badge level-${ex.level}">${levelLabel}</span>
      <span class="badge topic">${htmlEscape(topicName || ex.topic)}</span>
      ${ex.duration ? `<span class="duration">⏱ ${htmlEscape(ex.duration)}</span>` : ''}
    </div>
  </header>
  ${vocabHtml}
  ${dialogueHtml}
  ${questionsHtml}
  ${tfHtml}
  ${tipsHtml}
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
  }) + pageWrap({
    current: 'levels',
    bodyEn: renderLevelBlock(levelMeta, exercises, 'en'),
    bodyEs: renderLevelBlock(levelMeta, exercises, 'es'),
    jsonLd: [],
  });
}

function renderTopicBlock(topicMeta, exercises, lang) {
  const ui = UI[lang];
  const id = topicMeta.id;
  const displayName = (lang === 'es' && topicMeta.es) ? topicMeta.es.name : topicMeta.name;
  const displayDesc = (lang === 'es' && topicMeta.es) ? topicMeta.es.description : topicMeta.description;
  const filtered = exercises.filter(e => e.topic === id);
  const homeCrumb = lang === 'es' ? 'Inicio' : 'Home';
  const emptyMsg = lang === 'es' ? 'Aún no hay ejercicios para este tema. Vuelve pronto.' : 'No exercises yet for this topic. Check back soon.';

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

<section class="section">
  <h2>${ui.exercises} <span class="count">${filtered.length}</span></h2>
  ${filtered.length ? `<div class="card-grid">${filtered.map(e => renderExerciseCard(e, lang)).join('')}</div>` : `<p>${emptyMsg}</p>`}
</section>

<div class="ad-slot" data-slot="topic-bottom"><span class="ad-label">${ui.advertisement}</span></div>`;
}

function renderTopic(topicMeta, exercises) {
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
    bodyEn: renderTopicBlock(topicMeta, exercises, 'en'),
    bodyEs: renderTopicBlock(topicMeta, exercises, 'es'),
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
    author: { '@type': 'Organization', name: 'ListeningClassroom', url: SITE },
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
    ? 'Guías prácticas, probadas en el aula, para usar audio y texto a voz en la enseñanza del inglés. Escritas para docentes que quieren métodos claros, no artículos SEO genéricos.'
    : 'Practical, classroom-tested guides for using audio and text-to-speech in English language teaching. Built for teachers who want clear methods, not generic SEO articles.';

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

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  log(`Site base: ${SITE}`);
  log(`Dry run: ${DRY_RUN}`);

  const exercises = await loadExercises();
  const guides = await loadGuides();
  const levels = await readJson(path.join(ROOT, 'data', 'levels.json'));
  const topics = await readJson(path.join(ROOT, 'data', 'topics.json'));

  log(`Loaded ${exercises.length} exercises, ${guides.length} guides, ${levels.levels.length} levels, ${topics.topics.length} topics.`);

  const urls = new Set();
  urls.add(`${SITE}/`);
  urls.add(`${SITE}/generator/`);

  // Resource index
  const idxPath = path.join(ROOT, 'resources/listening-exercises/index.html');
  await writeIfChanged(idxPath, renderExerciseIndex(exercises));
  urls.add(`${SITE}/resources/listening-exercises/`);

  // Each exercise
  for (const ex of exercises) {
    const p = path.join(ROOT, 'resources/listening-exercises', ex.slug, 'index.html');
    await writeIfChanged(p, renderExercise(ex));
    urls.add(`${SITE}/resources/listening-exercises/${ex.slug}/`);
  }

  // Each level
  for (const lvl of levels.levels) {
    const p = path.join(ROOT, 'levels', lvl.id, 'index.html');
    await writeIfChanged(p, renderLevel(lvl, exercises));
    urls.add(`${SITE}/levels/${lvl.id}/`);
  }

  // Each topic (only those with exercises)
  const seenTopics = new Set(exercises.map(e => e.topic));
  for (const t of topics.topics) {
    if (!seenTopics.has(t.id)) continue;
    const p = path.join(ROOT, 'topics', t.id, 'index.html');
    await writeIfChanged(p, renderTopic(t, exercises));
    urls.add(`${SITE}/topics/${t.id}/`);
  }

  // Guides index + each guide
  const gIdx = path.join(ROOT, 'guides/index.html');
  await writeIfChanged(gIdx, renderGuideIndex(guides));
  urls.add(`${SITE}/guides/`);
  for (const g of guides) {
    const p = path.join(ROOT, 'guides', g.slug, 'index.html');
    await writeIfChanged(p, renderGuide(g));
    urls.add(`${SITE}/guides/${g.slug}/`);
  }

  // Sitemap
  const sortedUrls = [...urls].sort();
  await writeIfChanged(path.join(ROOT, 'sitemap.xml'), renderSitemap(sortedUrls));
  log(`Wrote sitemap.xml with ${sortedUrls.length} URLs.`);

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
