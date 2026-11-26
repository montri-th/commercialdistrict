/**
 * The English page leaves no Thai but names (AGENTS.md “Run an English harvest (every view) before a release”): every
 * neighbourhood at every distance, with and without the surroundings file, every province's overview with and without a
 * dataset, and a comparison, rendered as the English page builds them (tests/english-check.mjs, a process of its own
 * because the page's language is read once when js/shell/i18n.js loads), every text and every translated attribute
 * through the shell's own translate() and the names js/lang.js keeps in Thai.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {ROOT} from './helpers.js';

test('English: every view of the panel, no Thai left but the names kept in Thai', () => {
  const out = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'tests/english-check.mjs'), '1'], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24}));
  assert.ok(out.views > 1900, `views: ${out.views}`);
  assert.ok(out.texts > 10000, `Thai texts looked at: ${out.texts}`);
  assert.deepEqual(out.missing, []);
});
