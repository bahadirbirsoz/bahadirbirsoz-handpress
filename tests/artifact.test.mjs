// Artifact test: runs after `bun run build` and `node scripts/write-health.mjs $GITHUB_SHA`. It checks the files the image
// ships, not the app. It does not assert what nginx answers on /health.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';

const sha = process.env.GIT_SHA ?? process.env.GITHUB_SHA ?? '';

test('the build output holds the shell, the manifest, the service worker and the icons', () => {
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png']) {
    assert.ok(existsSync(`dist/${f}`), `dist/${f} is missing`);
  }
  assert.match(JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8')).name, /HandPress/);
});

test('dist/health.json carries the sha of this build and nothing else', () => {
  assert.match(sha, /^[0-9a-f]{40}$/, 'GIT_SHA or GITHUB_SHA must be a full sha');
  assert.deepEqual(JSON.parse(readFileSync('dist/health.json', 'utf8')), {status: 'ok', sha});
});

test('write-health refuses anything but a 40-character lowercase hex sha', () => {
  for (const bad of ['abc', 'a'.repeat(41), 'A'.repeat(40), '']) {
    const r = spawnSync('node', ['scripts/write-health.mjs', bad], {encoding: 'utf8'});
    assert.notEqual(r.status, 0, JSON.stringify(bad));
  }
});

test('the service worker never answers /health', () => {
  const sw = readFileSync('dist/sw.js', 'utf8');
  assert.match(sw, /denylist|\^\\\/health\$/, 'navigateFallbackDenylist for /health is not in sw.js');
});
