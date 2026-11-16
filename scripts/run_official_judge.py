"""Configure the unchanged official simulator without embedding secrets in its source.
Warmup makes no LLM calls; scoring modes require the user's own credential.
"""
import importlib.util
import os
from pathlib import Path
import sys
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('official_judge', root / 'challenge_pack/judge_simulator.py')
judge = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = judge
spec.loader.exec_module(judge)
judge.BOT_URL = os.environ.get('BOT_URL', 'http://127.0.0.1:8080')
judge.LLM_PROVIDER = os.environ.get('LLM_PROVIDER', 'openai')
judge.LLM_API_KEY = os.environ.get('LLM_API_KEY', '')
judge.LLM_MODEL = os.environ.get('LLM_MODEL', '')
judge.OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://localhost:11434')
judge.TEST_SCENARIO = sys.argv[1] if len(sys.argv) > 1 else 'all'
if judge.TEST_SCENARIO == 'warmup':
    # _warmup only exercises health/metadata/context. It never invokes this sentinel.
    class UnusedLLM(judge.LLMProvider):
        def name(self): return 'not used (warmup only)'
        def complete(self, *args, **kwargs): raise RuntimeError('Unexpected LLM call in warmup')
    ok = judge.JudgeSimulator(UnusedLLM()).run('warmup')
    sys.exit(0 if ok else 1)
judge.main()
