import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

assert.match(html, /^<!doctype html>/i, 'index.html should declare HTML5');

const ids = new Set();
for (const match of html.matchAll(/\bid=["']([^"']+)["']/g)) {
  assert.ok(!ids.has(match[1]), `duplicate HTML id: ${match[1]}`);
  ids.add(match[1]);
}

for (const match of html.matchAll(/\bhref=["']#([^"']+)["']/g)) {
  assert.ok(ids.has(match[1]), `fragment link points to missing id: ${match[1]}`);
}

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length > 0, 'the app should contain its inline controller script');
for (const [, attributes, source] of scripts) {
  assert.ok(!/\bsrc\s*=/i.test(attributes), 'unexpected external script dependency');
  assert.doesNotThrow(() => new Function(source), 'inline script must parse as JavaScript');
}

console.log(`Static checks passed: ${ids.size} unique IDs, ${scripts.length} inline script(s).`);