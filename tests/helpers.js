/** Shared loaders for the node tests (data files are read once per process). */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {decodeData, decodePoints, setProvinces} from '../js/model.js';

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
    const pointsRaw = readJSON('data/points.json');
    const points = decodePoints(pointsRaw, model.rows.length);
    loaded = {raw, model, provincesGeo, outlines, pointsRaw, points};
  }
  return loaded;
}
