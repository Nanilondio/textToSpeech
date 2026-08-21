/* ─────────────────────────────────────────────────────────────
   ListeningClassroom — shared client-side helpers
   - AdSlot: reusable placeholder, no-op until enabled
   - Generator integration: pre-fill dialogue from sessionStorage
   - Small UX polish (consent already lives in /consent.js)
   ───────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── AdSlot: no-op by default, real only when .enabled ── */
  // To enable AdSense later:
  //   1. Add the AdSense script to <head>.
  //   2. Set window.LC_ADSENSE = { enabled: true, slot: '1234567890' }
  //   3. Mark any ad-slot container with class "enabled" and data-slot="…".
  function initAdSlots() {
    var slots = document.querySelectorAll('.ad-slot');
    if (!slots.length) return;

    var config = window.LC_ADSENSE || {};
    if (!config.enabled) {
      // Keep hidden — no layout shift, no fake ads.
      return;
    }

    slots.forEach(function (slot) {
      if (!slot.classList.contains('enabled')) return;
      slot.style.display = 'block';
      slot.innerHTML = '';
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.style.width = '100%';
      ins.dataset.adClient = config.client || 'ca-pub-7086938365759492';
      ins.dataset.adSlot = slot.dataset.slot || config.slot || '';
      ins.dataset.adFormat = slot.dataset.adFormat || 'auto';
      ins.dataset.fullWidthResponsive = 'true';
      slot.appendChild(ins);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) { /* ignore */ }
    });
  }

  /* ── Generator integration via sessionStorage ── */
  // Usage in any page:
  //   <button class="btn-generate" data-generate='{"dialogue":"Speaker 1: ...\nSpeaker 2: ..."}'>Open in Generator</button>
  //   <a class="btn-generate" data-generate-href="/some/slug">Open in Generator</a>
  //   <a class="btn-generate" data-generate-text="Speaker 1: ...">Open in Generator</a>
  function bindGeneratorTriggers() {
    var triggers = document.querySelectorAll('[data-generate], [data-generate-text], [data-generate-href]');
    if (!triggers.length) return;

    triggers.forEach(function (el) {
      el.addEventListener('click', function (e) {
        var dialogue = null;
        var filename = null;

        var dataGenerate = el.getAttribute('data-generate');
        if (dataGenerate) {
          try {
            var parsed = JSON.parse(dataGenerate);
            dialogue = parsed.dialogue || parsed.text || null;
            filename = parsed.filename || null;
          } catch (err) {
            // Fall back to raw text
            dialogue = dataGenerate;
          }
        }

        if (!dialogue) {
          var dt = el.getAttribute('data-generate-text');
          if (dt) {
            // Defensive: decode literal "\n" / "\t" sequences if a build
            // accidentally JSON-stringified the value into the attribute.
            dialogue = dt
              .replace(/\\r\\n/g, '\n')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t');
          }
        }

        if (!dialogue) {
          var href = el.getAttribute('data-generate-href');
          if (href) {
            // Look up the dialogue text from a global registry if provided
            var registry = window.LC_DIALOGUES || {};
            var entry = registry[href];
            if (entry && entry.dialogue) {
              dialogue = entry.dialogue;
              filename = filename || entry.filename || null;
            }
          }
        }

        if (!dialogue) return; // No data — let the link behave normally.

        e.preventDefault();

        try {
          sessionStorage.setItem('lc:pending_dialogue', dialogue);
          if (filename) sessionStorage.setItem('lc:pending_filename', filename);
          sessionStorage.setItem('lc:pending_ts', String(Date.now()));
        } catch (err) {
          // sessionStorage may be unavailable — fall back to query param.
          var url = new URL('/generator/', window.location.origin);
          url.searchParams.set('text', dialogue);
          if (filename) url.searchParams.set('name', filename);
          window.location.href = url.toString();
          return;
        }

        window.location.href = '/generator/';
      });
    });
  }

  /* ── Lazy-load placeholder for above-the-fold image fallbacks (no-op here) ── */

  /* ── Init ── */
  function init() {
    initAdSlots();
    bindGeneratorTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
