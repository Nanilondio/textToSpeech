# 🎙 ListeningClassroom

A free, browser-based English audio generator with a growing library of
classroom-tested listening exercises and teaching guides. Built for ESL
teachers. Deployed on GitHub Pages. **No backend, no database, no
recurring cost.**

The site is **100% static**: HTML, CSS, JavaScript, JSON, and Markdown.
A small Node.js script (run only in CI / locally during development)
generates the per-exercise, per-level and per-topic HTML pages from JSON
content.

> Domain: <https://listeningclassroom.com/>

---

## Table of contents

- [What is this?](#what-is-this)
- [How the site is organised](#how-the-site-is-organised)
- [Adding a new listening exercise](#adding-a-new-listening-exercise)
- [Adding a new teaching guide](#adding-a-new-teaching-guide)
- [Building the site](#building-the-site)
- [Deploying](#deploying)
- [How the exercise → generator integration works](#how-the-exercise--generator-integration-works)
- [SEO and structured data](#seo-and-structured-data)
- [Advertising (AdSense)](#advertising-adsense)
- [Privacy and cookies](#privacy-and-cookies)
- [Project structure](#project-structure)

---

## What is this?

ListeningClassroom started as a single-page tool that turns an English
script into a downloadable MP3, with optional two-voice dialogues. It has
grown into an educational site:

- **The Generator** (`/generator/`) — the original audio tool. Two voices,
  MP3 export, runs entirely in the browser.
- **Listening Exercises** (`/resources/listening-exercises/`) — short
  classroom-ready dialogues organised by level (A1, A2, B1). Each
  exercise includes vocabulary, comprehension questions, true/false,
  teacher tips, and a button that opens the dialogue directly in the
  Generator.
- **Teaching Guides** (`/guides/`) — practical evergreen articles on
  building listening exercises, dictation, pronunciation, and using
  text-to-speech in class.
- **Levels** (`/levels/a1/`, `/levels/a2/`, `/levels/b1/`) — exercises
  grouped by CEFR level.
- **Topics** (`/topics/travel/`, etc.) — exercises grouped by subject.

The Generator remains the centre of the product. The content pages exist
to make the site useful for teachers *between* classes and to give Google
something substantial to index.

---

## How the site is organised

```
/                                  → landing / homepage
/generator/                        → the audio tool (was the old /)
/resources/listening-exercises/    → index of all exercises
/resources/listening-exercises/<slug>/   → one exercise page
/levels/<a1|a2|b1|b2>/             → exercises by level
/topics/<slug>/                    → exercises by topic
/guides/                           → index of guides
/guides/<slug>/                    → one guide
/about.html, /contact.html,
/privacy.html, /terms.html         → legal and contact pages
```

The exercise, level, topic and guide pages are **generated** from JSON
and Markdown files in `/data/` by `scripts/build.mjs`. The homepage and
the Generator are hand-written.

---

## Adding a new listening exercise

You only need to create one file. The build script picks it up
automatically and generates the corresponding HTML page, the listing in
the resource index, the level index, and the topic index. It also adds
the new URL to `sitemap.xml`.

### Step 1 — Create a JSON file

Create a file at:

```
data/exercises/<level>/<slug>.json
```

Where:

- `<level>` is one of `a1`, `a2`, `b1` (or `b2`).
- `<slug>` is a short, URL-safe identifier (lowercase, hyphens only),
  e.g. `at-the-restaurant`.

### Step 2 — Fill the content

Use this template:

```json
{
  "slug": "at-the-restaurant",
  "title": "At the Restaurant",
  "level": "a2",
  "topic": "restaurant",
  "topicName": "Restaurants & Food",
  "category": "listening-exercises",
  "summary": "A customer orders a meal, asks for the bill, and pays with a credit card.",
  "description": "A classic restaurant scenario for elementary learners. Vocabulary covers menu items, polite requests, paying methods, and tipping etiquette.",
  "duration": "2 minutes",
  "vocabulary": [
    { "word": "menu", "definition": "the list of food and drinks available in a restaurant" },
    { "word": "main course", "definition": "the largest part of a meal, usually meat or fish with vegetables" }
  ],
  "dialogue": [
    { "speaker": "1", "text": "Good evening. Do you have a reservation?" },
    { "speaker": "2", "text": "Yes, a table for two, under the name Smith." }
  ],
  "questions": [
    {
      "q": "How many people are at the table?",
      "options": ["One", "Two", "Three"],
      "answer": 1
    }
  ],
  "trueFalse": [
    {
      "statement": "The customer orders grilled chicken.",
      "answer": false,
      "explanation": "The customer orders grilled salmon."
    }
  ],
  "teacherTips": [
    "Pre-teach the difference between 'still water' and 'sparkling water'.",
    "Use this dialogue as a model for polite requests."
  ],
  "relatedExercises": ["at-the-supermarket", "making-an-appointment"]
}
```

Field reference:

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | URL-safe, lowercase, hyphens. Must match the filename. |
| `title` | yes | Display title. |
| `level` | yes | `a1`, `a2`, `b1`, or `b2`. |
| `topic` | yes | Must match a `topic.id` in `data/topics.json`. |
| `topicName` | yes | Display name for the topic. |
| `category` | yes | For now always `listening-exercises`. |
| `summary` | yes | One-sentence summary used in card listings. |
| `description` | yes | One-paragraph description used on the exercise page. |
| `duration` | no | Human-readable, e.g. `"2 minutes"`. |
| `vocabulary` | no | Array of `{ word, definition }` objects. |
| `dialogue` | yes | Array of `{ speaker: "1"\|"2", text }` objects. |
| `questions` | no | Array of `{ q, options, answer }`. `answer` is the index of the correct option. |
| `trueFalse` | no | Array of `{ statement, answer, explanation }`. `answer` is a boolean. |
| `teacherTips` | no | Array of strings. |
| `relatedExercises` | no | Array of slugs that must already exist as exercises. |

### Step 3 — (Optional) Add the topic

If the `topic` you used does not yet exist in `data/topics.json`, add it:

```json
{
  "id": "restaurant",
  "name": "Restaurants & Food",
  "description": "Ordering food, asking about the menu, paying the bill.",
  "levels": ["a2"]
}
```

### Step 4 — Build and test locally

```bash
node scripts/build.mjs
```

This regenerates:

- `/resources/listening-exercises/<slug>/index.html`
- The resource index, level index (if the level is in `data/levels.json`)
  and topic index (if the topic has exercises).
- `/sitemap.xml`
- `/data/manifest.json`

Open the page locally and verify the dialogue, vocabulary, questions
and the "Open in Listening Generator" button work.

### Step 5 — Push

```bash
git add data/exercises/<level>/<slug>.json
git commit -m "Add A2 exercise: At the Restaurant"
git push
```

GitHub Actions runs `node scripts/build.mjs` on every push to `main`,
then publishes the result to GitHub Pages. The new exercise is live in
about 60 seconds.

---

## Adding a new teaching guide

Create a Markdown file at `data/guides/<slug>.md` with this front matter:

```markdown
---
slug: how-to-do-something-useful
title: How to Do Something Useful
description: A one-sentence description used in meta tags and card listings.
topic: teaching-methods
level: all
readingTime: 6 minutes
date: 2026-01-15
---

# How to Do Something Useful

Body content here. Supports:

- Headings (`#`, `##`, `###`).
- Paragraphs.
- Unordered lists (`- item`).
- Ordered lists (`1. item`).
- `**bold**`, `*italic*`, `` `inline code` ``.
- Links: `[text](https://example.com)`.
- Blockquotes (`> text`).

The leading `# Title` is stripped automatically because the page
already shows the title in the article header.
```

Run `node scripts/build.mjs` to generate `/guides/<slug>/index.html`,
update `/guides/` and add the URL to the sitemap.

---

## Building the site

Requirements: **Node.js 20+** (only needed for development / CI; the
runtime site has zero Node.js dependencies).

```bash
node scripts/build.mjs                # build into the current directory
node scripts/build.mjs --dry-run      # parse and report, write nothing
node scripts/build.mjs --base https://listeningclassroom.com
```

The build script:

1. Reads `data/exercises/<level>/*.json`.
2. Reads `data/guides/*.md`.
3. Reads `data/levels.json` and `data/topics.json`.
4. Generates one HTML page per exercise, level, topic and guide.
5. Generates `/sitemap.xml`, `/robots.txt`, and `/data/manifest.json`.

The script has **no npm dependencies** — it uses only built-in Node.js
modules (`fs`, `path`, `url`). It also includes a small Markdown
renderer (about 50 lines) sufficient for the guides.

---

## Deploying

Pushes to `main` trigger `.github/workflows/deploy.yml`, which:

1. Runs `node scripts/build.mjs`.
2. Uploads the resulting static site as a Pages artifact.
3. Deploys it to GitHub Pages.

The custom domain is set via the `CNAME` file.

### Adding a custom domain

Edit `CNAME` (one line, just the domain). The next push will pick it up.

---

## How the exercise → generator integration works

Each exercise page includes an **Open in Listening Generator** button.
When clicked:

1. The button reads `data-generate-text` (the dialogue as plain text
   formatted as `Speaker 1: …\nSpeaker 2: …`).
2. `assets/js/site.js` stores the text in
   `sessionStorage["lc:pending_dialogue"]` and navigates to
   `/generator/`.
3. The Generator page (`generator/index.html`) reads
   `sessionStorage` on load, fills the dialogue textarea, switches to
   dialogue mode, and lets the teacher pick voices and download the MP3.

If `sessionStorage` is unavailable (very rare), the JS falls back to
`/generator/?text=...&name=...` query parameters. The Generator also
reads those on load.

This is fully client-side. There is no server-side state, no shared
storage, no API.

---

## SEO and structured data

Every generated page includes:

- `<title>` and `<meta name="description">`.
- `<link rel="canonical">` pointing to the production URL.
- Open Graph (`og:title`, `og:description`, `og:url`, `og:image`,
  `og:type`).
- Twitter Card (`summary_large_image`).
- Schema.org structured data:
  - `LearningResource` for exercises.
  - `Article` for guides.
  - `BreadcrumbList` on every content page.
  - `ItemList` on the resource index.
  - `WebSite` and `WebApplication` on the homepage.

Sitemap and robots are regenerated automatically on every build.

---

## Advertising (AdSense)

The site is ready for Google AdSense, but **no ads are currently
served**. Each exercise, guide and topic page already has placeholder
`.ad-slot` containers in the right locations:

- After the dialogue.
- After the comprehension questions.
- Before the related exercises.
- At the bottom of long pages.

The slots are hidden by default. To enable them:

1. Add the AdSense `<script>` tag to the `<head>` of `index.html`,
   `generator/index.html`, and any other page.
2. In `assets/js/site.js`, set:
   ```html
   <script>window.LC_ADSENSE = { enabled: true, client: 'ca-pub-XXXXX' };</script>
   ```
3. Mark the slots you want to show with `class="ad-slot enabled"`.

The Generator itself has **no** ad slots — the tool stays clean.

---

## Privacy and cookies

- No student text ever leaves the browser. The audio model runs locally
  via WebAssembly.
- Analytics (GTM, GA4) and AdSense load only **after** the user accepts
  non-essential cookies via the consent banner (`consent.js`).
- `privacy.html` and `terms.html` document what the site does and does
  not collect. Update them before going live with AdSense.

---

## Project structure

```
.
├── index.html                       ← landing / homepage (NEW)
├── generator/
│   └── index.html                   ← the audio tool (moved from /)
├── about.html, contact.html,
│   privacy.html, terms.html         ← unchanged
├── ads.txt                          ← AdSense configuration
├── CNAME                            ← custom domain
├── consent.js                       ← cookie consent banner
├── favicon.svg, logo.svg, logo.png
├── kokoro-worker.js, encode-worker.js
├── vendor/kokoro/                   ← Kokoro TTS model
│
├── data/                            ← content source (EDIT THIS)
│   ├── levels.json
│   ├── topics.json
│   ├── manifest.json                ← generated, used by future homepage variants
│   ├── exercises/
│   │   ├── a1/*.json
│   │   ├── a2/*.json
│   │   ├── b1/*.json
│   │   └── b2/    (future)
│   └── guides/*.md
│
├── scripts/
│   └── build.mjs                    ← static site builder (Node, no deps)
│
├── assets/                          ← shared static assets
│   ├── css/site.css
│   └── js/site.js
│
├── resources/                       ← GENERATED HTML (gitignored?)
│   └── listening-exercises/<slug>/index.html
├── levels/                          ← GENERATED HTML
│   ├── a1/index.html
│   ├── a2/index.html
│   ├── b1/index.html
│   └── b2/index.html
├── topics/                          ← GENERATED HTML
│   └── <slug>/index.html
├── guides/                          ← GENERATED HTML
│   ├── index.html
│   └── <slug>/index.html
│
├── sitemap.xml                      ← GENERATED
├── robots.txt                       ← GENERATED
│
└── .github/workflows/deploy.yml     ← GitHub Actions: build + deploy
```

The generated directories (`resources/`, `levels/`, `topics/`,
`guides/`, plus `sitemap.xml` and `robots.txt`) are produced from
`/data/` on every build. You can either commit them to the repo (so
GitHub Pages serves them directly without running a build step) or add
them to `.gitignore` and rely on the GitHub Actions workflow to build
and deploy.

The default `.github/workflows/deploy.yml` runs the build in CI, so
you can choose either strategy. The included workflow builds before
deploying, which means you do **not** need to commit the generated
HTML.

---

## 🚀 Setup (fresh clone)

```bash
git clone <your-repo>
cd <repo>
node scripts/build.mjs --base https://listeningclassroom.com
python -m http.server 8000   # or any static server
```

Open <http://localhost:8000/>. Click **Open the Audio Generator** to
load `/generator/`. The first audio generation downloads the voice
model (~86 MB) and caches it locally.

---

## License

This project is provided as-is for educational use. The Kokoro TTS
model in `vendor/` is governed by its own licence.
