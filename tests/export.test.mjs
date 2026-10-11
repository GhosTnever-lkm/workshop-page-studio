// Unit tests for the inline export logic of index.html.
// The app is a single self-contained HTML file by design (offline, no external
// scripts), so the test extracts the inline script and evaluates it with a
// minimal DOM stub, then exercises the pure converter functions.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

function loadApp() {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'index.html must contain the inline app script');
  // Expose the pure helpers for testing without changing app behavior.
  const source = match[1].replace(
    /\}\)\(\)\s*;?\s*$/,
    ';globalThis.__wps = { toBB, toMD, safeHref, lines, list, slug, normalize, markdownLinkText, markdownLinkUrl };})()'
  );
  assert.notEqual(source, match[1], 'test hook injection failed');

  const elementStub = () =>
    new Proxy(function () {}, {
      get(target, key) {
        if (key === 'value' || key === 'textContent') return '';
        if (key === 'dataset') return {};
        if (key === 'files') return [];
        if (key === Symbol.toPrimitive) return () => '';
        return elementStub();
      },
      set: () => true,
      apply: () => elementStub(),
    });

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    JSON,
    navigator: { language: 'en' },
    window: {},
    document: {
      getElementById: () => elementStub(),
      querySelectorAll: () => [],
      querySelector: () => elementStub(),
      createElement: () => elementStub(),
      createTextNode: () => elementStub(),
      documentElement: elementStub(),
      body: elementStub(),
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  assert.ok(sandbox.__wps, 'app must expose helpers to the test');
  return sandbox.__wps;
}

const app = loadApp();
// vm-context objects come from another realm; normalize before deepEqual.
const plain = (v) => JSON.parse(JSON.stringify(v));

const sample = {
  title: 'Enhanced Weather',
  short: 'Dynamic storms.',
  body: 'Reworks weather cycles.',
  features: ['Storms', 'Fog'],
  compat: 'Game 1.4+',
  install: ['Download', 'Copy folder'],
  deps: ['Weather API 1.3'],
  languages: ['English', 'Russian'],
  changelog: ['1.0.0 — First release'],
  links: [{ label: 'Project page', url: 'https://example.com/mod' }],
};

test('lines() strips bullets and numbering', () => {
  assert.deepEqual(plain(app.lines('- one\n* two\n3. three\nplain\n\n')), ['one', 'two', 'three', 'plain']);
});

test('list() splits on newlines and commas', () => {
  assert.deepEqual(plain(app.list('English, Russian\nDeutsch')), ['English', 'Russian', 'Deutsch']);
});

test('safeHref allows only clean http(s) links', () => {
  assert.equal(app.safeHref('https://example.com/x'), 'https://example.com/x');
  assert.equal(app.safeHref('javascript:alert(1)'), null);
  assert.equal(app.safeHref('ftp://example.com/x'), null);
  assert.equal(app.safeHref('https://user:pass@example.com/'), null);
  assert.equal(app.safeHref('not a url'), null);
});

test('toBB builds Steam BBCode with all sections', () => {
  const bb = app.toBB(sample);
  assert.match(bb, /\[h1\]Enhanced Weather\[\/h1\]/);
  assert.match(bb, /\[i\]Dynamic storms\.\[\/i\]/);
  assert.match(bb, /\[h2\]Features\[\/h2\]\n\[list\]\n\[\*\]Storms/);
  assert.match(bb, /\[olist\]\n\[\*\]Download/); // installation is ordered
  assert.match(bb, /\[url=https:\/\/example\.com\/mod\]Project page\[\/url\]/);
  assert.match(bb, /English, Russian/);
});

test('toBB omits empty sections', () => {
  const bb = app.toBB({ ...sample, features: [], deps: [], links: [] });
  assert.doesNotMatch(bb, /Features/);
  assert.doesNotMatch(bb, /Dependencies/);
  assert.doesNotMatch(bb, /Links/);
});

test('toBB leaves unsafe links as plain text', () => {
  const bb = app.toBB({ ...sample, links: [{ label: 'evil', url: 'javascript:alert(1)' }] });
  assert.doesNotMatch(bb, /\[url=/);
  assert.match(bb, /evil/);
});

test('toMD builds Markdown with escaped link text', () => {
  const md = app.toMD(sample);
  assert.match(md, /^# Enhanced Weather/m);
  assert.match(md, /\*Dynamic storms\.\*/);
  assert.match(md, /## Features\n\n- Storms\n- Fog/);
  assert.match(md, /## Installation\n\n1\. Download\n2\. Copy folder/);
  assert.match(md, /\[Project page\]\(https:\/\/example\.com\/mod\)/);
});

test('markdownLinkText escapes brackets and backslashes', () => {
  assert.equal(app.markdownLinkText('a [b] \\ c'), 'a \\[b\\] \\\\ c');
});

test('markdownLinkUrl percent-encodes parentheses', () => {
  assert.equal(app.markdownLinkUrl('https://x.test/a(1)'), 'https://x.test/a%281%29');
});

test('slug makes safe file names', () => {
  assert.equal(app.slug('My Cool Mod!'), 'my-cool-mod');
  assert.equal(app.slug('Погода+'), 'погода');
  assert.equal(app.slug('!!!'), 'workshop-description');
});

test('normalize rejects invalid drafts and keeps valid ones', () => {
  assert.throws(() => app.normalize(null));
  assert.throws(() => app.normalize([1, 2]));
  assert.throws(() => app.normalize({ unrelated: true }));
  const d = app.normalize({ title: 'X', features: ['a', 5], links: [{ label: 'L', url: 'U' }, 'junk'] });
  assert.equal(d.title, 'X');
  assert.deepEqual(plain(d.features), ['a']);
  assert.deepEqual(plain(d.links), [{ label: 'L', url: 'U' }]);
});
