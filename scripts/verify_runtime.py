"""Production process, unchanged-official warmup, restart, and persistence checks.
Requires npm run build first. Does not call any LLM or public service.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request
from smoke_api import verify
ROOT=Path(__file__).resolve().parents[1]

def main():
    with tempfile.TemporaryDirectory(prefix='vera-runtime-') as temp:
        with socket.socket() as s:
            s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        url=f'http://127.0.0.1:{port}'
        env={**os.environ,'PORT':str(port),'HOST':'127.0.0.1','NODE_ENV':'production','STATE_FILE':str(Path(temp)/'state.json'),'PRELOAD_DATASET':'false','ENABLE_DASHBOARD':'false','BOT_URL':url,'BOT_TOKEN':'','PYTHONUTF8':'1'}
        def launch():
            proc=subprocess.Popen(['node','dist/server.cjs'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            for _ in range(150):
                if proc.poll() is not None: raise RuntimeError('Production server exited during startup')
                try:
                    with urllib.request.urlopen(url+'/v1/healthz',timeout=1): return proc
                except Exception: time.sleep(.05)
            proc.terminate();proc.wait();raise RuntimeError('Startup timed out')
        proc=launch()
        try:
            result=verify(url)
            warmup=subprocess.run(['python3' if os.name!='nt' else 'python','scripts/run_official_judge.py','warmup'],cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8')
            (ROOT/'reports/official-warmup.txt').write_text(warmup.stdout+warmup.stderr,encoding='utf-8')
            assert warmup.returncode==0
            with urllib.request.urlopen(url+'/v1/healthz') as r: before=json.load(r)['contexts_loaded']
        finally: proc.terminate();proc.wait(timeout=10)
        proc=launch()
        try:
            with urllib.request.urlopen(url+'/v1/healthz') as r: after=json.load(r)['contexts_loaded']
            assert before==after
            body={'now':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat().replace('+00:00','Z'),'available_triggers':[result['synthetic_context_id']]}
            req=urllib.request.Request(url+'/v1/tick',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(req) as r: assert json.load(r)['actions']==[]
            result.update(production_restart='PASS',persisted_counts=after,official_warmup='PASS (unchanged official warmup method, no LLM scoring)')
            (ROOT/'reports/production-runtime.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
            print(json.dumps(result,indent=2))
        finally: proc.terminate();proc.wait(timeout=10)

if __name__=='__main__': main()
