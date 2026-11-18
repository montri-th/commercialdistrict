#!/usr/bin/env python3
"""Restore one member of the owner's registry bundle that the bundle stores as a lossless xz literal (since 2026-11-18),
checking every SHA-256 its recipe declares. Reads the unzipped bundle as data only; writes the member outside it.

    python3 -I scripts/restore-bundle-member.py <unzipped bundle> <member path in LOSSLESS_HISTORY_RECIPES.json> <out file>

The canonical outlines of release 2026-11-17-commercial-recovery-9 (national-gis/canonical-boundaries.geojson, a byte
alias of lodging-review-2026-11-17/inputs/canonical-boundaries-existing358.geojson in LOSSLESS_BYTE_ALIASES.json):

    python3 -I scripts/restore-bundle-member.py <bundle> lodging-review-2026-11-17/inputs/canonical-boundaries-existing358.geojson \\
        <folder>/national-gis/canonical-boundaries.geojson
"""
import hashlib, json, lzma, sys

bundle, member, out = sys.argv[1], sys.argv[2], sys.argv[3]
rec = json.load(open(f'{bundle}/LOSSLESS_HISTORY_RECIPES.json', encoding='utf-8'))['recipes'][member]
if rec['source_bytes'] != 0 or rec['operations'] != [['literal', 0, rec['literal_bytes']]]:
    raise SystemExit('only a pure literal recipe is restored here')
enc = open(f"{bundle}/{rec['literal_member']}", 'rb').read()
if hashlib.sha256(enc).hexdigest() != rec['encoded_literal_sha256']:
    raise SystemExit('encoded literal: SHA-256 differs from the recipe')
raw = lzma.decompress(enc)
if len(raw) != rec['target_bytes'] or hashlib.sha256(raw).hexdigest() != rec['target_sha256']:
    raise SystemExit('restored member: size or SHA-256 differs from the recipe')
with open(out, 'wb') as f:
    f.write(raw)
print(f"restored {member}: {len(raw)} bytes, SHA-256 {rec['target_sha256']}")
