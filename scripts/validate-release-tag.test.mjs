import assert from 'node:assert/strict';
import test from 'node:test';

import { validateReleaseTag } from './validate-release-tag.mjs';

test('accepts a matching stable SemVer tag', () => {
  assert.doesNotThrow(() => validateReleaseTag('v1.2.3', '1.2.3'));
});

test('accepts a matching prerelease SemVer tag', () => {
  assert.doesNotThrow(() => validateReleaseTag('v1.2.3-rc.1', '1.2.3-rc.1'));
});

test('rejects a tag without the v prefix', () => {
  assert.throws(() => validateReleaseTag('1.2.3', '1.2.3'), /must start with/);
});

test('rejects malformed SemVer', () => {
  assert.throws(() => validateReleaseTag('v1.2', '1.2.0'), /not valid SemVer/);
});

test('rejects a tag that differs from the package version', () => {
  assert.throws(() => validateReleaseTag('v1.2.4', '1.2.3'), /does not match/);
});
