import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function validateReleaseTag(tag, packageVersion) {
  if (!tag?.startsWith('v')) {
    throw new Error(`Release tag must start with "v": ${tag || '<empty>'}`);
  }

  const tagVersion = tag.slice(1);
  if (!SEMVER_PATTERN.test(tagVersion)) {
    throw new Error(`Release tag is not valid SemVer: ${tag}`);
  }

  if (!SEMVER_PATTERN.test(packageVersion)) {
    throw new Error(`package.json version is not valid SemVer: ${packageVersion}`);
  }

  if (tagVersion !== packageVersion) {
    throw new Error(`Release tag ${tag} does not match package.json version ${packageVersion}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tag = process.argv[2];
  const { default: packageJson } = await import('../package.json', { with: { type: 'json' } });
  const { version } = packageJson;

  try {
    validateReleaseTag(tag, version);
    console.log(`Validated release ${tag}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
