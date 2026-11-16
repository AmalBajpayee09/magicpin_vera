"""Create one clean project ZIP; no dependency/build/cache/runtime/secret files."""
import argparse
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parents[1]
EXCLUDED={'node_modules','dist','build','.git','data','__pycache__','coverage','.pytest_cache'}
def included(p):
    rel=p.relative_to(ROOT)
    if any(part in EXCLUDED for part in rel.parts): return False
    if p.name.startswith('.env') and p.name!='.env.example': return False
    if p.suffix in {'.pyc','.zip','.tmp','.log'}: return False
    return True
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',required=True);a=parser.parse_args()
    files=[p for p in sorted(ROOT.rglob('*')) if p.is_file() and included(p)]
    with zipfile.ZipFile(a.out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in files:z.write(p,Path('VERA_MAGICPIN_FINAL_SUBMISSION')/p.relative_to(ROOT))
    with zipfile.ZipFile(a.out) as z:assert z.testzip() is None
    print(f'Created {a.out}: {len(files)} files; CRC verified.')
