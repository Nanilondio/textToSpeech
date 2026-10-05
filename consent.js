(() => {
  const STORAGE_KEY = 'lc_cookie_consent';
  const ADSENSE_CLIENT = 'ca-pub-7086938365759492';
  const GA4_ID = 'G-E1D8VDYM6D';
  const GTM_ID = 'GTM-KTXQJMMH';
  const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

  const I18N = {
    en: {
      ariaLabel: 'Cookie consent',
      title: 'Cookies for ads and measurement',
      copy: 'This site only loads Google Tag Manager, Google Analytics and Google AdSense after you accept non-essential cookies. You can keep using the tool without accepting. See our Privacy Policy for details.',
      reject: 'Reject non-essential',
      limited: 'Limit personalised ads',
      accept: 'Accept cookies',
      privacy: 'Privacy Policy',
      manage: 'Cookies',
      manageTitle: 'Manage cookie preferences',
      ccpa: 'Do Not Sell or Share My Personal Information',
      ccpaCopy: 'California residents: we do not sell or share your personal information. Choose "Limit personalised ads" to opt out of personalised advertising through Google.',
      confirmLimited: 'Personalised ads are off. Manage your choice from the cookies button at any time.',
      saved: 'Preference saved.',
    },
    es: {
      ariaLabel: 'Consentimiento de cookies',
      title: 'Cookies para anuncios y medición',
      copy: 'Este sitio solo carga Google Tag Manager, Google Analytics y Google AdSense después de que aceptes las cookies no esenciales. Puedes seguir usando la herramienta sin aceptarlas. Consulta nuestra Política de Privacidad para más detalles.',
      reject: 'Rechazar no esenciales',
      limited: 'Limitar anuncios personalizados',
      accept: 'Aceptar cookies',
      privacy: 'Política de Privacidad',
      manage: 'Cookies',
      manageTitle: 'Gestionar preferencias de cookies',
      ccpa: 'No vender ni compartir mi información personal',
      ccpaCopy: 'Residentes de California: no vendemos ni compartimos tu información personal. Elige "Limitar anuncios personalizados" para excluirte de la publicidad personalizada de Google.',
      confirmLimited: 'Los anuncios personalizados están desactivados. Cambia tu elección desde el botón de cookies en cualquier momento.',
      saved: 'Preferencia guardada.',
    },
  };

  const detectRegion = () => {
    let tz = '';
    try {
      tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    } catch { tz = ''; }
    const isEU = tz.startsWith('europe/') || tz === 'atlantic/reykjavik';
    const isCA = tz === 'america/los_angeles'
      || tz === 'america/ensenada'
      || tz === 'america/tijuana'
      || tz === 'pst8pdt';
    return { isEU, isCA };
  };

  const state = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { parsed = { value: raw, at: null }; }
      if (!parsed.value) return null;
      if (parsed.value === 'accepted' && parsed.at) {
        const age = Date.now() - new Date(parsed.at).getTime();
        if (!Number.isFinite(age) || age > CONSENT_MAX_AGE_MS) return null;
      }
      return parsed.value;
    } catch {
      return null;
    }
  };

  const saveState = (value) => {
    try {
      const payload = JSON.stringify({ value, at: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // Ignore storage failures and keep the page usable.
    }
  };

  const currentLang = () => {
    const docLang = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
    if (docLang === 'es') return 'es';

    try {
      const saved = localStorage.getItem('lang');
      if (saved && I18N[saved]) return saved;
    } catch {
      // Ignore storage failures and fall back to the document language.
    }

    return I18N[docLang] ? docLang : 'en';
  };

  const injectStyle = () => {
    if (document.getElementById('lc-consent-style')) return;
    const style = document.createElement('style');
    style.id = 'lc-consent-style';
    style.textContent = `
      .lc-consent-banner {
        position: fixed;
        left: 1rem;
        right: 1rem;
        bottom: 1rem;
        z-index: 1000;
        display: none;
        justify-content: center;
        pointer-events: none;
      }
      .lc-consent-banner.is-visible { display: flex; }
      .lc-consent-card {
        width: min(100%, 920px);
        background: rgba(13, 17, 23, 0.96);
        color: #e6edf3;
        border: 1px solid rgba(88, 166, 255, 0.25);
        border-radius: 16px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(14px);
        padding: 1rem 1.1rem;
        display: grid;
        gap: 0.85rem;
        pointer-events: auto;
      }
      .lc-consent-copy { display: grid; gap: 0.35rem; }
      .lc-consent-copy strong { font-size: 0.96rem; color: #f0f6fc; }
      .lc-consent-copy p { margin: 0; font-size: 0.88rem; color: #9da7b1; }
      .lc-consent-ccpa { font-size: 0.82rem; color: #9da7b1; border-top: 1px solid rgba(125, 133, 144, 0.25); padding-top: 0.6rem; }
      .lc-consent-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }
      .lc-consent-actions button,
      .lc-consent-actions a {
        border-radius: 10px;
        padding: 0.72rem 1.15rem;
        font: inherit;
        font-size: 0.88rem;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        border: 1px solid transparent;
        transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        min-width: 9.5rem;
        text-align: center;
      }
      .lc-consent-actions button:hover,
      .lc-consent-actions a:hover { transform: translateY(-1px); }
      .lc-consent-accept {
        background: #58a6ff;
        color: #0d1117;
        border-color: #58a6ff;
      }
      .lc-consent-reject,
      .lc-consent-limited {
        background: transparent;
        color: #e6edf3;
        border-color: rgba(125, 133, 144, 0.55);
      }
      .lc-consent-link {
        color: #9ecbff;
        border-color: rgba(125, 133, 144, 0.2);
        background: transparent;
      }
      @media (min-width: 700px) {
        .lc-consent-card { grid-template-columns: 1fr auto; align-items: center; }
        .lc-consent-actions { justify-content: flex-end; }
      }

      .lc-consent-manage {
        position: fixed;
        bottom: 1rem;
        left: 1rem;
        z-index: 999;
        height: 40px;
        min-width: 40px;
        padding: 0 0.85rem;
        border-radius: 999px;
        border: 1px solid rgba(125, 133, 144, 0.45);
        background: rgba(13, 17, 23, 0.94);
        color: #e6edf3;
        font: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        display: none;
        align-items: center;
        gap: 0.4rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .lc-consent-manage.is-visible { display: inline-flex; }
      .lc-consent-manage:hover { transform: translateY(-1px); background: rgba(22, 27, 34, 0.96); }
      .lc-consent-manage::before { content: '🍪'; font-size: 1rem; }

      .lc-consent-ccpa-bar {
        position: fixed;
        left: 1rem;
        right: 1rem;
        bottom: 4.25rem;
        z-index: 998;
        display: none;
        justify-content: center;
        pointer-events: none;
      }
      .lc-consent-ccpa-bar.is-visible { display: flex; }
      .lc-consent-ccpa-card {
        pointer-events: auto;
        width: min(100%, 920px);
        background: rgba(13, 17, 23, 0.92);
        color: #9da7b1;
        border: 1px solid rgba(125, 133, 144, 0.25);
        border-radius: 12px;
        padding: 0.55rem 0.9rem;
        font-size: 0.8rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem 1rem;
        align-items: center;
        justify-content: space-between;
      }
      .lc-consent-ccpa-card a {
        color: #9ecbff;
        text-decoration: underline;
        cursor: pointer;
        background: transparent;
        border: 0;
        font: inherit;
        font-size: 0.8rem;
        padding: 0;
      }
    `;
    document.head.appendChild(style);
  };

  const loadScript = (src, attrs = {}) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) script.setAttribute(key, value);
    });
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const loadMarketingScripts = async ({ nonPersonalized = false } = {}) => {
    if (window.__lcMarketingLoaded) return;
    window.__lcMarketingLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    await loadScript(
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`,
      { 'data-lc-consent': 'accepted' }
    );

    await loadScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`
    );
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    const adStorage = nonPersonalized ? 'denied' : 'granted';
    const adUserData = nonPersonalized ? 'denied' : 'granted';
    const adPersonalization = nonPersonalized ? 'denied' : 'granted';
    window.gtag('consent', 'update', {
      ad_storage: adStorage,
      ad_user_data: adUserData,
      ad_personalization: adPersonalization,
      analytics_storage: nonPersonalized ? 'denied' : 'granted',
    });
    window.gtag('config', GA4_ID);

    const adsenseParams = new URLSearchParams({ client: ADSENSE_CLIENT });
    if (nonPersonalized) adsenseParams.set('npa', '1');
    await loadScript(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?${adsenseParams.toString()}`,
      { crossorigin: 'anonymous' }
    );
  };

  const hideBanner = () => {
    const banner = document.getElementById('lc-consent-banner');
    if (banner) banner.classList.remove('is-visible');
  };

  const showBanner = () => {
    const banner = document.getElementById('lc-consent-banner');
    if (banner) banner.classList.add('is-visible');
  };

  const hideManage = () => {
    const manage = document.getElementById('lc-consent-manage');
    if (manage) manage.classList.remove('is-visible');
  };

  const showManage = () => {
    const manage = document.getElementById('lc-consent-manage');
    if (manage) manage.classList.add('is-visible');
  };

  const hideCcpa = () => {
    const bar = document.getElementById('lc-consent-ccpa');
    if (bar) bar.classList.remove('is-visible');
  };

  const showCcpa = () => {
    const bar = document.getElementById('lc-consent-ccpa');
    if (bar) bar.classList.add('is-visible');
  };

  const accept = async () => {
    saveState('accepted');
    hideBanner();
    await loadMarketingScripts();
    showManage();
    window.dispatchEvent(new CustomEvent('lc-consent:accepted'));
  };

  const reject = () => {
    saveState('rejected');
    hideBanner();
    showManage();
    window.dispatchEvent(new CustomEvent('lc-consent:rejected'));
  };

  const acceptLimited = async () => {
    saveState('limited');
    hideBanner();
    showManage();
    await loadMarketingScripts({ nonPersonalized: true });
    window.dispatchEvent(new CustomEvent('lc-consent:limited'));
  };

  const buildBanner = () => {
    if (document.getElementById('lc-consent-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'lc-consent-banner';
    banner.className = 'lc-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.innerHTML = `
      <div class="lc-consent-card">
        <div class="lc-consent-copy">
          <strong></strong>
          <p></p>
          <p class="lc-consent-ccpa" data-ccpa hidden></p>
        </div>
        <div class="lc-consent-actions">
          <button type="button" class="lc-consent-reject"></button>
          <button type="button" class="lc-consent-limited" data-limited hidden></button>
          <button type="button" class="lc-consent-accept"></button>
          <a class="lc-consent-link" href="/privacy.html"></a>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    updateBannerLanguage();
    banner.querySelector('.lc-consent-accept').addEventListener('click', accept);
    banner.querySelector('.lc-consent-reject').addEventListener('click', reject);
    const limited = banner.querySelector('.lc-consent-limited');
    if (limited) limited.addEventListener('click', acceptLimited);
  };

  const buildManage = () => {
    if (document.getElementById('lc-consent-manage')) return;
    const button = document.createElement('button');
    button.id = 'lc-consent-manage';
    button.type = 'button';
    button.className = 'lc-consent-manage';
    button.innerHTML = '<span data-manage-label></span>';
    document.body.appendChild(button);
    button.addEventListener('click', () => {
      showBanner();
      hideManage();
      hideCcpa();
    });
    const label = button.querySelector('[data-manage-label]');
    if (label) label.textContent = I18N[currentLang()].manage;
    button.setAttribute('aria-label', I18N[currentLang()].manageTitle);
    button.setAttribute('title', I18N[currentLang()].manageTitle);
  };

  const buildCcpaBar = () => {
    if (document.getElementById('lc-consent-ccpa')) return;
    const bar = document.createElement('div');
    bar.id = 'lc-consent-ccpa';
    bar.className = 'lc-consent-ccpa-bar';
    bar.innerHTML = `
      <div class="lc-consent-ccpa-card">
        <span data-ccpa-copy></span>
        <button type="button" data-ccpa-action></button>
      </div>
    `;
    document.body.appendChild(bar);
    bar.querySelector('[data-ccpa-action]').addEventListener('click', acceptLimited);
  };

  const updateBannerLanguage = () => {
    const banner = document.getElementById('lc-consent-banner');
    if (!banner) return;
    const t = I18N[currentLang()];
    const region = detectRegion();
    banner.querySelector('.lc-consent-card').setAttribute('aria-label', t.ariaLabel);
    banner.querySelector('.lc-consent-copy strong').textContent = t.title;
    banner.querySelector('.lc-consent-copy p:not(.lc-consent-ccpa)').textContent = t.copy;
    banner.querySelector('.lc-consent-reject').textContent = t.reject;
    banner.querySelector('.lc-consent-accept').textContent = t.accept;
    banner.querySelector('.lc-consent-link').textContent = t.privacy;
    const limited = banner.querySelector('.lc-consent-limited');
    if (limited) limited.textContent = t.limited;
    const ccpaEl = banner.querySelector('.lc-consent-ccpa');
    if (ccpaEl) {
      if (region.isCA) {
        ccpaEl.hidden = false;
        ccpaEl.textContent = t.ccpaCopy;
      } else {
        ccpaEl.hidden = true;
      }
    }
    if (limited) limited.hidden = !region.isCA;

    const ccpaBar = document.getElementById('lc-consent-ccpa');
    if (ccpaBar) {
      ccpaBar.querySelector('[data-ccpa-copy]').textContent = t.ccpaCopy;
      ccpaBar.querySelector('[data-ccpa-action]').textContent = t.limited;
    }

    const manage = document.getElementById('lc-consent-manage');
    if (manage) {
      manage.setAttribute('aria-label', t.manageTitle);
      manage.setAttribute('title', t.manageTitle);
      const label = manage.querySelector('[data-manage-label]');
      if (label) label.textContent = t.manage;
    }
  };

  const bindLanguageUpdates = () => {
    document.querySelectorAll('.lang-btn').forEach(button => {
      button.addEventListener('click', () => {
        setTimeout(updateBannerLanguage, 0);
      });
    });
  };

  const init = async () => {
    injectStyle();
    buildBanner();
    buildManage();
    buildCcpaBar();
    bindLanguageUpdates();

    const region = detectRegion();
    const consent = state();
    showManage();

    if (consent === 'accepted') {
      await loadMarketingScripts();
      hideBanner();
      if (region.isCA) showCcpa();
      return;
    }

    if (consent === 'limited') {
      await loadMarketingScripts({ nonPersonalized: true });
      hideBanner();
      return;
    }

    if (consent === 'rejected') {
      hideBanner();
      if (region.isCA) showCcpa();
      return;
    }

    showBanner();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();