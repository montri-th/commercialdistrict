/** Shared loaders for the node tests (data files are read once per process). */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {decodeData, setProvinces} from '../js/model.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
export const readJSON = path => { if (!cache.has(path)) cache.set(path, JSON.parse(readFileSync(join(ROOT, path), 'utf8'))); return cache.get(path); };
export const readBytes = path => readFileSync(join(ROOT, path));
export const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

let loaded = null;
/** The shipped data set, decoded exactly as the browser does. */
export function load() {
  if (!loaded) {
    const provincesGeo = readJSON('data/provinces.geojson');
    setProvinces(provincesGeo);
    const raw = readJSON('data/neighborhoods.json');
    const model = decodeData(raw);
    const outlines = readJSON('data/boundaries.geojson');
    // The records of every neighbourhood (data/records/<id>.json, 0.1.3), in the shape the counts are checked in:
    // points[row index] = [[dataset index, lon, lat, subgroup]…]; shards[id] = the file as shipped.
    const shards = {}, points = [], rows = [];
    model.rows.forEach((r, i) => {
      const shard = readJSON(`data/records/${r.id}.json`);
      shards[r.id] = shard;
      const F = Object.fromEntries(shard.fields.map((f, k) => [f, k]));
      points[i] = shard.rows.map(x => [x[F.dataset], x[F.lon], x[F.lat], x[F.subgroup]]);
      for (const x of points[i]) rows.push([x[0], i, x[1], x[2], x[3]]);
    });
    loaded = {raw, model, provincesGeo, outlines, pointsRaw: {rows}, points, shards};
  }
  return loaded;
}
