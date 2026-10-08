import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const licenseNotice = '/*! vanilla-cookieconsent 3.1.0\n' +
  readFileSync(new URL('./THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8') + '\n*/\n';

export default defineConfig({
  plugins: [{
    name: 'preserve-dependency-license',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        // Add after minification, which otherwise removes dependency notices.
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk' && output.isEntry) output.code = licenseNotice + output.code;
          if (output.type === 'asset' && output.fileName.endsWith('.css')) {
            output.source = licenseNotice + (typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source));
          }
        }
      },
    },
  }],
  build: {
    lib: {
      entry: 'src/browser.ts',
      name: 'My2ConsentsBundle',
      formats: ['iife'],
      fileName: () => 'my2consents.js',
      cssFileName: 'my2consents',
    },
  },
});
