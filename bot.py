"""Offline compatibility adapter; Node dependencies must be installed first."""
import json
from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parent

def compose(category: dict, merchant: dict, trigger: dict, customer: dict | None = None) -> dict:
    result = subprocess.run(['node', '--import', 'tsx', 'scripts/compose_json.ts'], cwd=ROOT,
        input=json.dumps(dict(category=category, merchant=merchant, trigger=trigger, customer=customer)),
        text=True, encoding='utf-8', capture_output=True, check=True, timeout=20)
    return json.loads(result.stdout)
