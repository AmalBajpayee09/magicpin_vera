"""Verify original challenge material bytes against the supplied package manifest."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'docs/OFFICIAL_SHA256.json').read_text())
for name,expected in manifest.items():
    actual=hashlib.sha256((root/'challenge_pack'/name).read_bytes()).hexdigest()
    if actual!=expected: raise SystemExit(f'Official file changed: {name}')
print(f'PASS: {len(manifest)} official files match the supplied archive byte-for-byte.')
