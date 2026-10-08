import { translations } from './translations';
import type { Config, Copy, Language } from './types';

export function normalizeLanguage(language: string | undefined): Language {
  const base = language?.trim().toLowerCase().split('-')[0] ?? 'en';
  return Object.hasOwn(translations, base) ? base as Language : 'en';
}

export function getCopy(config: Config, language: Language): Copy {
  const defaults = translations[language];
  const override = config.copy?.[language];
  return {
    preferencesButtonLabel: override?.preferencesButtonLabel ?? defaults.preferencesButtonLabel,
    consentModal: { ...defaults.consentModal, ...override?.consentModal },
    preferencesModal: { ...defaults.preferencesModal, ...override?.preferencesModal },
  };
}

// CookieConsent descriptions and table cells accept HTML. Our public copy API is
// plain text, so site names and consumer overrides cannot inject markup.
export function formatText(text: string, siteName: string): string {
  return text.replaceAll('{siteName}', () => siteName).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

export function buildTranslations(config: Config) {
  return Object.fromEntries((Object.keys(translations) as Language[]).map(language => {
    const copy = getCopy(config, language);
    const text = (value: string) => formatText(value, config.siteName);
    const preferences = copy.preferencesModal;
    const inventory = config.analyticsCookieInfo?.[language] ?? config.analyticsCookieInfo?.en;
    return [language, {
      consentModal: Object.fromEntries(Object.entries(copy.consentModal).map(([key, value]) => [key, text(value)])),
      preferencesModal: {
        title: text(preferences.title),
        acceptAllBtn: text(preferences.acceptAllBtn),
        acceptNecessaryBtn: text(preferences.acceptNecessaryBtn),
        savePreferencesBtn: text(preferences.savePreferencesBtn),
        closeIconLabel: text(preferences.closeIconLabel),
        sections: [
          { title: text(preferences.yourChoicesTitle), description: text(preferences.yourChoicesDescription) },
          { title: text(preferences.necessaryTitle), description: text(preferences.necessaryDescription), linkedCategory: 'necessary' },
          {
            title: text(preferences.analyticsTitle), description: text(preferences.analyticsDescription), linkedCategory: 'analytics',
            ...(inventory?.length ? { cookieTable: {
              headers: { name: text(preferences.cookieHeader), description: text(preferences.descriptionHeader), expiration: text(preferences.expirationHeader) },
              body: inventory.map(row => ({ name: text(row.name), description: text(row.description), expiration: text(row.expiration) })),
            } } : {}),
          },
        ],
      },
    }];
  }));
}
