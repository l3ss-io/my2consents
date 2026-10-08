const stylesheets = new Map<string, Promise<void>>();

export function loadStylesheet(url: string): Promise<void> {
  const existing = stylesheets.get(url);
  if (existing) return existing;
  const loading = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.my2consents = 'stylesheet';
    const timer = window.setTimeout(() => finish(new Error('My2Consents stylesheet timed out')), 15_000);
    function finish(error?: Error) {
      window.clearTimeout(timer);
      link.onload = null;
      link.onerror = null;
      if (error) {
        link.remove();
        stylesheets.delete(url);
        reject(error);
      } else {
        resolve();
      }
    }
    link.onload = () => finish();
    link.onerror = () => finish(new Error('My2Consents stylesheet could not be loaded'));
    document.head.append(link);
  });
  stylesheets.set(url, loading);
  return loading;
}
