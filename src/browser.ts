import './styles.css';
import { createConsentManager } from './manager';
import { loadStylesheet } from './stylesheet';

// Capture the executing script's URL before asynchronous initialization. The
// companion stylesheet always comes from that exact release, including latest.
const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src;
window.My2Consents ??= createConsentManager(() => {
  if (!scriptUrl) return Promise.reject(new Error('Load My2Consents through its hosted script tag'));
  return loadStylesheet(new URL('my2consents.css', scriptUrl).href);
});
