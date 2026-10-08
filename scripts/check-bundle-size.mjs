import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const budgets = { 'my2consents.js': 24_000, 'my2consents.css': 8_000 };
for (const [name, budget] of Object.entries(budgets)) {
  const bytes = await readFile(new URL(`../dist/${name}`, import.meta.url));
  if (!bytes.toString().includes('Copyright (c) 2020-2025 Orest Bida')) {
    throw new Error('Missing upstream license notice in distributed asset');
  }
  const gzip = gzipSync(bytes, { level: 9 }).byteLength;
  console.log(`${name}: ${bytes.byteLength} bytes raw; ${gzip} bytes gzip`);
  if (gzip > budget) throw new Error(`${name} exceeds its ${budget}-byte gzip budget`);
}
