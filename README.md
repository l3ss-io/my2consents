# My2Consents

A reusable, multilingual consent banner for essential storage and optional analytics. Built on vanilla-cookieconsent 3.1.0 and distributed as framework-independent JavaScript and CSS. The source repository is private; release assets are public.

Consent is stored on the consuming site's own origin. Loading assets from l3ss.io does not share consent across unrelated sites or create a central visitor database. My2Consents does not load analytics, publish measurement events, or configure Google Consent Mode: the consuming site owns those integrations.

## Embed a pinned release

```html
<script src="https://assets.l3ss.io/my2consents/v0.1.0/my2consents.js"></script>
<script>
  // Subscribe before initialization to receive the restored state.
  document.addEventListener('my2consents:ready', event => {
    console.log('Restored consent', event.detail);
  });
  document.addEventListener('my2consents:change', event => {
    console.log('Updated consent', event.detail);
  });
  My2Consents.init({ siteName: 'Your Website' }).catch(console.error);
</script>
```

Initialization also waits for the document body, so head embeds are supported. The script loads `my2consents.css` from its own release directory and waits for it before creating the banner. All translations are bundled; initialization makes one companion CSS request. The public API is `window.My2Consents`. With an async script, call `init` from its `load` handler. Production integrations should pin a version rather than use the mutable `latest` path.

Restrictive CSP policies must allow `https://assets.l3ss.io` in `script-src` and `style-src` (or their element-specific equivalents). Initialization does not require inline scripts: configuration can come from your site's own JavaScript.

## Configuration and API

```js
await My2Consents.init({
  siteName: 'Your Website',                         // Required; plain text.
  language: 'sv-SE',                              // Optional; defaults to <html lang>.
  cookieName: 'your_site_consent',                 // Optional; defaults to my2consents_consent.
  analyticsCookies: [                             // Optional; defaults to no cleanup rules.
    { name: /^_ga/ },
    { name: '_gid' },
    // Specify a parent domain/path if your analytics provider uses one:
    // { name: /^_ga/, domain: 'example.com', path: '/' },
  ],
  copy: {
    en: {
      consentModal: { description: 'We use essential preferences and optional analytics on {siteName}.' },
      preferencesModal: { analyticsDescription: 'Optional analytics helps us improve our website.' },
      preferencesButtonLabel: 'Cookie preferences',
    },
  },
  analyticsCookieInfo: {
    en: [{ name: '_ga, _ga_*', description: 'Google Analytics visit identifiers.', expiration: 'Up to 2 years' }],
  },
});

My2Consents.getConsent(); // { hasDecision: boolean, analytics: boolean }
My2Consents.showPreferences();
await My2Consents.setLanguage('de-DE');
```

`init` returns a Promise. Calls during or after successful initialization reuse the same initialization and do not create more UI; the first configuration wins. Configuration is copied on initialization. To update the language after navigation, call `setLanguage`. Initialization failure rejects and allows retry; a failed CSS request is removed and times out after 15 seconds. Call `showPreferences` only after successful initialization.

`getConsent` returns `{ hasDecision: false, analytics: false }` before successful initialization or without valid saved consent. `my2consents:ready` fires once after initialization, including when restoring existing consent. `my2consents:change` fires when a visitor first chooses or changes their consent. Both document events include `{ hasDecision, analytics }` in `event.detail`. Remounting integrations should read `getConsent` as well as listen for events, because the ready event may already have fired.

Essential storage cannot be disabled. Optional analytics defaults to rejected. Configured analytics cookies are cleared on rejection, withdrawal, and initialization without analytics consent. Only JavaScript-accessible cookies can be cleared; configure their domain and path to match your provider. No script interception is performed. Consumer scripts must use the consent state or their provider's own consent mode.

The consent cookie uses `/`, the current hostname, SameSite=Lax, HTTPS Secure, and a 180-day expiration. `cookieName` accepts letters, digits, underscores, and hyphens. Reusing the previous name and configuration preserves existing vanilla-cookieconsent 3.1 choices. Essential/analytics category keys and revision 0 are unchanged. There is no localStorage fallback or consent server.

Supported languages: English (`en`), Danish (`da`), German (`de`), Spanish (`es`), Finnish (`fi`), French (`fr`), Norwegian Bokmål (`nb`), Swedish (`sv`), and Chinese (`zh`). Region suffixes normalize to their base language; unsupported languages fall back to English. `copy` overrides any field in `src/translations.ts`. Copy and cookie inventory are plain text; `{siteName}` is substituted safely. Missing fields keep the bundled translation. Inventory falls back to English if no entry exists for the active language, and is omitted entirely when none is configured.

## Styling

Set these CSS custom properties on the document or an ancestor. The component has neutral defaults and does not rely on a site's existing CSS framework.

| Variable | Purpose |
| --- | --- |
| `--my2consents-font-family` | Banner/dialog and preferences-button font |
| `--my2consents-background` | Dialog/button background |
| `--my2consents-color`, `--my2consents-muted` | Main and secondary text |
| `--my2consents-primary`, `--my2consents-primary-hover` | Primary actions and toggles |
| `--my2consents-primary-color` | Primary action text |
| `--my2consents-secondary`, `--my2consents-secondary-hover` | Secondary actions |
| `--my2consents-border` | Separators and borders |
| `--my2consents-surface`, `--my2consents-surface-hover` | Preference sections |
| `--my2consents-shadow` | Dialog shadow |

```css
:root {
  --my2consents-primary: #7b4339;
  --my2consents-primary-hover: #66352d;
  --my2consents-font-family: system-ui, sans-serif;
}
```

The library creates `#cc-main`; use only one consent manager per document. The banner supports keyboard focus and a modal preferences dialog. The persistent preferences button appears after the first valid choice. Mobile copy remains fully visible and touch targets are at least 44px high.

## Development and verification

Use Node.js 22.22.0 (`.node-version`), or a newer Node.js 22 LTS release.

```sh
npm ci
npm run verify
npm run dev
```

`verify` runs type checking, real CookieConsent integration tests, release-tag tests, the production build, and bundle budgets. Open the dev server to switch between two independently configured demo sites (English/green and Swedish/warm). The demo uses built files from `dist/`, so rebuild after source edits.

The build emits `dist/my2consents.js` and `dist/my2consents.css`. Both assets include the upstream MIT license from `THIRD_PARTY_NOTICES.txt`. Generated files and credentials are not committed.

## GitHub Actions and Cloudflare R2

This project follows Sembo Widgets' distribution model: the existing `less-than-three-assets` R2 bucket behind `assets.l3ss.io`, with the `my2consents/` prefix. No Worker, app server, new bucket, or separate DNS entry is needed.

Configure repository-scoped Actions secrets `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` using an R2 Object Read & Write credential restricted to this bucket. Configure the Actions variable `R2_ENDPOINT_URL` with the bucket's S3 endpoint. Never commit credentials. The existing public CORS policy must allow GET/HEAD from `*`; preserve other consumers when changing bucket settings.

The l3ss.io zone has a project-scoped cache rule named **My2Consents — respect release cache headers** (rule ID `509ccc47efe44651b350ed6d2d324f2d`). It matches only `assets.l3ss.io/my2consents/` and sets Browser TTL to **Respect origin TTL**, preserving the R2 cache headers instead of applying the zone's four-hour minimum to `latest`. The reference definition is `deployment/cloudflare-cache-rule.json`. Do not change zone-wide caching or unrelated prefixes. Public release verification still checks that the rule takes effect. See [Cloudflare Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/).

GitHub Actions has been enabled for this repository. For a new repository, open its Actions page and enable workflows if prompted; repository Actions permissions alone may not activate workflow execution.

Pushes to `main` and pull requests verify without publishing. A `v<version>` tag matching `package.json` triggers verification and publishing. The publisher refuses an already-populated immutable prefix, uploads and verifies every versioned file, and only then updates and verifies `latest`. Companion CSS is uploaded before JavaScript. Public checks compare exact bytes, MIME types, cache headers, and `Access-Control-Allow-Origin: *`.

- Pinned releases: `my2consents/v0.1.0/`, with `Cache-Control: public, max-age=31536000, immutable`.
- Automatic upgrades: `my2consents/latest/`, with `Cache-Control: no-cache, must-revalidate`.

Published versions must not be overwritten or deleted. After a partial publishing failure, inspect the prefix rather than blindly rerunning uploads; use a new patch version if any immutable files were already uploaded. `latest` is a mutable convenience alias; consumers must accept upgrade risk. Pin production integrations and roll back by selecting the preceding pinned release.

The project follows semantic versioning: patch for compatible fixes, minor for compatible additions, major for breaking public API, cookie meaning, or integration behavior changes. For the initial release, commit the verified project, create annotated tag `v0.1.0`, and push `main` and the tag. Later, use `npm version patch|minor|major`, then push the commit and tag after verification.
