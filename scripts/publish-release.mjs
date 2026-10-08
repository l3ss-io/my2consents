import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateReleaseTag } from './validate-release-tag.mjs';
import { verifyPublicAsset } from './verify-public-asset.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const tag = process.argv[2];
validateReleaseTag(tag, packageJson.version);
const endpoint = process.env.R2_ENDPOINT_URL;
if (!endpoint || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error('Configure R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in GitHub Actions');
}
const bucket = 'less-than-three-assets';
const prefix = `my2consents/${tag}/`;
const files = ['my2consents.css', 'my2consents.js']; // Companion assets before the entry script.
function aws(args) {
  return execFileSync('aws', [...args, '--endpoint-url', endpoint], { cwd: root, encoding: 'utf8', env: { ...process.env, AWS_REGION: 'auto' } }).trim();
}
const count = aws(['s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', prefix, '--max-keys', '1', '--query', 'KeyCount', '--output', 'text']);
if (count !== '0') throw new Error(`Refusing to overwrite immutable release ${prefix}`);

async function uploadAndVerify(version, cacheControl) {
  for (const name of files) {
    const contentType = name.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
    aws(['s3', 'cp', `dist/${name}`, `s3://${bucket}/my2consents/${version}/${name}`, '--content-type', contentType, '--cache-control', cacheControl, '--no-progress']);
  }
  for (const name of files) {
    const expected = await readFile(new URL(`../dist/${name}`, import.meta.url));
    const url = `https://assets.l3ss.io/my2consents/${version}/${name}`;
    const mime = name.endsWith('.css') ? 'text/css' : 'application/javascript';
    let verified = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await fetch(url, { headers: { Origin: 'https://example.com' }, signal: AbortSignal.timeout(10_000) });
        verified = await verifyPublicAsset(response, expected, mime, cacheControl);
        if (verified) break;
      } catch { /* Retry propagation/network failures without exposing credentials. */ }
      await new Promise(resolve => setTimeout(resolve, 3_000));
    }
    if (!verified) throw new Error(`Public content/header verification failed: ${url}`);
    console.log(`Verified ${url}`);
  }
}
await uploadAndVerify(tag, 'public, max-age=31536000, immutable');
// Only advance latest after the immutable release has passed public verification.
await uploadAndVerify('latest', 'no-cache, must-revalidate');
