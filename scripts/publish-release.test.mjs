import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPublicAsset } from './verify-public-asset.mjs';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const releaseTag = `v${version}`;
const publisher = fileURLToPath(new URL('./publish-release.mjs', import.meta.url));
const cleanEnvironment = { ...process.env, AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '', R2_ENDPOINT_URL: '' };

test('publisher rejects mismatched tags before doing any cloud work', () => {
  const result = spawnSync(process.execPath, [publisher, version === '0.0.0' ? 'v0.0.1' : 'v0.0.0'], { env: cleanEnvironment, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match/);
});

test('publisher reports missing repository credentials without uploading', () => {
  const result = spawnSync(process.execPath, [publisher, releaseTag], { env: cleanEnvironment, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Configure R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY/);
});

test('publisher refuses an existing immutable prefix before upload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'my2consents-publish-test-'));
  try {
    const invocation = join(directory, 'invocation.json');
    await writeFile(join(directory, 'aws'), `#!/usr/bin/env node\nconst fs = require('node:fs');\nfs.writeFileSync(${JSON.stringify(invocation)}, JSON.stringify(process.argv.slice(2)));\nconsole.log('1');\n`, { mode: 0o755 });
    const result = spawnSync(process.execPath, [publisher, releaseTag], {
      env: { ...cleanEnvironment, PATH: `${directory}:${process.env.PATH}`, AWS_ACCESS_KEY_ID: 'test-access', AWS_SECRET_ACCESS_KEY: 'test-secret', R2_ENDPOINT_URL: 'https://test.example.com' }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(`Refusing to overwrite immutable release my2consents/${releaseTag}/`));
    const args = JSON.parse(await readFile(invocation, 'utf8'));
    assert.equal(args[0], 's3api');
    assert.ok(args.includes('less-than-three-assets'));
    assert.ok(args.includes(`my2consents/${releaseTag}/`));
    assert.equal(args.includes('cp'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const cacheControl = 'public, max-age=31536000, immutable';
function publicResponse(body = 'bundle', headers = {}) {
  return new Response(body, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': cacheControl, 'access-control-allow-origin': '*', ...headers } });
}
test('public verification requires exact bytes and correct MIME, caching, and CORS', async () => {
  const expected = Buffer.from('bundle');
  assert.equal(await verifyPublicAsset(publicResponse(), expected, 'application/javascript', cacheControl), true);
  assert.equal(await verifyPublicAsset(publicResponse('outdated'), expected, 'application/javascript', cacheControl), false);
  for (const [key, value] of [['content-type', 'text/html'], ['cache-control', 'no-cache'], ['access-control-allow-origin', 'https://example.com']]) {
    assert.equal(await verifyPublicAsset(publicResponse('bundle', { [key]: value }), expected, 'application/javascript', cacheControl), false);
  }
  assert.equal(await verifyPublicAsset(publicResponse('bundle', { 'content-type': 'text/css; charset=utf-8' }), expected, 'text/css', cacheControl), true);
});
