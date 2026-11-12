(() => {
  const STORAGE_KEY = 'lc_cookie_consent';
  const GA4_ID = 'G-E1D8VDYM6D';
  const GTM_ID = 'GTM-KTXQJMMH';
  const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  const preferencesRoute = () => `${currentLang() === 'es' ? '/es' : ''}/guides/?lc-manage-consent=1`;
  const GOOGLE_CMP_WAIT_MS = 2500;
  const US_GPP_SECTIONS = [
    { id: 7, prefix: 'usnat', fields: ['MspaOptOut'] },
    { id: 8, prefix: 'usca', fields: ['SaleOptOut', 'SharingOptOut'] },
    { id: 9, prefix: 'usva', fields: ['SaleOptOut', 'TargetedAdvertisingOptOut'] },
    { id: 10, prefix: 'usco', fields: ['SaleOptOut', 'TargetedAdvertisingOptOut'] },
    { id: 12, prefix: 'usct', fields: ['SaleOptOut', 'TargetedAdvertisingOptOut'] },
    { id: 13, prefix: 'usfl', fields: ['SaleOptOut', 'TargetedAdvertisingOptOut'] },
  ];
  const MARKETING_SCRIPT_STATE = {
    gtm: 'idle',
    ga4: 'idle',
  };
  const MARKETING_SCRIPT_PROMISES = new Map();
  let googleTagsConfigured = false;
  const hasAdSenseTag = Boolean(document.querySelector('script[src*="adsbygoogle.js"]'));
  const gpcEnabled = window.navigator?.globalPrivacyControl === true;
  const consentAuthorityKey = 'lc_consent_authority';
  const wantsConsentManagement = new URLSearchParams(window.location.search).has('lc-manage-consent');
  let communicatedConsent = window.__lcConsentDefaultsSent ? 'rejected' : null;
  let googleCmpRegion = null;
  let googleCmpDecisionReady = false;
  let googleCmpAnalyticsGranted = false;
  let googleGdprResolved = false;
  let googleGdprApplies = null;
  let googleUsStateResolved = false;
  let usStateApplies = false;
  let googleUsInitialOptedOut = false;
  let usOptedOut = false;
  let gppState = 'unavailable';
  let gppOptOut = null;
  let gppGpcActive = false;
  let gppHasBaseline = false;
  let gppHasObservedReady = false;
  let gppChangePending = false;
  let gppOverridesGoogleInitial = false;
  let gppListenerSetup = false;
  let latestGppPingData = null;
  let communicatedConsentSignals = null;
  let googleConsentModeSignals = null;
  let legacyInitialized = false;
  let revocationRequested = false;
  let supportPageViewSent = false;

  const I18N = {
    en: {
      ariaLabel: 'Cookie consent',
      title: 'Cookies for ads and measurement',
      copy: 'This banner sends Google Consent Mode choices for ads and analytics. On resource pages, the AdSense script may load before you choose; ad requests are paused until the relevant decision is available. See our Privacy Policy for details.',
      reject: 'Reject non-essential',
      limited: 'Allow analytics only',
      accept: 'Accept cookies',
      privacy: 'Privacy Policy',
      manage: 'Cookies',
      manageTitle: 'Privacy and cookie choices',
      analyticsOnly: 'Allow analytics only',
      unavailableCopy: 'Google Privacy & messaging did not return a valid regional decision. Ad requests stay paused; analytics loads only if you allow it.',
      gpcCopy: 'Global Privacy Control is detected. Google advertising and analytics tags stay disabled on this visit.',
      usOptOutCopy: 'Your Google privacy opt-out remains in effect. This choice allows analytics only; Google determines whether non-personalized ads can be served.',
      ccpa: 'Do Not Sell or Share My Personal Information',
      ccpaCopy: 'California residents: this banner sends denied Google ad-consent signals when you reject non-essential cookies, but the AdSense tag may still load.',
      confirmLimited: 'No ad consent was granted. Google may still make limited ad requests. Change your choice from the cookies button at any time.',
      saved: 'Preference saved.',
    },
    es: {
      ariaLabel: 'Consentimiento de cookies',
      title: 'Cookies para anuncios y medición',
      copy: 'Este banner envía a Google las opciones de Consent Mode para anuncios y analítica. En páginas de recursos, el script de AdSense puede cargarse antes de que elijas; las solicitudes publicitarias se pausan hasta que haya una decisión pertinente. Consulta nuestra Política de Privacidad.',
      reject: 'Rechazar no esenciales',
      limited: 'Permitir solo analítica',
      accept: 'Aceptar cookies',
      privacy: 'Política de Privacidad',
      manage: 'Cookies',
      manageTitle: 'Opciones de privacidad y cookies',
      analyticsOnly: 'Permitir solo analítica',
      unavailableCopy: 'Google Privacy & messaging no devolvió una decisión regional válida. Las solicitudes publicitarias permanecen pausadas; la analítica solo se carga si la permites.',
      gpcCopy: 'Se detectó Global Privacy Control. Las etiquetas de publicidad y analítica de Google permanecen desactivadas durante esta visita.',
      usOptOutCopy: 'Tu exclusión de privacidad de Google sigue vigente. Esta opción solo permite analítica; Google determina si puede servir anuncios no personalizados.',
      ccpa: 'No vender ni compartir mi información personal',
      ccpaCopy: 'Residentes de California: al rechazar las cookies no esenciales, este banner envía a Google señales que deniegan el consentimiento publicitario, pero la etiqueta de AdSense puede cargarse.',
      confirmLimited: 'No diste consentimiento publicitario. Google aún podría realizar solicitudes publicitarias limitadas. Cambia tu elección desde el botón de cookies cuando quieras.',
      saved: 'Preferencia guardada.',
    },
  };

  const state = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { parsed = { value: raw, at: null }; }
      if (!['accepted', 'limited', 'rejected'].includes(parsed.value)) return null;
      if (parsed.at) {
        const age = Date.now() - new Date(parsed.at).getTime();
        if (!Number.isFinite(age) || age > CONSENT_MAX_AGE_MS) return null;
      }
      return parsed.value;
    } catch {
      return null;
    }
  };

  const isSupportPage = () => /^\/(?:es\/)?support\/?$/.test(window.location.pathname || '');

  const hasGpcSignal = () => gpcEnabled || gppGpcActive;

  const analyticsAllowed = () => !hasGpcSignal() && (googleCmpRegion === 'europe'
    ? googleCmpAnalyticsGranted
    : ['accepted', 'limited'].includes(state()));

  const trackSupportPageView = () => {
    if (supportPageViewSent || !isSupportPage() || !analyticsAllowed()) return;
    window.gtag('event', 'support_page_view');
    supportPageViewSent = true;
  };

  const bindSupportTracking = () => {
    if (!isSupportPage()) return;
    document.querySelectorAll('[data-support-option]').forEach((link) => {
      link.addEventListener('click', () => {
        if (!analyticsAllowed()) return;
        window.gtag('event', 'support_click', {
          support_option: link.dataset.supportOption,
        });
      });
    });
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

  const ensureGoogleTagStub = () => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
  };

  const consentFor = (value) => {
    const adsAllowed = value === 'accepted'
      && !hasGpcSignal()
      && !usOptedOut
      && googleCmpRegion !== 'unavailable'
      && (!usStateApplies || gppState === 'ready');
    return {
      ad_storage: adsAllowed ? 'granted' : 'denied',
      ad_user_data: adsAllowed ? 'granted' : 'denied',
      ad_personalization: adsAllowed ? 'granted' : 'denied',
      // “limited” limits ads only; it still permits measurement after choice.
      analytics_storage: value !== 'rejected' && !hasGpcSignal() ? 'granted' : 'denied',
    };
  };

  const setConsent = (value, force = false) => {
    if (googleCmpRegion === 'europe') return;
    ensureGoogleTagStub();
    const signals = consentFor(value);
    if (!force
      && communicatedConsent === value
      && communicatedConsentSignals
      && Object.keys(signals).every(key => communicatedConsentSignals[key] === signals[key])) return;
    const command = communicatedConsent ? 'update' : 'default';
    window.gtag('consent', command, {
      ...signals,
      ...(command === 'default' ? { wait_for_update: 500 } : {}),
    });
    communicatedConsent = value;
    communicatedConsentSignals = signals;
  };

  const setAdRequestPaused = (paused) => {
    if (!hasAdSenseTag) return;
    window.adsbygoogle = window.adsbygoogle || [];
    if (hasGpcSignal() || usOptedOut) window.adsbygoogle.requestNonPersonalizedAds = 1;
    else if ('requestNonPersonalizedAds' in window.adsbygoogle) window.adsbygoogle.requestNonPersonalizedAds = 0;
    window.adsbygoogle.pauseAdRequests = (
      paused
      || hasGpcSignal()
      || googleCmpRegion === 'unavailable'
      || (usStateApplies && gppState !== 'ready')
    ) ? 1 : 0;
  };

  const loadScriptOnce = (key, src, attrs = {}) => {
    if (MARKETING_SCRIPT_PROMISES.has(key)) return MARKETING_SCRIPT_PROMISES.get(key);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-lc-marketing="${key}"]`);
      if (existing) {
        MARKETING_SCRIPT_STATE[key] = 'loaded';
        resolve();
        return;
      }
      MARKETING_SCRIPT_STATE[key] = 'loading';
      const script = document.createElement('script');
      script.src = src;
      script.dataset.lcMarketing = key;
      Object.entries(attrs).forEach(([name, value]) => {
        if (value !== undefined && value !== null) script.setAttribute(name, value);
      });
      script.async = true;
      script.onload = () => {
        MARKETING_SCRIPT_STATE[key] = 'loaded';
        resolve();
      };
      script.onerror = (error) => {
        MARKETING_SCRIPT_STATE[key] = 'failed';
        MARKETING_SCRIPT_PROMISES.delete(key);
        script.remove();
        reject(error);
      };
      document.head.appendChild(script);
    });
    MARKETING_SCRIPT_PROMISES.set(key, promise);
    return promise;
  };

  const loadMarketingScripts = async (value) => {
    if (!['accepted', 'limited'].includes(value)) return;
    if (hasGpcSignal() || (usStateApplies && gppState !== 'ready')) return;
    ensureGoogleTagStub();
    if (googleCmpRegion !== 'europe' && communicatedConsent !== value) setConsent(value);
    if (MARKETING_SCRIPT_STATE.gtm === 'idle') {
      window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    }

    await loadScriptOnce(
      'gtm',
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`,
      { 'data-lc-consent': value }
    );
    await loadScriptOnce(
      'ga4',
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`
    );
    if (!googleTagsConfigured) {
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID);
      googleTagsConfigured = true;
    }

  };

  const canLoadBasicModeTags = (values) => {
    if (!values) return false;
    if (hasGpcSignal()) return false;
    return [
      values.adStoragePurposeConsentStatus,
      values.adUserDataPurposeConsentStatus,
      values.adPersonalizationPurposeConsentStatus,
      values.analyticsStoragePurposeConsentStatus,
    ].every(status => status === 1);
  };

  const updateGoogleConsentMode = (values) => {
    const signals = {
      ad_storage: values?.adStoragePurposeConsentStatus === 1 ? 'granted' : 'denied',
      ad_user_data: values?.adUserDataPurposeConsentStatus === 1 ? 'granted' : 'denied',
      ad_personalization: values?.adPersonalizationPurposeConsentStatus === 1 ? 'granted' : 'denied',
      analytics_storage: values?.analyticsStoragePurposeConsentStatus === 1 ? 'granted' : 'denied',
    };
    if (googleConsentModeSignals
      && Object.keys(signals).every(key => googleConsentModeSignals[key] === signals[key])) return;
    ensureGoogleTagStub();
    window.gtag('consent', 'update', signals);
    googleConsentModeSignals = signals;
  };

  const loadGoogleTagsAfterCmp = async () => {
    if (googleCmpRegion !== 'europe') return;
    setAdRequestPaused(true);
    const values = window.googlefc?.getGoogleConsentModeValues?.();
    updateGoogleConsentMode(hasGpcSignal() ? null : values);
    googleCmpDecisionReady = canLoadBasicModeTags(values);
    googleCmpAnalyticsGranted = !hasGpcSignal() && values?.analyticsStoragePurposeConsentStatus === 1;
    if (!googleCmpDecisionReady) return;
    setAdRequestPaused(false);
    await loadMarketingScripts('limited');
    trackSupportPageView();
  };

  const requestGoogleRevocation = () => {
    if (!hasAdSenseTag || revocationRequested) {
      if (!hasAdSenseTag) window.location.assign(preferencesRoute());
      return;
    }
    revocationRequested = true;
    window.googlefc.callbackQueue.push({
      CONSENT_API_READY: () => window.googlefc.showRevocationMessage(),
    });
  };

  const resolveNonEuropeanRegion = () => {
    if (!googleGdprResolved || googleGdprApplies !== false || !googleUsStateResolved) return;
    if (googleCmpRegion === 'europe') return;
    if (usStateApplies) {
      if (gppState !== 'ready') {
        googleCmpRegion = 'unavailable';
        try { localStorage.setItem(consentAuthorityKey, 'unavailable'); } catch {}
        setConsent(state() || 'rejected');
        setAdRequestPaused(true);
        hideBanner();
        showManage();
        return;
      }
      googleCmpRegion = 'us';
      try { localStorage.setItem(consentAuthorityKey, 'google-us'); } catch {}
    } else {
      googleCmpRegion = 'other';
      try { localStorage.setItem(consentAuthorityKey, 'legacy'); } catch {}
    }
    initializeLegacyConsent();
  };

  const handleGoogleCmpDecision = (tcData, success) => {
    if (!success || !tcData || typeof tcData.gdprApplies !== 'boolean') return;
    googleGdprResolved = true;
    googleGdprApplies = tcData.gdprApplies;
    if (tcData.gdprApplies) {
      googleCmpRegion = 'europe';
      try { localStorage.setItem(consentAuthorityKey, 'google-europe'); } catch {}
      hideBanner();
      showManage();
      if (wantsConsentManagement && ['tcloaded', 'useractioncomplete'].includes(tcData.eventStatus)) {
        requestGoogleRevocation();
      }
      window.googlefc.callbackQueue.push({
        CONSENT_MODE_DATA_READY: () => {
          loadGoogleTagsAfterCmp().catch(() => {
            window.dispatchEvent(new CustomEvent('lc-consent:error'));
          });
        },
      });
      return;
    }
    resolveNonEuropeanRegion();
  };

  const parseGppSignal = (pingData) => {
    const parsedSections = pingData?.parsedSections;
    let gpc = false;
    Object.values(parsedSections || {}).forEach(sections => {
      if (!Array.isArray(sections)) return;
      if (sections.some(section => section?.Gpc === true)) gpc = true;
    });

    const applicableSections = Array.isArray(pingData?.applicableSections)
      ? pingData.applicableSections.filter(Number.isInteger)
      : [];
    let optOut = null;
    for (const definition of US_GPP_SECTIONS) {
      if (!applicableSections.includes(definition.id)) continue;
      const sections = parsedSections?.[definition.prefix];
      if (!Array.isArray(sections)) continue;
      for (const section of sections) {
        if (!section || typeof section !== 'object') continue;
        if (definition.fields.some(field => section[field] === 1)) optOut = true;
        else if (optOut !== true && definition.fields.every(field => section[field] === 2)) optOut = false;
      }
    }
    return {
      gpc,
      state: optOut === null ? 'incomplete' : 'ready',
      optOut,
    };
  };

  const synchronizeGppState = () => {
    if (!googleUsStateResolved) {
      setAdRequestPaused(true);
      return;
    }
    if (googleGdprApplies) {
      usStateApplies = false;
      usOptedOut = false;
      gppOptOut = null;
      gppState = 'not-applicable';
      if (hasGpcSignal()) setAdRequestPaused(true);
      return;
    }
    if (!usStateApplies) {
      usOptedOut = false;
      gppOptOut = null;
      gppState = 'not-applicable';
      if (hasGpcSignal()) setAdRequestPaused(true);
      return;
    }

    const parsed = latestGppPingData ? parseGppSignal(latestGppPingData) : null;
    if (!parsed || parsed.state !== 'ready') {
      gppState = parsed?.state || gppState;
      usOptedOut = googleUsInitialOptedOut || gppOptOut === true || hasGpcSignal();
      setConsent(state() || 'rejected');
      setAdRequestPaused(true);
      return;
    }

    if (parsed.optOut === true) {
      gppOptOut = true;
      gppState = 'ready';
    } else if (googleUsInitialOptedOut && !gppHasBaseline && !gppChangePending) {
      gppOptOut = null;
      gppState = 'inconsistent';
    } else if (gppOptOut === true && !gppChangePending) {
      gppState = 'inconsistent';
    } else {
      gppOptOut = false;
      if (googleUsInitialOptedOut && gppChangePending) gppOverridesGoogleInitial = true;
      gppState = 'ready';
    }
    if (gppState === 'ready') {
      gppHasBaseline = true;
      gppChangePending = false;
    }
    usOptedOut = (googleUsInitialOptedOut && !gppOverridesGoogleInitial)
      || gppOptOut === true
      || hasGpcSignal();
    const currentConsent = state();
    setConsent(currentConsent || 'rejected');
    setAdRequestPaused(currentConsent !== 'accepted');
    updateBannerLanguage();
    resolveNonEuropeanRegion();
  };

  const handleGoogleGppEvent = (event, success) => {
    const pingData = event?.pingData;
    if (!success || !pingData) {
      latestGppPingData = null;
      gppState = 'error';
      synchronizeGppState();
      return;
    }
    if (pingData.signalStatus === 'not ready' || event?.data === 'not ready') {
      if (gppHasObservedReady) gppChangePending = true;
      latestGppPingData = null;
      gppState = 'not-ready';
      synchronizeGppState();
      return;
    }
    if (pingData.signalStatus !== 'ready') {
      latestGppPingData = null;
      gppState = 'incomplete';
      synchronizeGppState();
      return;
    }
    latestGppPingData = pingData;
    gppHasObservedReady = true;
    if (parseGppSignal(pingData).gpc) {
      gppGpcActive = true;
      updateGoogleConsentMode(null);
    }
    synchronizeGppState();
  };

  const registerGoogleGppListener = () => {
    if (gppListenerSetup || typeof window.__gpp !== 'function') return;
    gppListenerSetup = true;
    try {
      window.__gpp('addEventListener', handleGoogleGppEvent);
    } catch (error) {
      gppListenerSetup = false;
      gppState = 'error';
      synchronizeGppState();
      window.dispatchEvent(new CustomEvent('lc-consent:error'));
    }
  };

  const handleGoogleUsState = () => {
    const status = window.googlefc?.usstatesoptout?.getInitialUsStatesOptOutStatus?.();
    if (status !== 1 && status !== 2 && status !== 3) return;
    googleUsStateResolved = true;
    usStateApplies = status === 2 || status === 3;
    googleUsInitialOptedOut = status === 3;
    usOptedOut = googleUsInitialOptedOut || hasGpcSignal();
    registerGoogleGppListener();
    synchronizeGppState();
    updateBannerLanguage();
    resolveNonEuropeanRegion();
  };

  const registerGoogleCmpCallbacks = () => {
    if (!hasAdSenseTag) return;
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push({
      CONSENT_API_READY: () => {
        if (typeof window.__tcfapi !== 'function') return;
        window.__tcfapi('addEventListener', 2.2, handleGoogleCmpDecision);
        registerGoogleGppListener();
      },
    });
    window.googlefc.callbackQueue.push({
      CONSENT_DATA_READY: registerGoogleGppListener,
    });
    window.googlefc.callbackQueue.push({
      CONSENT_MODE_DATA_READY: () => {
        if (googleCmpRegion === 'europe') {
          loadGoogleTagsAfterCmp().catch(() => {
            window.dispatchEvent(new CustomEvent('lc-consent:error'));
          });
        }
      },
    });
    window.googlefc.callbackQueue.push({
      INITIAL_US_STATES_OPT_OUT_DATA_READY: handleGoogleUsState,
    });
    window.setTimeout(() => {
      if (googleCmpRegion) return;
      googleCmpRegion = 'unavailable';
      try { localStorage.setItem(consentAuthorityKey, 'unavailable'); } catch {}
      setAdRequestPaused(true);
      hideBanner();
      showManage();
    }, GOOGLE_CMP_WAIT_MS);
  };

  const applyConsent = async (value) => {
    if (googleCmpRegion === 'europe') return;
    saveState(value);
    setConsent(value, true);
    if (value === 'accepted' || value === 'limited') {
      await loadMarketingScripts(value);
      trackSupportPageView();
    }
    setAdRequestPaused(value !== 'accepted');
    hideBanner();
    showManage();
    window.dispatchEvent(new CustomEvent(`lc-consent:${value}`));
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

  const accept = () => applyConsent('accepted').catch(() => {
    hideBanner();
    showManage();
    window.dispatchEvent(new CustomEvent('lc-consent:error'));
  });

  const reject = () => applyConsent('rejected');

  const acceptLimited = () => applyConsent('limited').catch(() => {
    hideBanner();
    showManage();
    window.dispatchEvent(new CustomEvent('lc-consent:error'));
  });

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
      if (googleCmpRegion === 'europe') {
        requestGoogleRevocation();
        return;
      }
      if (!hasAdSenseTag || usStateApplies) {
        window.location.assign(preferencesRoute());
        return;
      }
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
    banner.querySelector('.lc-consent-card').setAttribute('aria-label', t.ariaLabel);
    banner.querySelector('.lc-consent-copy strong').textContent = t.title;
    const constrained = hasGpcSignal() || usOptedOut || googleCmpRegion === 'unavailable';
    const copy = hasGpcSignal()
      ? t.gpcCopy
      : usOptedOut
        ? t.usOptOutCopy
        : googleCmpRegion === 'unavailable'
          ? t.unavailableCopy
          : t.copy;
    banner.querySelector('.lc-consent-copy p:not(.lc-consent-ccpa)').textContent = copy;
    banner.querySelector('.lc-consent-reject').textContent = t.reject;
    banner.querySelector('.lc-consent-accept').textContent = hasGpcSignal()
      ? t.saved
      : constrained ? t.analyticsOnly : t.accept;
    banner.querySelector('.lc-consent-link').textContent = t.privacy;
    const limited = banner.querySelector('.lc-consent-limited');
    if (limited) limited.textContent = t.limited;
    const ccpaEl = banner.querySelector('.lc-consent-ccpa');
    if (ccpaEl) {
      ccpaEl.hidden = true;
    }
    if (limited) limited.hidden = constrained;

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

  const initializeLegacyConsent = async () => {
    if (legacyInitialized || googleCmpRegion === 'europe') return;
    legacyInitialized = true;
    const consent = state();
    setConsent(consent || 'rejected');
    showManage();
    bindSupportTracking();

    if (hasGpcSignal()) {
      setAdRequestPaused(true);
      showBanner();
      return;
    }

    if (consent === 'accepted' || consent === 'limited') {
      await loadMarketingScripts(consent).catch(() => {
        window.dispatchEvent(new CustomEvent('lc-consent:error'));
      });
      trackSupportPageView();
      setAdRequestPaused(consent !== 'accepted');
      if (wantsConsentManagement) showBanner();
      else hideBanner();
      return;
    }

    if (consent === 'rejected') {
      setAdRequestPaused(true);
      if (wantsConsentManagement) showBanner();
      else hideBanner();
      return;
    }
    showBanner();
  };

  const init = async () => {
    injectStyle();
    buildBanner();
    buildManage();
    buildCcpaBar();
    bindLanguageUpdates();
    showManage();

    if (!hasAdSenseTag) {
      hideBanner();
      return;
    }

    registerGoogleCmpCallbacks();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
