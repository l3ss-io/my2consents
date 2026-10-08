import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as CookieConsent from 'vanilla-cookieconsent';
import { createConsentManager } from '../src/manager';
import { buildTranslations, normalizeLanguage } from '../src/copy';
import { loadStylesheet } from '../src/stylesheet';
import type { Config } from '../src/types';

const legacyCookie = 'nordic_tourism_cookie_consent';
const config: Config = { siteName: 'Example Site', cookieName: legacyCookie, analyticsCookies: [{ name: /^_ga/ }, { name: /^_ga/, domain: 'example.com' }, { name: '_gid' }] };
const manager = () => createConsentManager(() => Promise.resolve());

beforeEach(() => {
  CookieConsent.reset(true);
  document.body.replaceChildren();
  document.documentElement.lang = 'en';
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0];
    document.cookie = `${name}=; max-age=0; path=/`;
    document.cookie = `${name}=; max-age=0; path=/; domain=demo.example.com`;
    document.cookie = `${name}=; max-age=0; path=/; domain=example.com`;
  }
});
afterEach(() => {
  CookieConsent.reset(true);
  vi.useRealTimers();
});

function saveLegacyConsent(analytics: boolean) {
  // Exact vanilla-cookieconsent v3.1 shape from the previous travel-site banner.
  const timestamp = new Date().toISOString();
  document.cookie = `${legacyCookie}=${encodeURIComponent(JSON.stringify({
    categories: analytics ? ['necessary', 'analytics'] : ['necessary'], revision: 0,
    data: null, consentId: 'a9876543-1234-4321-8123-a123456789ab',
    consentTimestamp: timestamp, lastConsentTimestamp: timestamp, languageCode: 'en',
    services: { necessary: [], analytics: [] },
  }))}; path=/; domain=demo.example.com; SameSite=Lax; Secure; max-age=15552000`;
}

describe('real CookieConsent integration', () => {
  it('starts undecided, emits ready, accepts analytics, and restores the saved choice', async () => {
    const ready = vi.fn();
    const changes = vi.fn();
    document.addEventListener('my2consents:ready', ready);
    document.addEventListener('my2consents:change', changes);
    try {
      const api = manager();
      await api.init(config);
      expect(api.getConsent()).toEqual({ hasDecision: false, analytics: false });
      expect(ready.mock.calls[0][0].detail).toEqual(api.getConsent());
      expect(document.querySelector('.cm__desc')?.textContent).toContain('Example Site');
      expect(document.querySelector('.my2consents-preferences')).toBeNull();
      CookieConsent.acceptCategory('all');
      expect(api.getConsent()).toEqual({ hasDecision: true, analytics: true });
      expect(changes).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll('.my2consents-preferences')).toHaveLength(1);
      CookieConsent.reset(false);
      document.querySelector('.my2consents-preferences')?.remove();
      const restored = manager();
      await restored.init(config);
      expect(restored.getConsent()).toEqual({ hasDecision: true, analytics: true });
      expect(document.querySelector('.cm')).toBeNull();
    } finally {
      document.removeEventListener('my2consents:ready', ready);
      document.removeEventListener('my2consents:change', changes);
    }
  });

  it.each([true, false])('restores legacy consent (analytics %s) without asking again', async analytics => {
    saveLegacyConsent(analytics);
    const api = manager();
    await api.init(config);
    expect(api.getConsent()).toEqual({ hasDecision: true, analytics });
    expect(document.querySelector('.cm')).toBeNull();
    const button = document.querySelector<HTMLButtonElement>('.my2consents-preferences')!;
    expect(button.textContent).toBe('Cookie preferences');
    button.click();
    expect(document.documentElement.classList.contains('show--preferences')).toBe(true);
  });

  it('rejects and withdraws analytics, deleting configured cookies but preserving other preferences', async () => {
    const api = manager();
    await api.init(config);
    CookieConsent.acceptCategory('necessary');
    expect(api.getConsent()).toEqual({ hasDecision: true, analytics: false });
    CookieConsent.acceptCategory('all');
    document.cookie = '_ga=host; path=/';
    document.cookie = '_ga_123=domain; path=/; domain=example.com';
    document.cookie = '_gid=visit; path=/';
    document.cookie = 'currency=EUR; path=/';
    api.showPreferences();
    CookieConsent.acceptCategory('necessary');
    expect(api.getConsent()).toEqual({ hasDecision: true, analytics: false });
    expect(document.cookie).not.toMatch(/_ga|_gid/);
    expect(document.cookie).toContain('currency=EUR');
    expect(document.cookie).toContain(legacyCookie);
  });

  it('clears leftover analytics cookies when restoring rejection', async () => {
    saveLegacyConsent(false);
    document.cookie = '_ga=leftover; path=/';
    const api = manager();
    await api.init(config);
    expect(document.cookie).not.toContain('_ga=');
  });

  it('treats expired and malformed consent as undecided', async () => {
    saveLegacyConsent(true);
    document.cookie = `${legacyCookie}=; path=/; domain=demo.example.com; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    let api = manager();
    await api.init(config);
    expect(api.getConsent()).toEqual({ hasDecision: false, analytics: false });
    CookieConsent.reset(false);
    document.cookie = `${legacyCookie}=not-json; path=/`;
    api = manager();
    await api.init(config);
    expect(api.getConsent()).toEqual({ hasDecision: false, analytics: false });
  });

  it('does not reuse another project’s cookie or set storage on the asset domain', async () => {
    saveLegacyConsent(true);
    const api = manager();
    await api.init({ siteName: 'Different Project' });
    expect(api.getConsent()).toEqual({ hasDecision: false, analytics: false });
    CookieConsent.acceptCategory('necessary');
    expect(document.cookie).toContain('my2consents_consent=');
    document.cookie = 'asset_cookie=forbidden; domain=assets.l3ss.io; path=/';
    expect(document.cookie).not.toContain('asset_cookie');
  });

  it('deduplicates concurrent and repeated initialization and supports language changes', async () => {
    let resolveStyles!: () => void;
    const styles = vi.fn(() => new Promise<void>(resolve => { resolveStyles = resolve; }));
    const api = createConsentManager(styles);
    const first = api.init(config);
    expect(api.init(config)).toBe(first);
    expect(document.querySelector('#cc-main')).toBeNull();
    resolveStyles();
    await first;
    CookieConsent.acceptCategory('necessary');
    await api.init(config);
    await Promise.all([api.setLanguage('de-DE'), api.setLanguage('sv-SE')]);
    expect(styles).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('#cc-main')).toHaveLength(1);
    expect(document.querySelectorAll('.my2consents-preferences')).toHaveLength(1);
    expect(document.querySelector('.my2consents-preferences')?.textContent).toBe('Cookieinställningar');
    await api.setLanguage('unknown');
    expect(document.querySelector('.my2consents-preferences')?.textContent).toBe('Cookie preferences');
  });

  it('allows initialization retry after a stylesheet failure', async () => {
    const styles = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const api = createConsentManager(styles);
    await expect(api.init(config)).rejects.toThrow('offline');
    expect(api.getConsent()).toEqual({ hasDecision: false, analytics: false });
    await api.init(config);
    expect(styles).toHaveBeenCalledTimes(2);
    expect(document.querySelector('#cc-main')).not.toBeNull();
  });

  it('supports initialization from the head before the body exists', async () => {
    const body = document.body;
    body.remove();
    const api = manager();
    const initialization = api.init(config);
    await Promise.resolve();
    expect(document.querySelector('#cc-main')).toBeNull();
    document.documentElement.append(body);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await initialization;
    expect(document.querySelector('#cc-main')).not.toBeNull();
  });

  it('uses the document language and escapes site identity and overridden descriptions', async () => {
    document.documentElement.lang = 'sv-SE';
    const api = manager();
    await api.init({ siteName: '<img src=x onerror=alert(1)>', copy: { sv: { consentModal: { description: 'Visit {siteName} <script>bad()</script>' } } } });
    const description = document.querySelector('.cm__desc')!;
    expect(description.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(description.querySelector('img, script')).toBeNull();
    expect(document.querySelector('.cm__title')?.textContent).toBe('Cookieinställningar');
  });
});

describe('copy and stylesheet behavior', () => {
  it('includes nine languages and consumer-supplied inventory without hardcoded providers', () => {
    const all = buildTranslations({ siteName: 'StageTrips' });
    expect(Object.keys(all)).toHaveLength(9);
    expect(JSON.stringify(all)).not.toMatch(/Nordic Tourism|Google Analytics|currency|destination pages/);
    expect(normalizeLanguage('toString')).toBe('en');
    const custom = buildTranslations({ siteName: 'A', analyticsCookieInfo: { en: [{ name: 'counter', description: 'Visits', expiration: '30 days' }] } });
    const section = custom.sv.preferencesModal.sections[2];
    expect('cookieTable' in section && section.cookieTable?.body[0]).toEqual({ name: 'counter', description: 'Visits', expiration: '30 days' });
  });

  it('waits for CSS and removes failed loads before retrying', async () => {
    const url = 'https://assets.l3ss.io/my2consents/v0.1.0/my2consents.css';
    const first = loadStylesheet(url);
    const link = document.querySelector<HTMLLinkElement>('link[data-my2consents]')!;
    expect(link.href).toBe(url);
    link.dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow('could not be loaded');
    expect(document.querySelector('link[data-my2consents]')).toBeNull();
    const second = loadStylesheet(url);
    expect(loadStylesheet(url)).toBe(second);
    document.querySelector('link[data-my2consents]')!.dispatchEvent(new Event('load'));
    await second;
    expect(loadStylesheet(url)).toBe(second);
    expect(document.querySelectorAll('link[data-my2consents]')).toHaveLength(1);
    document.querySelector('link[data-my2consents]')!.remove();
  });

  it('times out stylesheet loading without marking consent ready', async () => {
    vi.useFakeTimers();
    const promise = loadStylesheet('https://assets.l3ss.io/blocked.css');
    const expectation = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await expectation;
    expect(document.querySelector('link[data-my2consents]')).toBeNull();
  });

  it('rejects invalid configuration without consuming the initialization attempt', async () => {
    const api = manager();
    await expect(api.init({ siteName: ' ' })).rejects.toThrow('siteName');
    await expect(api.init({ siteName: 'Site', cookieName: 'bad;name' })).rejects.toThrow('cookieName');
    await api.init(config);
    expect(document.querySelector('#cc-main')).not.toBeNull();
  });
});
