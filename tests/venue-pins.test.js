/**
 * (0.4.1, owner 2026-11-25 23:01 “ทำตามที่พี่เสนอเลยครับ”, D-11) A shopping centre or market counted in a neighbourhood is
 * never hidden by another pin in the all view: at its own point and within 15 m of it, its pin is drawn above every
 * other record's pin (symbol-sort-key, higher on top); a point holding records of several datasets reads as a pile;
 * and the all view names every centre. Checked over every neighbourhood's records (data/records/).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {decodeRecords, spotsOf, labelItems, tipHTML} from '../js/records.js';
import {poiCollection, VENUE_LIFT, isVenue} from '../js/layers.js';

const metres = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180), (a[1] - b[1]) * 110540);
const NEAR = 15;

test('in the all view every centre counted in a neighbourhood is the top pin at its point and near it, and named', () => {
  const {model, shards} = load();
  let centres = 0, covered = 0, piles = 0;
  for (const r of model.rows) {
    const spots = spotsOf(decodeRecords(shards[r.id], model));
    const fc = poiCollection(spots, () => 1);
    const named = new Set(labelItems(spots, '').map(x => x.id));
    spots.forEach((g, i) => {
      if (!isVenue(g.ds)) return;
      centres += g.items.length;
      const me = fc.features[i];
      assert.ok(named.has(i), `${r.id}: ${g.items[0].name} is named in the all view`);
      spots.forEach((h, j) => {
        if (j === i || metres([g.lon, g.lat], [h.lon, h.lat]) > NEAR) return;
        const other = fc.features[j];
        if (!isVenue(h.ds) && other.properties.sort >= me.properties.sort) covered++;
        if (h.lon === g.lon && h.lat === g.lat) {
          piles++;
          assert.match(me.properties.icon, /:stack/, `${r.id}: ${g.items[0].name} reads as a pile`);
        }
      });
    });
  }
  assert.equal(covered, 0, 'no record pin at or within 15 m of a centre is drawn above it');
  // 0.4.0 data: 627 centres inside 227 outlines (data/neighborhoods.json datasets[].inside); 68 shared their exact point
  // with a later-drawn pin and were hidden in the all view (True Digital Park in ปุณณวิถี among them)
  assert.equal(centres, model.datasets.find(ds => ds.id === 'shoppingcenter').inside);
  assert.ok(piles > 0, 'some centres share their point with other records');
});

test('a centre stays on top with another set chosen only among the quiet dots; the chosen set stays above it', () => {
  const {model, shards} = load();
  const r = model.rows.find(x => x.name === 'ปุณณวิถี');
  const spots = spotsOf(decodeRecords(shards[r.id], model));
  const sortOf = (fc, pred) => fc.features.filter((f, i) => pred(spots[i])).map(f => f.properties.sort);
  const all = poiCollection(spots, () => 1);
  const tdp = spots.findIndex(g => isVenue(g.ds));
  assert.ok(tdp >= 0, 'True Digital Park is counted in ปุณณวิถี');
  assert.equal(all.features[tdp].properties.sort, 2 + VENUE_LIFT);
  assert.ok(Math.max(...sortOf(all, g => !isVenue(g.ds))) < all.features[tdp].properties.sort);
  const fit = poiCollection(spots, () => 1, {chosen: 'fitness'});
  assert.ok(Math.min(...sortOf(fit, g => g.ds.id === 'fitness')) > fit.features[tdp].properties.sort, 'the chosen set is above the quiet centre');
  // the pointer over the centre reads the whole pile, in words and without a total across datasets (INV-01)
  const here = spots.filter(g => g.lon === spots[tdp].lon && g.lat === spots[tdp].lat);
  assert.ok(here.length >= 2, 'the centre and the gym the source places at its point (the office record lies 0.1 m away)');
  const tip = tipHTML(here).replace(/<[^>]+>/g, ' ');
  assert.match(tip, /ตรงนี้มีหลายชุดซ้อนกัน/);
  assert.ok(!/\d+\s*(รายการ|ชุด)/.test(tip), 'no count in the tip');
  for (const g of here) assert.ok(tip.includes(g.items[0].name), g.ds.id);
});
