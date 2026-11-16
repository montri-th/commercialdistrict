/**
 * Discovery (owner 2026-11-08: demos are not for search engines, but developers can reuse them) and the dataset group
 * (owner 2026-11-16: “ในหมวด Location”).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './helpers.js';

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

test('every page is noindex, nofollow, with no canonical to production, no robots.txt and no sitemap', () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.ok(!/rel="canonical"/.test(html), 'no canonical from a noindex page');
  assert.ok(!existsSync(join(ROOT, 'robots.txt')));
  assert.ok(!existsSync(join(ROOT, 'sitemap.xml')));
  assert.match(html, /<meta name="citymeter:languages" content="th en">/);
});

test('the panel eyebrow names the Location group', () => {
  assert.match(html, /<p class="eyebrow">CITYMETER · LOCATION<\/p>/);
  assert.match(html, /<span class="product-name">Commercial District<\/span>/);
});
