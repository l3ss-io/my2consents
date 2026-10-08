import * as CookieConsent from 'vanilla-cookieconsent';
import { buildTranslations, getCopy, normalizeLanguage } from './copy';
import type { Config, ConsentState, My2ConsentsApi } from './types';

export function createConsentManager(loadStyles: () => Promise<void>): My2ConsentsApi {
  let initialization: Promise<void> | undefined;
  let initialized = false;
  let config: Config;
  let language = normalizeLanguage(document.documentElement.lang);
  let button: HTMLButtonElement | undefined;
  let previousState: ConsentState | undefined;
  let languageChange = Promise.resolve();

  function getConsent(): ConsentState {
    const hasDecision = initialized && CookieConsent.validConsent();
    return { hasDecision, analytics: hasDecision && CookieConsent.acceptedCategory('analytics') };
  }

  function updatePreferencesButton() {
    if (!getConsent().hasDecision) return;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'my2consents-preferences';
      button.addEventListener('click', () => CookieConsent.showPreferences());
      document.body.append(button);
    }
    button.textContent = getCopy(config, language).preferencesButtonLabel.replaceAll('{siteName}', () => config.siteName);
  }

  function synchronize(eventName: 'my2consents:ready' | 'my2consents:change') {
    if (!initialized) return;
    const state = getConsent();
    if (!state.analytics) {
      // Also clear configured cookies on restored rejection/expired consent.
      // Cookies remain first-party: this never touches the asset host's storage.
      for (const cookie of config.analyticsCookies ?? []) {
        CookieConsent.eraseCookies(cookie.name, cookie.path, cookie.domain);
      }
    }
    updatePreferencesButton();
    if (eventName === 'my2consents:ready' || !previousState ||
        state.hasDecision !== previousState.hasDecision || state.analytics !== previousState.analytics) {
      previousState = state;
      document.dispatchEvent(new CustomEvent(eventName, { detail: { ...state } }));
    }
  }

  function init(options: Config): Promise<void> {
    if (initialization) return initialization;
    if (!options || typeof options.siteName !== 'string' || !options.siteName.trim()) {
      return Promise.reject(new Error('My2Consents requires a non-empty siteName'));
    }
    if (options.cookieName !== undefined && !/^[A-Za-z0-9_-]+$/.test(options.cookieName)) {
      return Promise.reject(new Error('My2Consents cookieName must contain only letters, digits, underscores, or hyphens'));
    }
    // Store an owned copy; mutating the caller's configuration must not silently
    // change cookie cleanup or the meaning of a previously saved consent choice.
    try {
      config = structuredClone(options);
    } catch {
      return Promise.reject(new Error('My2Consents configuration must contain plain data'));
    }
    language = normalizeLanguage(config.language ?? document.documentElement.lang);
    initialization = (async () => {
      await loadStyles();
      if (!document.body) {
        await new Promise<void>(resolve => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }));
      }
      await CookieConsent.run({
        mode: 'opt-in',
        manageScriptTags: false,
        cookie: { name: config.cookieName ?? 'my2consents_consent', expiresAfterDays: 180, sameSite: 'Lax' },
        guiOptions: {
          consentModal: { layout: 'bar inline', position: 'bottom', equalWeightButtons: false },
          preferencesModal: { layout: 'box', equalWeightButtons: false },
        },
        categories: {
          necessary: { readOnly: true },
          analytics: { autoClear: { cookies: config.analyticsCookies ?? [] } },
        },
        language: { default: language, translations: buildTranslations(config) },
        onConsent: () => synchronize('my2consents:change'),
        onChange: () => synchronize('my2consents:change'),
      });
      initialized = true;
      synchronize('my2consents:ready');
    })().catch(error => {
      initialized = false;
      initialization = undefined;
      previousState = undefined;
      button?.remove();
      button = undefined;
      CookieConsent.reset(false);
      throw error;
    });
    return initialization;
  }

  return {
    init,
    getConsent,
    showPreferences() {
      if (!initialized) throw new Error('Call and await My2Consents.init() before opening preferences');
      CookieConsent.showPreferences();
    },
    setLanguage(value) {
      languageChange = languageChange.catch(() => {}).then(async () => {
        if (!initialization) throw new Error('Call My2Consents.init() before changing language');
        await initialization;
        const nextLanguage = normalizeLanguage(value);
        await CookieConsent.setLanguage(nextLanguage, true);
        language = nextLanguage;
        updatePreferencesButton();
      });
      return languageChange;
    },
  };
}
