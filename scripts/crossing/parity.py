#!/usr/bin/env python3
"""
CityMETER · Commercial District — how closely scripts/crossing/ reads the Shopping Center page's rule (0.7.5, V7-09).

    python3 -I scripts/crossing/parity.py --cache <rivers cache> --shoppingcenter <montri-th/shoppingcenter checkout>

Runs the banks and crossings of this repository from each centre's point, as the Shopping Center measures (a spherical
azimuthal equidistant window ±10 km round the point, R = 6,371,008.8 m), over the 250 m cells of its residents map, and
compares with what that page publishes for the same cells (data/crossing/NNN.json `x.k`: the cells across a river within
5 km and their distance through the crossings, in tens of metres). Prints the agreement; writes nothing.
"""
import argparse
import glob
import json
import math
import os
import pickle
import sys

import numpy as np
import shapely

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from banks import Banks, Rivers  # noqa: E402

R = 6371008.8


def sphere_fwd(lon0, lat0):
    p0, l0 = math.radians(lat0), math.radians(lon0)

    def f(lon, lat):
        p, l = np.radians(np.asarray(lat, dtype='f8')), np.radians(np.asarray(lon, dtype='f8'))
        c = np.arccos(np.clip(math.sin(p0) * np.sin(p) + math.cos(p0) * np.cos(p) * np.cos(l - l0), -1, 1))
        k = np.where(c < 1e-12, 1.0, c / np.where(np.sin(c) == 0, 1, np.sin(c)))
        return R * k * np.cos(p) * np.sin(l - l0), R * k * (math.cos(p0) * np.sin(p) - math.sin(p0) * np.cos(p) * np.cos(l - l0))
    return f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', required=True)
    ap.add_argument('--shoppingcenter', required=True)
    a = ap.parse_args()
    with open(a.cache, 'rb') as f:
        rivers = Rivers(pickle.load(f))
    rows = json.load(open(os.path.join(a.shoppingcenter, 'data', 'venues.json')))['rows']
    at = {}
    for r in rows:
        if r.get('located') and r.get('lat') is not None:
            for k in (r.get('id'), r.get('scId')):
                if k:
                    at[k] = (r['lon'], r['lat'])
    pub = {}
    for f in glob.glob(os.path.join(a.shoppingcenter, 'data', 'crossing', '[0-9]*.json')):
        for vid, r in json.load(open(f))['venues'].items():
            if r.get('x'):
                pub[vid] = dict(r['x'].get('k', []))
    meta = json.load(open(os.path.join(a.shoppingcenter, 'data', 'crossing', 'meta.json')))
    for vid in meta.get('riverNoAcross', []):
        pub.setdefault(vid, {})
    n, m = 40, 250
    k = np.arange(n * n)
    cx, cy = (k % n - n / 2 + 0.5) * m, (n / 2 - 1 - k // n + 0.5) * m
    straight = np.hypot(cx, cy)
    disc = np.hypot(np.maximum(0, np.abs(cx) - m / 2), np.maximum(0, np.abs(cy) - m / 2)) <= 5000
    tot = dict(centres=0, published=0, mine=0, both=0, equal=0, within20=0, farther=0, reach=0)
    for vid, pk in sorted(pub.items()):
        lon, lat = at[vid]
        b = Banks(rivers, sphere_fwd(lon, lat), shapely.Point(0, 0), (lon, lat, lon, lat))
        d, across, _ = b.measure(cx, cy, straight)
        mine = {int(i): (int(round(d[i] / 10)) if np.isfinite(d[i]) else -1) for i in np.nonzero(across & disc)[0]}
        both = set(pk) & set(mine)
        tot['centres'] += 1
        tot['published'] += len(pk)
        tot['mine'] += len(mine)
        tot['both'] += len(both)
        for i in both:
            p, q = pk[i], mine[i]
            if (p < 0) != (q < 0):
                tot['reach'] += 1
            elif p == q:
                tot['equal'] += 1
            elif abs(p - q) <= 2:
                tot['within20'] += 1
            else:
                tot['farther'] += 1
    print(json.dumps(tot))
    print(f"cells across: {tot['both']:,} of {tot['published']:,} published found ({tot['both'] / tot['published'] * 100:.2f} %), "
          f"{tot['mine'] - tot['both']:,} more here; distance equal to 10 m {tot['equal'] / tot['both'] * 100:.2f} %, "
          f"within 20 m {(tot['equal'] + tot['within20']) / tot['both'] * 100:.2f} %, farther {tot['farther']:,}, reached on one side only {tot['reach']:,}")


if __name__ == '__main__':
    main()
