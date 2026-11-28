/**
 * The shipped data (scripts/build-data.py → data/): the registry's closed outlines, the records each holds per dataset,
 * and the rules of DATA_METHOD.md — one grain per dataset, missing never 0, every highlight with its universe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {readFileSync} from 'node:fs';
import {cell, rai, km2Text} from '../js/model.js';

test('one row per outline: the registry\'s 358 closed outlines, the 37 lodging areas with a draft and the outlines of the commercial screen (0.5.0: 56; 0.6.1: 74; 0.7.8: 139), unique codes, a display outline and a province each', () => {
  const {model, outlines} = load();
  const ids = model.rows.map(r => r.id);
  const t = model.meta.totals;
  assert.equal(t.closed, 358);
  assert.equal(t.lodgingDrawn, 37);
  assert.equal(model.rows.length, t.outlined);
  // 0.6.1: the 56 of 0.5.0, 13 over 1 km the owner chose to use, 5 drawn with CityMETER Building V4 (74); 0.7.8: the 65 he
  // ticked on 27 Nov 10:44 (13 used as drawn, 11 narrow arms off, 41 cut to 1 km)
  assert.equal(t.screenDrawn, 139);
  // (0.8.0) the 184 outlines the registry's commercial outline review (round 4) delivered beyond 0.7.10's 534
  assert.equal(t.reviewDrawn, 184);
  assert.equal(model.rows.filter(r => r.kind === 'review').length, t.reviewDrawn);
  assert.equal(t.outlined, t.closed + t.lodgingDrawn + t.screenDrawn + t.reviewDrawn);
  assert.equal(model.rows.filter(r => r.kind === 'registry').length, t.closed);
  assert.equal(model.rows.filter(r => r.kind === 'lodging').length, t.lodgingDrawn);
  assert.equal(model.rows.filter(r => r.kind === 'screen').length, t.screenDrawn);
  // the registry's outlines first, in canonical order; the lodging areas after them, then the commercial screen's
  assert.ok(model.rows.slice(0, t.closed).every(r => r.kind === 'registry'));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(outlines.features.map(f => String(f.properties.id)).sort(), [...ids].sort());
  for (const f of outlines.features) assert.equal(f.properties.kind, model.byId.get(String(f.properties.id)).kind);
  for (const r of model.rows) {
    // (0.2.1) the registry admitted the lodging areas: central codes CMN-TH-<hex of the screen's LP-NEW-<hex>>
    assert.match(r.id, r.kind === 'registry' ? /^CMN-TH-[0-9A-Z]+$/ : /^CMN-TH-[0-9A-F]{10}$/);
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
    // (0.8.0) a counted-only dataset (its points stay private: the masters' rights gate) writes no point to the shards
    assert.equal(perDs.get(ds.index) || 0, ds.aggregate ? 0 : ds.inside, `${ds.id} points`);
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
    for (const ds of model.datasets) assert.equal(byDs.get(ds.index) || 0, ds.aggregate ? 0 : r.c[ds.id] || 0, `${r.id} ${ds.id}`);
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
  // (0.2.1) every code of the registry: closed outlines, the admitted lodging areas with a draft outline, held codes
  // (the registry's 2 and the 42 admitted lodging areas without an outline) and collection names; (0.5.0) the commercial
  // screen's outlines, its codes without one (held) and the one held until the owner decides (not on the page); (0.7.8)
  // the one he took off the screen (“ไม่นับเป็นย่านการค้า ลบทิ้ง”): still a code of the registry, not on the page
  // (0.8.0) and the outlines of the registry's review: every principal code drawn or held, its collection names, the one removed
  assert.equal(m.totals.closed + m.totals.lodgingDrawn + m.totals.screenDrawn + m.totals.reviewDrawn + m.totals.held + m.totals.collections + m.totals.screenHeld + m.totals.screenRemoved, m.totals.codes);
  assert.equal(m.totals.codes, 1012);   // 0.8.0: 1,001 principal codes, 10 collection names, 1 removed (677 in 0.7.8)
  assert.equal(m.totals.principal, 1001);
  assert.equal(m.totals.admitted, 79);
  assert.equal(m.registry.admitted.codes, 79);
  assert.equal(m.registry.admitted.on, '2026-11-18');
  assert.match(m.registry.admitted.rowsSha256, /^[0-9a-f]{64}$/);
  // (0.2.1) the 42 admitted lodging areas without an outline are held codes of the registry now (counted in held)
  assert.equal(model.pending.length, m.totals.held + m.totals.collections);
  assert.equal(model.pending.filter(p => p.screen === 'lodging').length, m.totals.lodgingUndrawn);
  assert.equal(m.bundle.revision.policy_version, '2026-11-17-commercial-recovery-9');
  assert.equal(m.bundle.revision.closed_neighbourhoods, 358);
  assert.equal(m.bundle.revision.positive_area_overlap_pairs, 0);
  // (0.8.0) the 16 demos, Housing Estate and Tourism, parks and places of worship from OpenStreetMap (their registers have
  // no point yet) and 18 research registers without a demo
  assert.equal(model.datasets.length, 38);
  assert.equal(model.datasets.filter(d => d.aggregate).length, 20);
  assert.deepEqual(model.datasets.filter(d => d.placedBy?.osm).map(d => d.id).sort(), ['park', 'temple']);
  for (const ds of model.datasets) {
    if (ds.aggregate) {
      assert.match(ds.source.registry, /^research\.TH\.[a-z_]+$/, ds.id);
    } else {
      assert.match(ds.source.repo, /^montri-th\/[a-z]+$/, ds.id);
      assert.match(ds.source.commit, /^[0-9a-f]{40}$/, ds.id);
    }
    assert.match(ds.source.sha256, /^[0-9a-f]{64}$/, ds.id);
    assert.ok(ds.scope.th && ds.scope.en, ds.id);
    assert.ok(['Land', 'Location', 'Living'].includes(ds.group), ds.id);
  }
});

test('areas read in ไร่ (owner 2026-11-18: hectares mean nothing to a Thai reader), the km² beside them never prints as 0', () => {
  const {model} = load();
  assert.equal(rai(1600 * 31.25), '31');
  assert.equal(rai(1600 * 4.24), '4.2');
  assert.equal(rai(500), '0.31');
  assert.equal(km2Text(2.17), '2.2');
  assert.equal(km2Text(0.0005), '0.0005');
  for (const r of model.rows) {
    assert.notEqual(rai(r.areaM2), '0', r.id);
    assert.notEqual(km2Text(r.km2), '0', r.id);
  }
  for (const f of ['js/panel.js', 'js/app.js', 'js/lang-en.js', 'index.html']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /เฮกตาร์|hectares\(|, 'ha'\)/, f);
  }
});
