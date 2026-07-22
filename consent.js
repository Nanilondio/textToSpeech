(() => {
  const STORAGE_KEY = 'lc_cookie_consent';
  const ADSENSE_CLIENT = 'ca-pub-7086938365759492';
  const I18N = {
    en: {
      ariaLabel: 'Cookie consent',
      title: 'Cookies for ads and measurement',
      copy: 'We use cookies for AdSense and basic analytics so we can keep the site free. You can accept or continue without non-essential cookies. See our Privacy Policy for details.',
      reject: 'Reject non-essential',
      accept: 'Accept cookies',
      privacy: 'Privacy Policy',
    },
    es: {
      ariaLabel: 'Consentimiento de cookies',
      title: 'Cookies para anuncios y medición',
      copy: 'Usamos cookies para AdSense y analítica básica para mantener el sitio gratuito. Puedes aceptar o continuar sin cookies no esenciales. Consulta nuestra Política de Privacidad para más detalles.',
      reject: 'Rechazar no esenciales',
      accept: 'Aceptar cookies',
      privacy: 'Política de Privacidad',
    },
  };

  const state = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const saveState = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore storage failures and keep the page usable.
    }
  };

  const currentLang = () => {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && I18N[saved]) return saved;
    } catch {
      // Ignore storage failures and fall back to the document language.
    }

    const docLang = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
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
      .lc-consent-copy {
        display: grid;
        gap: 0.35rem;
      }
      .lc-consent-copy strong {
        font-size: 0.96rem;
        color: #f0f6fc;
      }
      .lc-consent-copy p {
        margin: 0;
        font-size: 0.88rem;
        color: #9da7b1;
      }
      .lc-consent-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }
      .lc-consent-actions button,
      .lc-consent-actions a {
        border-radius: 10px;
        padding: 0.72rem 1rem;
        font: inherit;
        font-size: 0.88rem;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
      }
      .lc-consent-actions button:hover,
      .lc-consent-actions a:hover {
        transform: translateY(-1px);
      }
      .lc-consent-accept {
        background: #58a6ff;
        color: #0d1117;
        border: 1px solid #58a6ff;
      }
      .lc-consent-reject {
        background: transparent;
        color: #e6edf3;
        border: 1px solid rgba(125, 133, 144, 0.4);
      }
      .lc-consent-link {
        color: #9ecbff;
        border: 1px solid rgba(125, 133, 144, 0.2);
      }
      @media (min-width: 700px) {
        .lc-consent-card {
          grid-template-columns: 1fr auto;
          align-items: center;
        }
        .lc-consent-actions {
          justify-content: flex-end;
        }
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

  const loadMarketingScripts = async () => {
    if (window.__lcMarketingLoaded) return;
    window.__lcMarketingLoaded = true;

    await loadScript(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`,
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

  const accept = async () => {
    saveState('accepted');
    hideBanner();
    await loadMarketingScripts();
    window.dispatchEvent(new CustomEvent('lc-consent:accepted'));
  };

  const reject = () => {
    saveState('rejected');
    hideBanner();
    window.dispatchEvent(new CustomEvent('lc-consent:rejected'));
  };

  const buildBanner = () => {
    if (document.getElementById('lc-consent-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'lc-consent-banner';
    banner.className = 'lc-consent-banner';
    banner.innerHTML = `
      <div class="lc-consent-card" role="dialog" aria-live="polite">
        <div class="lc-consent-copy">
          <strong></strong>
          <p></p>
        </div>
        <div class="lc-consent-actions">
          <button type="button" class="lc-consent-reject"></button>
          <button type="button" class="lc-consent-accept"></button>
          <a class="lc-consent-link" href="privacy.html"></a>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    updateBannerLanguage();
    banner.querySelector('.lc-consent-accept').addEventListener('click', accept);
    banner.querySelector('.lc-consent-reject').addEventListener('click', reject);
  };

  const updateBannerLanguage = () => {
    const banner = document.getElementById('lc-consent-banner');
    if (!banner) return;

    const t = I18N[currentLang()];
    banner.querySelector('.lc-consent-card').setAttribute('aria-label', t.ariaLabel);
    banner.querySelector('.lc-consent-copy strong').textContent = t.title;
    banner.querySelector('.lc-consent-copy p').textContent = t.copy;
    banner.querySelector('.lc-consent-reject').textContent = t.reject;
    banner.querySelector('.lc-consent-accept').textContent = t.accept;
    banner.querySelector('.lc-consent-link').textContent = t.privacy;
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
    bindLanguageUpdates();

    const consent = state();
    if (consent === 'accepted') {
      await loadMarketingScripts();
      hideBanner();
      return;
    }

    if (consent === 'rejected') {
      hideBanner();
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
