/**
 * The shipped data (scripts/build-data.py → data/): the registry's closed outlines, the records each holds per dataset,
 * and the rules of DATA_METHOD.md — one grain per dataset, missing never 0, every highlight with its universe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {cell} from '../js/model.js';

test('one row per outline: the registry\'s 358 closed outlines and the 37 lodging areas with a draft, unique codes, a display outline and a province each', () => {
  const {model, outlines} = load();
  const ids = model.rows.map(r => r.id);
  const t = model.meta.totals;
  assert.equal(t.closed, 358);
  assert.equal(t.lodgingDrawn, 37);
  assert.equal(model.rows.length, t.outlined);
  assert.equal(t.outlined, t.closed + t.lodgingDrawn);
  assert.equal(model.rows.filter(r => r.kind === 'registry').length, t.closed);
  assert.equal(model.rows.filter(r => r.kind === 'lodging').length, t.lodgingDrawn);
  // the registry's outlines first, in canonical order; the lodging areas after them
  assert.ok(model.rows.slice(0, t.closed).every(r => r.kind === 'registry'));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(outlines.features.map(f => String(f.properties.id)).sort(), [...ids].sort());
  for (const f of outlines.features) assert.equal(f.properties.kind, model.byId.get(String(f.properties.id)).kind);
  for (const r of model.rows) {
    assert.match(r.id, r.kind === 'lodging' ? /^LP-NEW-[0-9A-F]+$/ : /^CMN-TH-[0-9A-Z]+$/);
    assert.ok(r.areaM2 > 0 && r.km2 > 0, r.id);
    assert.ok(r.province && /^[A-Z]{3}$/.test(r.province), r.id);
    const [w, s, e, n] = r.bbox;
    assert.ok(w < e && s < n, r.id);
  }
  const area = model.rows.reduce((t, r) => t + r.areaM2, 0) / 1e6;
  assert.ok(Math.abs(area - model.meta.totals.areaKm2) < 0.01, `${area} km²`);
});

test('a dataset that has no located record in a province is out of scope there (no key, never 0); in scope it is a count', () => {
  const {model} = load();
  for (const ds of model.datasets) {
    // A located record outside every production province outline (at sea, past a simplified coast) counts nationally only.
    const located = Object.values(ds.byProvince || {}).reduce((a, b) => a + b, 0);
    assert.ok(located <= ds.located && located >= ds.located * 0.98, `${ds.id}: ${located} of ${ds.located} located records fall in a province`);
    assert.ok(ds.located <= ds.records, ds.id);
    for (const r of model.rows) {
      const covered = (ds.byProvince?.[r.province] || 0) > 0;
      assert.equal(ds.id in r.c, covered, `${ds.id} in ${r.id}`);
      const c = cell(r, ds);
      assert.equal(c.state, !covered ? 'out_of_scope' : r.c[ds.id] ? 'measured' : 'measured_zero');
    }
  }
});

test('counts add up per dataset (never across datasets): rows = inside = the points drawn, each point inside its row’s box', () => {
  const {model, points, pointsRaw} = load();
  assert.equal(pointsRaw.rows.length, model.meta.totals.insidePoints);
  const perDs = new Map();
  for (const [d] of pointsRaw.rows) perDs.set(d, (perDs.get(d) || 0) + 1);
  for (const ds of model.datasets) {
    const sum = model.rows.reduce((t, r) => t + (r.c[ds.id] || 0), 0);
    assert.equal(sum, ds.inside, ds.id);
    assert.equal(perDs.get(ds.index) || 0, ds.inside, `${ds.id} points`);
  }
  const eps = 1e-6;
  model.rows.forEach((r, i) => {
    const [w, s, e, n] = r.bbox;
    for (const [d, lon, lat] of points[i]) {
      assert.ok(lon >= w - eps && lon <= e + eps && lat >= s - eps && lat <= n + eps, `${r.id} ${model.datasets[d].id}`);
      assert.ok((r.c[model.datasets[d].id] || 0) > 0);
    }
    const byDs = new Map();
    for (const [d] of points[i]) byDs.set(d, (byDs.get(d) || 0) + 1);
    for (const ds of model.datasets) assert.equal(byDs.get(ds.index) || 0, r.c[ds.id] || 0, `${r.id} ${ds.id}`);
  });
});

test('highlights: at most four, one per dataset, each on a dataset present in the row, strong enough, its universe stated', () => {
  const {model} = load();
  const rules = model.meta.rules;
  for (const r of model.rows) {
    assert.ok(r.hl.length <= rules.maxHighlights, r.id);
    assert.equal(new Set(r.hl.map(h => h.d)).size, r.hl.length, r.id);
    for (const h of r.hl) {
      const ds = model.dsById.get(h.d);
      assert.ok(ds && r.c[h.d] > 0, `${r.id} ${h.d}`);
      assert.ok(h.p >= rules.strengthMin && h.p <= 1, `${r.id} ${h.d} ${h.p}`);
      assert.ok(['share', 'count', 'density', 'rare'].includes(h.k));
      if (h.k === 'share') assert.ok(Math.abs(h.v - r.c[h.d] / ds.located) < 1e-3 && h.v >= rules.nationalShare);
      if (h.k === 'count' || h.k === 'density' || h.k === 'rare') assert.ok(h.of > 0 && h.v >= 1 && h.v <= h.of, `${r.id} ${h.d}`);
      if (h.k === 'density') assert.ok(r.c[h.d] >= rules.minCount && h.of >= rules.minPeers);
    }
    for (let i = 1; i < r.hl.length; i++) assert.ok(r.hl[i - 1].p >= r.hl[i].p, `${r.id}: strongest first`);
  }
});

test('pairs: Spearman ρ on density across the neighbourhoods both datasets cover; a row’s pairs are strong pairs of its own highlights', () => {
  const {model} = load();
  const strong = new Set(model.pairs.filter(p => p.rho >= model.meta.rules.pairMinRho).map(p => `${p.a}|${p.b}`));
  for (const p of model.pairs) {
    assert.ok(p.rho >= -1 && p.rho <= 1 && p.n >= 30 && p.both >= model.meta.rules.pairMinBoth, `${p.a}|${p.b}`);
    assert.ok(model.dsById.has(p.a) && model.dsById.has(p.b));
  }
  for (const r of model.rows) {
    const hl = new Set(r.hl.map(h => h.d));
    for (const [a, b] of r.pairs) {
      assert.ok(strong.has(`${a}|${b}`), `${r.id} ${a}|${b}`);
      assert.ok(hl.has(a) && hl.has(b));
    }
  }
});

test('metadata names the registry read, its export and the bundle by SHA-256, and every dataset’s source commit', () => {
  const {model} = load();
  const m = model.meta;
  assert.match(m.registry.readOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(m.registry.exportSha256, /^[0-9a-f]{64}$/);
  assert.match(m.bundle.sha256, /^[0-9a-f]{64}$/);
  assert.match(m.bundle.boundariesSha256, /^[0-9a-f]{64}$/);
  assert.equal(m.totals.closed + m.totals.held + m.totals.collections, m.totals.codes);
  assert.equal(model.pending.length, m.totals.held + m.totals.collections + m.totals.lodgingUndrawn);
  assert.equal(m.bundle.revision.policy_version, '2026-11-17-commercial-recovery-9');
  assert.equal(m.bundle.revision.closed_neighbourhoods, 358);
  assert.equal(m.bundle.revision.positive_area_overlap_pairs, 0);
  assert.equal(model.datasets.length, 16);
  for (const ds of model.datasets) {
    assert.match(ds.source.repo, /^montri-th\/[a-z]+$/, ds.id);
    assert.match(ds.source.commit, /^[0-9a-f]{40}$/, ds.id);
    assert.match(ds.source.sha256, /^[0-9a-f]{64}$/, ds.id);
    assert.ok(ds.scope.th && ds.scope.en, ds.id);
    assert.ok(['Land', 'Location', 'Living'].includes(ds.group), ds.id);
  }
});
