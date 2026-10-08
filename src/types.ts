import type * as CookieConsent from 'vanilla-cookieconsent';
import type { translations } from './translations';

export type Language = keyof typeof translations;
type TextFields<T> = { [K in keyof T]: string };
export type Copy = {
  preferencesButtonLabel: string;
  consentModal: TextFields<typeof translations.en.consentModal>;
  preferencesModal: TextFields<typeof translations.en.preferencesModal>;
};
export type CopyOverride = {
  preferencesButtonLabel?: string;
  consentModal?: Partial<Copy['consentModal']>;
  preferencesModal?: Partial<Copy['preferencesModal']>;
};
export type ConsentState = { hasDecision: boolean; analytics: boolean };
export type AnalyticsCookieInfo = { name: string; description: string; expiration: string };
export type Config = {
  siteName: string;
  language?: string;
  cookieName?: string;
  copy?: Partial<Record<Language, CopyOverride>>;
  analyticsCookies?: CookieConsent.CookieItem[];
  analyticsCookieInfo?: Partial<Record<Language, AnalyticsCookieInfo[]>>;
};
export type My2ConsentsApi = {
  init(config: Config): Promise<void>;
  getConsent(): ConsentState;
  showPreferences(): void;
  setLanguage(language: string): Promise<void>;
};

declare global {
  interface Window { My2Consents?: My2ConsentsApi }
  interface DocumentEventMap {
    'my2consents:ready': CustomEvent<ConsentState>;
    'my2consents:change': CustomEvent<ConsentState>;
  }
}
