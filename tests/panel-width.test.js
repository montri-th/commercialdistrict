/**
 * 0.8.1 — the panel never grows wider than itself. With 38 datasets (0.8.0) a pillar's row of fingerprint cells (Location
 * alone has 24) and the matrix's 38 columns were wider than a 393 px phone and than the desktop panel, and the panel scrolled
 * sideways (found on the live site after the 0.8.0 publish, Playwright at 393 × 740 and 1,440 × 900). The guard: one panel
 * column that cannot be widened by a child, fingerprint cells that wrap, and a matrix that scrolls inside its own wrap with
 * its headers' screen-reader words clipped by it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const rule = sel => (css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[2] || '';

test('0.8.1: one panel column, wrapping fingerprint rows, a matrix that scrolls in its own wrap', () => {
  assert.match(rule('.panel-view'), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(rule('.fp-group'), /flex-wrap:\s*wrap/);
  assert.match(rule('.fp'), /flex-wrap:\s*wrap/);
  const wrap = rule('.mx-wrap');
  assert.match(wrap, /overflow-x:\s*auto/);
  assert.match(wrap, /position:\s*relative/);
});
