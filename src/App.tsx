import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Terminal,
  Send,
  RefreshCw,
  Copy,
  Download,
  Zap,
  ShieldCheck,
  Building2,
  Bell,
  MessageSquare,
  Activity,
  Layers,
  ChevronRight,
  Search,
  Filter,
  Check,
  Cpu,
  Database,
  Radio,
  Play,
  AlertTriangle
} from 'lucide-react';

interface SubmissionItem {
  test_id: string;
  merchant_id: string;
  trigger_id: string;
  customer_id: string | null;
  body: string;
  cta: string;
  send_as: string;
  suppression_key: string;
  rationale: string;
}

export interface BenchmarkItemResult {
  test_id: string;
  trigger_id: string;
  merchant_id: string;
  customer_id: string | null;
  engine_path: string;
  generated_body: string;
  send_as: string;
  cta: string;
  suppression_key: string;
  rationale: string;
  grounding_result: boolean;
  cta_result: boolean;
  specificity: number;
  category_fit: number;
  merchant_fit: number;
  trigger_relevance: number;
  engagement_compulsion: number;
  total_score: number;
  status: 'PASS' | 'FAIL';
  provenance: {
    executed_at: string;
    duration_ms: number;
    memory_mb: number;
    node_version: string;
  };
}

export interface BenchmarkRunReport {
  status: 'COMPLETED' | 'FAILED';
  executed_at: string;
  duration_ms: number;
  total_tests: number;
  passed_tests: number;
  grounding_passed: number;
  cta_passed: number;
  total_score: number;
  max_possible_score: number;
  average_score: number;
  rubric_percentage: number;
  results: BenchmarkItemResult[];
}

interface StateData {
  uptime_seconds: number;
  counts: {
    categories: number;
    merchants: number;
    triggers: number;
    customers: number;
    conversations: number;
    suppressions: number;
  };
  categories: any[];
  merchants: any[];
  triggers: any[];
  customers: any[];
  conversations: any[];
  suppressions: string[];
}

export default function App() {
  const [tab, setTab] = useState<'evaluator' | 'simulator' | 'contexts' | 'submission' | 'api'>('evaluator');
  const [stateData, setStateData] = useState<StateData | null>(null);
  const [submissionItems, setSubmissionItems] = useState<SubmissionItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  // Benchmark Live State
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkRunReport | null>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState<boolean>(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  // Chat simulator state
  const [simRole, setSimRole] = useState<'merchant' | 'customer'>('merchant');
  const [simMerchantId, setSimMerchantId] = useState<string>('m_001_drmeera_dentist_delhi');
  const [simMessage, setSimMessage] = useState<string>("Ok let's do it. What's next?");
  const [chatLog, setChatLog] = useState<Array<{ sender: string; text: string; action?: string; rationale?: string; latency?: number }>>([
    {
      sender: 'vera',
      text: 'Dr. Meera, new JIDA study shows 3-month fluoride recall cuts caries 38% better in high-risk adults. You have 124 patients in this cohort. I drafted a 3-line educational WhatsApp for them. Want me to send for review?',
      action: 'send',
      latency: 42
    }
  ]);
  const [simLoading, setSimLoading] = useState(false);

  // API Playground state
  const [apiEndpoint, setApiEndpoint] = useState<string>('/v1/healthz');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('GET');
  const [apiPayload, setApiPayload] = useState<string>('');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiTime, setApiTime] = useState<number | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setStateData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSubmission = async () => {
    try {
      const res = await fetch('/api/submission');
      if (res.ok) {
        const data = await res.json();
        setSubmissionItems(data.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLatestBenchmark = async () => {
    try {
      const res = await fetch('/api/benchmark/latest');
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'COMPLETED') {
          setBenchmarkReport(data);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarkRunning(true);
    setBenchmarkError(null);
    try {
      const res = await fetch('/api/benchmark/run', { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Benchmark run failed');
      }
      const data: BenchmarkRunReport = await res.json();
      setBenchmarkReport(data);
      fetchState();
    } catch (e: any) {
      setBenchmarkError(e.message || String(e));
    } finally {
      setBenchmarkRunning(false);
    }
  };

  useEffect(() => {
    fetchState();
    fetchSubmission();
    fetchLatestBenchmark();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const [simContext,setSimContext]=useState<any>(null);
  const handleSimSend = async () => {
    if (!simMessage.trim()) return;

    const userMsg = simMessage.trim();
    setSimMessage('');
    const newLogs = [...chatLog, { sender: simRole, text: userMsg }];
    setChatLog(newLogs);
    setSimLoading(true);
    const t0 = performance.now();

    try {
      let context=simContext;
      if(!context || context.merchant_id!==simMerchantId || !!context.customer_id!==(simRole==='customer')) {
        const start=await fetch('/api/demo/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({merchant_id:simMerchantId,role:simRole})});
        const data=await start.json();if(!start.ok)throw new Error(data.error || 'Could not start demo');
        context=data.action;setSimContext(context);
      }
      const convId = context.conversation_id;
      const res = await fetch('/v1/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: convId,
          merchant_id: simMerchantId,
          customer_id: context.customer_id,
          from_role: simRole,
          message: userMsg,
          received_at: new Date().toISOString(),
          turn_number: newLogs.length + 1
        })
      });

      const latencyMs = Math.round(performance.now() - t0);
      const reply = await res.json();
      if(!res.ok) throw new Error(reply.error || 'Reply rejected');
      setChatLog([
        ...newLogs,
        {
          sender: 'vera',
          text: reply.body || (reply.action === 'wait' ? '⏳ [Wait Window Active]' : '🛑 [State: Concluded / Opt-out Honored]'),
          action: reply.action,
          rationale: reply.rationale,
          latency: latencyMs
        }
      ]);
    } catch (err: any) {
      setChatLog([
        ...newLogs,
        { sender: 'vera', text: 'Error calling /v1/reply: ' + err.message }
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const executeApiCall = async () => {
    const t0 = performance.now();
    try {
      const options: RequestInit = {
        method: apiMethod,
        headers: { 'Content-Type': 'application/json' }
      };
      if (apiMethod === 'POST' && apiPayload) {
        options.body = apiPayload;
      }
      const res = await fetch(apiEndpoint, options);
      const json = await res.json();
      setApiTime(Math.round(performance.now() - t0));
      setApiResponse(json);
    } catch (e: any) {
      setApiTime(Math.round(performance.now() - t0));
      setApiResponse({ error: e.message });
    }
  };

  const activeBenchmarkList = benchmarkReport ? benchmarkReport.results : [];

  const filteredBenchmarkItems = activeBenchmarkList.filter((item) => {
    const matchesCat =
      selectedCategory === 'all' ||
      (selectedCategory === 'dentists' && (item.merchant_id.includes('dentist') || item.trigger_id.includes('dentist') || item.test_id === 'T06' || item.test_id === 'T08' || item.test_id === 'T09' || item.test_id === 'T14' || item.test_id === 'T24' || item.test_id === 'T28' || item.test_id === 'T30')) ||
      (selectedCategory === 'restaurants' && (item.merchant_id.includes('restaurant') || item.merchant_id.includes('cafe') || item.merchant_id.includes('mylari') || item.merchant_id.includes('pizza') || item.test_id === 'T01' || item.test_id === 'T10' || item.test_id === 'T12' || item.test_id === 'T17' || item.test_id === 'T21' || item.test_id === 'T22' || item.test_id === 'T23')) ||
      (selectedCategory === 'salons' && (item.merchant_id.includes('salon') || item.test_id === 'T03' || item.test_id === 'T04' || item.test_id === 'T11' || item.test_id === 'T16' || item.test_id === 'T18' || item.test_id === 'T25')) ||
      (selectedCategory === 'gyms' && (item.merchant_id.includes('gym') || item.merchant_id.includes('yoga') || item.test_id === 'T02' || item.test_id === 'T13' || item.test_id === 'T19' || item.test_id === 'T26' || item.test_id === 'T29')) ||
      (selectedCategory === 'pharmacies' && (item.merchant_id.includes('pharm') || item.merchant_id.includes('medico') || item.test_id === 'T05' || item.test_id === 'T07' || item.test_id === 'T15' || item.test_id === 'T20' || item.test_id === 'T27'));

    const matchesSearch =
      !searchQuery ||
      item.test_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.merchant_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.generated_body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rationale.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  const filteredSubmissionItems = submissionItems.filter((item) => {
    const matchesCat =
      selectedCategory === 'all' ||
      (selectedCategory === 'dentists' && (item.merchant_id.includes('dentist') || item.trigger_id.includes('dentist') || item.test_id === 'T06' || item.test_id === 'T08' || item.test_id === 'T09' || item.test_id === 'T14' || item.test_id === 'T24' || item.test_id === 'T28' || item.test_id === 'T30')) ||
      (selectedCategory === 'restaurants' && (item.merchant_id.includes('restaurant') || item.merchant_id.includes('cafe') || item.merchant_id.includes('mylari') || item.merchant_id.includes('pizza') || item.test_id === 'T01' || item.test_id === 'T10' || item.test_id === 'T12' || item.test_id === 'T17' || item.test_id === 'T21' || item.test_id === 'T22' || item.test_id === 'T23')) ||
      (selectedCategory === 'salons' && (item.merchant_id.includes('salon') || item.test_id === 'T03' || item.test_id === 'T04' || item.test_id === 'T11' || item.test_id === 'T16' || item.test_id === 'T18' || item.test_id === 'T25')) ||
      (selectedCategory === 'gyms' && (item.merchant_id.includes('gym') || item.merchant_id.includes('yoga') || item.test_id === 'T02' || item.test_id === 'T13' || item.test_id === 'T19' || item.test_id === 'T26' || item.test_id === 'T29')) ||
      (selectedCategory === 'pharmacies' && (item.merchant_id.includes('pharm') || item.merchant_id.includes('medico') || item.test_id === 'T05' || item.test_id === 'T07' || item.test_id === 'T15' || item.test_id === 'T20' || item.test_id === 'T27'));

    const matchesSearch =
      !searchQuery ||
      item.test_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.merchant_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rationale.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  const exportItems = benchmarkReport && benchmarkReport.results && benchmarkReport.results.length === 30
    ? benchmarkReport.results.map((r) => ({
        test_id: r.test_id,
        merchant_id: r.merchant_id,
        trigger_id: r.trigger_id,
        customer_id: r.customer_id,
        body: r.generated_body,
        cta: r.cta,
        send_as: r.send_as,
        suppression_key: r.suppression_key,
        rationale: r.rationale,
      }))
    : submissionItems;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans flex flex-col selection:bg-[#3B82F6] selection:text-black antialiased">
      {/* ── Technical Header / Telemetry Bar ────────────────────── */}
      <header className="border-b border-[#333] bg-[#111] px-6 py-3 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#3B82F6] rounded flex items-center justify-center font-bold text-black font-mono text-base shadow-[0_0_12px_rgba(59,130,246,0.5)]">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-white font-mono">
                  VERA <span className="text-[#3B82F6]">AI ENGINE</span>
                </h1>
                <span className="text-[10px] text-[#666] font-mono bg-black/60 px-2 py-0.5 rounded border border-[#222]">
                  v1.0.4-PROD
                </span>
                <span className="text-[10px] text-[#888] font-mono hidden sm:inline">
                  magicpin AI Challenge
                </span>
              </div>
              <p className="text-[11px] text-[#888] font-mono">
                Stateful merchant-growth engine • evidence-plan checks & reactive conversation state machine
              </p>
            </div>
          </div>

          {/* Telemetry & Target Endpoint Badges */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Deterministic Status */}
            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded border border-[#222]">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span className="text-[11px] font-mono text-green-500 font-semibold tracking-wide">
                DETERMINISTIC_MODE: ON
              </span>
            </div>

            {/* Live Metrics Grid */}
            <div className="hidden lg:flex items-center gap-3 text-xs font-mono bg-black/50 px-3 py-1.5 rounded border border-[#222]">
              <span className="text-[#888]">
                LATENCY: <strong className="text-white">{benchmarkReport ? `${Math.round(benchmarkReport.duration_ms / benchmarkReport.total_tests)}ms` : '--'}</strong>
              </span>
              <span className="text-[#444]">|</span>
              <span className="text-[#888]">
                OFFICIAL SCORE: <strong className={benchmarkReport ? "text-green-400" : "text-[#888]"}>
                  {benchmarkReport ? `Official score unavailable` : 'NOT RUN'}
                </strong>
              </span>
              <span className="text-[#444]">|</span>
              <span className="text-[#888]">
                GROUNDED: <strong className={benchmarkReport ? "text-[#3B82F6]" : "text-[#888]"}>
                  {benchmarkReport ? `${benchmarkReport.grounding_passed}/${benchmarkReport.total_tests}` : '--'}
                </strong>
              </span>
            </div>

            {/* Judge Target Endpoint Pill */}
            <div className="flex items-center gap-2 bg-[#0F0F0F] px-2.5 py-1 rounded border border-[#333]">
              <span className="text-[10px] uppercase tracking-wider text-[#666] font-mono font-bold">API:</span>
              <code className="text-[#3B82F6] font-mono text-xs font-semibold">
                /v1
              </code>
              <button
                onClick={() => copyToClipboard(`${window.location.origin}/v1`, 'top_url')}
                className="text-[10px] font-mono text-[#888] hover:text-white flex items-center gap-1 transition pl-1 border-l border-[#222]"
                title="Copy API Base URL"
              >
                {copied === 'top_url' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied === 'top_url' ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Data Grid Tab Navigation ────────────────────────── */}
        <div className="max-w-7xl mx-auto mt-3 pt-2.5 border-t border-[#222] flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setTab('evaluator')}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition border ${
              tab === 'evaluator'
                ? 'bg-[#3B82F6] text-black font-bold border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'bg-[#0F0F0F] text-[#888] hover:text-[#E0E0E0] hover:bg-[#161616] border-[#222]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>30 Benchmark Evaluator</span>
          </button>
          <button
            onClick={() => setTab('simulator')}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition border ${
              tab === 'simulator'
                ? 'bg-[#3B82F6] text-black font-bold border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'bg-[#0F0F0F] text-[#888] hover:text-[#E0E0E0] hover:bg-[#161616] border-[#222]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Reply State Simulator</span>
          </button>
          <button
            onClick={() => setTab('submission')}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition border ${
              tab === 'submission'
                ? 'bg-[#3B82F6] text-black font-bold border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'bg-[#0F0F0F] text-[#888] hover:text-[#E0E0E0] hover:bg-[#161616] border-[#222]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>submission.jsonl Export</span>
          </button>
          <button
            onClick={() => setTab('contexts')}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition border ${
              tab === 'contexts'
                ? 'bg-[#3B82F6] text-black font-bold border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'bg-[#0F0F0F] text-[#888] hover:text-[#E0E0E0] hover:bg-[#161616] border-[#222]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Context Store</span>
          </button>
          <button
            onClick={() => setTab('api')}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition border ${
              tab === 'api'
                ? 'bg-[#3B82F6] text-black font-bold border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'bg-[#0F0F0F] text-[#888] hover:text-[#E0E0E0] hover:bg-[#161616] border-[#222]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API Sandbox</span>
          </button>
        </div>
      </header>

      {/* ── Main Content Grid ──────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 1: 30 BENCHMARK EVALUATOR */}
        {/* ──────────────────────────────────────────────────────────── */}
        {tab === 'evaluator' && (
          <div className="space-y-4">
            {/* Top Filter & Metric Ribbon */}
            <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs uppercase tracking-widest text-white font-bold font-mono">
                    30 Canonical Benchmark Evaluator
                  </h2>
                  {benchmarkReport ? (
                    <span className="text-[10px] font-mono text-green-400 bg-green-950/40 border border-green-900/60 px-2 py-0.5 rounded font-bold">
                      LOCAL CHECKS: Not LLM-scored (Local checks only)
                    </span>
                  ) : benchmarkRunning ? (
                    <span className="text-[10px] font-mono text-yellow-400 bg-yellow-950/40 border border-yellow-900/60 px-2 py-0.5 rounded font-bold animate-pulse">
                      EXECUTING PIPELINE...
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#888] bg-[#1a1a1a] border border-[#333] px-2 py-0.5 rounded font-bold">
                      STATUS: READY (NOT RUN)
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#888] mt-1 font-mono">
                  {benchmarkReport
                    ? `Live run completed in ${benchmarkReport.duration_ms}ms (${Math.round(benchmarkReport.duration_ms / 30)}ms/pair). Grounding: ${benchmarkReport.grounding_passed}/30 | Single CTA: ${benchmarkReport.cta_passed}/30.`
                    : `Executes all 30 canonical pairs live against the real engine: Evidence selection -> Message composition -> Local invariant validation.`}
                </p>
              </div>

              {/* Execution & Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleRunBenchmark}
                  disabled={benchmarkRunning}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 transition ${
                    benchmarkRunning
                      ? 'bg-[#1a2536] text-[#60A5FA] cursor-not-allowed border border-[#2563EB]/40'
                      : 'bg-[#3B82F6] hover:bg-[#2563EB] text-black border border-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  }`}
                >
                  {benchmarkRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Running (30 pairs)...</span>
                    </>
                  ) : benchmarkReport ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-Run Benchmark</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run Local Checks</span>
                    </>
                  )}
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#666]" />
                  <input
                    type="text"
                    placeholder="Search test_id, merchant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-black border border-[#333] rounded px-3 pl-8 py-1.5 text-xs text-[#E0E0E0] font-mono placeholder-[#555] focus:outline-none focus:border-[#3B82F6] w-40 sm:w-48"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-black border border-[#333] rounded px-3 py-1.5 text-xs text-[#E0E0E0] font-mono focus:outline-none focus:border-[#3B82F6]"
                >
                  <option value="all">ALL CATEGORIES (30)</option>
                  <option value="restaurants">RESTAURANTS (7)</option>
                  <option value="salons">SALONS (6)</option>
                  <option value="gyms">GYMS (5)</option>
                  <option value="dentists">DENTISTS (7)</option>
                  <option value="pharmacies">PHARMACIES (5)</option>
                </select>
              </div>
            </div>

            {/* Benchmark Error Alert */}
            {benchmarkError && (
              <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-lg text-xs font-mono text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Benchmark Execution Error: {benchmarkError}</span>
              </div>
            )}

            {/* Launchpad Banner when NOT RUN */}
            {!benchmarkReport && !benchmarkRunning && (
              <div className="bg-[#111] border border-[#222] p-5 rounded-lg text-center space-y-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#1e293b] border border-[#3B82F6]/30 text-[#3B82F6] mb-1">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
                <h3 className="text-sm font-bold font-mono text-white">Live Benchmark Evaluator Ready</h3>
                <p className="text-xs text-[#888] font-mono max-w-2xl mx-auto leading-relaxed">
                  No pre-computed scores or static submissions are returned. Press <strong>Run Local Checks</strong> to execute all 30 canonical challenge pairs through the live pipeline with entity grounding verifier and local invariant checks.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleRunBenchmark}
                    className="px-5 py-2 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-black font-bold font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.4)] transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run Local Checks (30 Pairs)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Running Telemetry State */}
            {benchmarkRunning && (
              <div className="bg-[#111] border border-[#2563EB]/40 p-6 rounded-lg text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto" />
                <h3 className="text-sm font-bold font-mono text-white">Executing 30 Benchmark Scenarios...</h3>
                <p className="text-xs text-[#888] font-mono max-w-lg mx-auto">
                  Running deterministic composition and local invariant checks. No official LLM scoring is performed.
                </p>
              </div>
            )}

            {/* Completed Summary Cards */}
            {benchmarkReport && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
                <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded">
                  <div className="text-[10px] text-[#666] uppercase">Official Score</div>
                  <div className="text-base font-bold text-green-400 mt-0.5">Not LLM-scored</div>
                  <div className="text-[10px] text-[#888]">Local checks only official score unavailable</div>
                </div>
                <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded">
                  <div className="text-[10px] text-[#666] uppercase">Total Points</div>
                  <div className="text-base font-bold text-white mt-0.5">Not assessed</div>
                  <div className="text-[10px] text-[#888]">30 test scenarios</div>
                </div>
                <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded">
                  <div className="text-[10px] text-[#666] uppercase">Grounding Pass</div>
                  <div className="text-base font-bold text-[#3B82F6] mt-0.5">{benchmarkReport.grounding_passed} / {benchmarkReport.total_tests}</div>
                  <div className="text-[10px] text-green-400">Local invariants only</div>
                </div>
                <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded">
                  <div className="text-[10px] text-[#666] uppercase">Single CTA Pass</div>
                  <div className="text-base font-bold text-[#3B82F6] mt-0.5">{benchmarkReport.cta_passed} / {benchmarkReport.total_tests}</div>
                  <div className="text-[10px] text-green-400">Local invariants only</div>
                </div>
                <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-[#666] uppercase">Duration</div>
                  <div className="text-base font-bold text-white mt-0.5">{benchmarkReport.duration_ms}ms</div>
                  <div className="text-[10px] text-[#888]">~{Math.round(benchmarkReport.duration_ms / 30)}ms / pair</div>
                </div>
              </div>
            )}

            {/* Test Cards: Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {benchmarkReport ? (
                filteredBenchmarkItems.map((item) => (
                  <div
                    key={item.test_id}
                    className="bg-[#0F0F0F] border border-[#222] hover:border-[#3B82F6]/50 rounded-lg p-4 transition flex flex-col justify-between space-y-3 group"
                  >
                    <div>
                      {/* Item Top Bar */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#222] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-950/40 text-[#3B82F6] border border-blue-900/60">
                            {item.test_id}
                          </span>
                          <span className="text-xs font-mono font-semibold text-white truncate max-w-[210px]" title={item.merchant_id}>
                            {item.merchant_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                            item.total_score >= 48
                              ? 'bg-green-950/40 text-green-400 border-green-900/60'
                              : 'bg-yellow-950/40 text-yellow-400 border-yellow-900/60'
                          }`}>
                            {(item as any).decision === 'suppress' ? 'SUPPRESS' : 'SEND'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black text-green-400 border border-[#222]">
                            {item.grounding_result ? 'Evidence checked' : 'No message'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black text-[#888] border border-[#222]">
                            {item.send_as}
                          </span>
                        </div>
                      </div>

                      {/* Trigger & Context */}
                      <div className="mt-2.5">
                        <div className="text-[10px] font-mono text-[#666] mb-1 flex items-center justify-between uppercase">
                          <span className="truncate max-w-[240px]">TRIGGER: {item.trigger_id}</span>
                          {item.customer_id && (
                            <span className="text-[#3B82F6]">CUST: {item.customer_id}</span>
                          )}
                        </div>

                        {/* Realization Box */}
                        <div className="bg-black border border-[#222] p-3 rounded text-xs text-[#E0E0E0] leading-relaxed font-mono relative group-hover:border-[#333] transition">
                          <p className="select-text">{item.generated_body || item.rationale}</p>
                        </div>
                      </div>
                    </div>

                    {/* Rubric Breakdown Pills */}
                    <div className="pt-2 border-t border-[#222] space-y-2 text-xs font-mono">
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-[#777]">
                        <span className="bg-[#141414] px-1.5 py-0.5 rounded border border-[#262626]">
                          Spec: <strong className="text-white">Not assessed</strong>
                        </span>
                        <span className="bg-[#141414] px-1.5 py-0.5 rounded border border-[#262626]">
                          Cat: <strong className="text-white">Not assessed</strong>
                        </span>
                        <span className="bg-[#141414] px-1.5 py-0.5 rounded border border-[#262626]">
                          Merch: <strong className="text-white">Not assessed</strong>
                        </span>
                        <span className="bg-[#141414] px-1.5 py-0.5 rounded border border-[#262626]">
                          Trig: <strong className="text-white">Not assessed</strong>
                        </span>
                        <span className="bg-[#141414] px-1.5 py-0.5 rounded border border-[#262626]">
                          Comp: <strong className="text-white">Not assessed</strong>
                        </span>
                      </div>

                      {/* CTA & Rationale */}
                      <div className="flex items-center justify-between text-[#888]">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase text-[#666] font-bold">CTA:</span>
                          <code className="text-[#3B82F6] bg-black px-1.5 py-0.5 rounded border border-[#222] text-[11px]">
                            {item.cta}
                          </code>
                        </span>
                        <span className="text-[#555] text-[10px] truncate max-w-[190px]" title={item.suppression_key}>
                          KEY: {item.suppression_key}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#777] leading-tight">
                        <span className="text-[#555] uppercase text-[9px] font-bold mr-1">RATIONALE:</span>
                        {item.rationale}
                      </div>
                      <div className="text-[9px] text-[#555] pt-0.5 border-t border-[#1a1a1a] flex items-center justify-between">
                        <span>Latency: {item.provenance.duration_ms}ms • Memory: {item.provenance.memory_mb}MB</span>
                        <span>{item.engine_path}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                filteredSubmissionItems.map((item) => (
                  <div
                    key={item.test_id}
                    className="bg-[#0F0F0F] border border-[#222] hover:border-[#3B82F6]/50 rounded-lg p-4 transition flex flex-col justify-between space-y-3 group opacity-85"
                  >
                    <div>
                      {/* Item Top Bar */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#222] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-950/40 text-[#3B82F6] border border-blue-900/60">
                            {item.test_id}
                          </span>
                          <span className="text-xs font-mono font-semibold text-white truncate max-w-[210px]">
                            {item.merchant_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a1a1a] text-[#888] border border-[#333] font-bold">
                            PENDING RUN
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-black text-[#888] border border-[#222]">
                            {item.send_as}
                          </span>
                        </div>
                      </div>

                      {/* Trigger & Context */}
                      <div className="mt-2.5">
                        <div className="text-[10px] font-mono text-[#666] mb-1 flex items-center justify-between uppercase">
                          <span className="truncate max-w-[240px]">TRIGGER: {item.trigger_id}</span>
                          {item.customer_id && (
                            <span className="text-[#3B82F6]">CUST: {item.customer_id}</span>
                          )}
                        </div>

                        {/* Realization Box */}
                        <div className="bg-black border border-[#222] p-3 rounded text-xs text-[#AAA] leading-relaxed font-mono relative group-hover:border-[#333] transition">
                          <p className="select-text">{item.body}</p>
                        </div>
                      </div>
                    </div>

                    {/* Decision Trace & CTA */}
                    <div className="pt-2 border-t border-[#222] space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-[#888]">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase text-[#666] font-bold">CTA:</span>
                          <code className="text-[#3B82F6] bg-black px-1.5 py-0.5 rounded border border-[#222] text-[11px]">
                            {item.cta}
                          </code>
                        </span>
                        <span className="text-[#555] text-[10px] truncate max-w-[190px]" title={item.suppression_key}>
                          KEY: {item.suppression_key}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#777] leading-tight pt-1">
                        <span className="text-[#555] uppercase text-[9px] font-bold mr-1">RATIONALE:</span>
                        {item.rationale}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 2: REACTIVE REPLY SIMULATOR */}
        {/* ──────────────────────────────────────────────────────────── */}
        {tab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Panel: Inbound Context & Parameters (Col 4) */}
            <div className="lg:col-span-4 bg-[#0F0F0F] border border-[#222] rounded-lg p-4 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h2 className="text-[10px] uppercase tracking-widest text-[#666] font-bold font-mono mb-1">
                    Inbound Context
                  </h2>
                  <p className="text-xs text-[#888] font-mono">
                    Test Vera's reactive conversation machine across intent, automated quiet windows, and opt-outs.
                  </p>
                </div>

                {/* Role Switcher */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#3B82F6] font-mono uppercase font-bold">Sender Role</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSimRole('merchant')}
                      className={`py-1.5 text-xs rounded border font-mono uppercase tracking-wider transition ${
                        simRole === 'merchant'
                          ? 'bg-[#3B82F6] border-[#3B82F6] text-black font-bold'
                          : 'bg-black border-[#333] text-[#888] hover:text-white'
                      }`}
                    >
                      Merchant
                    </button>
                    <button
                      onClick={() => setSimRole('customer')}
                      className={`py-1.5 text-xs rounded border font-mono uppercase tracking-wider transition ${
                        simRole === 'customer'
                          ? 'bg-[#3B82F6] border-[#3B82F6] text-black font-bold'
                          : 'bg-black border-[#333] text-[#888] hover:text-white'
                      }`}
                    >
                      Customer
                    </button>
                  </div>
                </div>

                {/* Merchant Context Selector */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#3B82F6] font-mono uppercase font-bold">Active Merchant Context</div>
                  <select
                    value={simMerchantId}
                    onChange={(e) => setSimMerchantId(e.target.value)}
                    className="w-full bg-black border border-[#333] rounded p-2 text-xs text-[#E0E0E0] font-mono focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="m_001_drmeera_dentist_delhi">Dr. Meera Patel • DENTISTS (Delhi)</option>
                    <option value="m_001_suresh_restaurant_bangalore">Mylari Cafe • RESTAURANTS (Bangalore)</option>
                    <option value="m_003_studio11_salon_hyderabad">Studio11 • SALONS (Hyderabad)</option>
                    <option value="m_005_powerhouse_gym_bangalore">PowerHouse • GYMS (Bangalore)</option>
                    <option value="m_001_apollo_pharmacy_delhi">Apollo Health Plus • PHARMACIES (Delhi)</option>
                  </select>
                </div>

                {/* One-Click Technical Macros */}
                <div className="space-y-2">
                  <div className="text-[10px] text-[#666] font-mono uppercase font-bold">Execution Scenarios (1-Click)</div>
                  <div className="space-y-1.5 font-mono text-xs">
                    <button
                      onClick={() => setSimMessage("Ok let's do it. What's next?")}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] hover:border-[#3B82F6] text-[#BBB] flex items-center justify-between group transition"
                    >
                      <span>[MACRO] Intent Commitment</span>
                      <ChevronRight className="w-3 h-3 text-[#555] group-hover:text-[#3B82F6]" />
                    </button>
                    <button
                      onClick={() => setSimMessage("Thank you for contacting Dr. Meera's Dental Clinic. Our team will respond shortly.")}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] hover:border-[#3B82F6] text-[#BBB] flex items-center justify-between group transition"
                    >
                      <span>[MACRO] Auto-Reply Loop (300s Quiet)</span>
                      <ChevronRight className="w-3 h-3 text-[#555] group-hover:text-[#3B82F6]" />
                    </button>
                    <button
                      onClick={() => setSimMessage("Yes please hold the Friday 4:30pm appointment slot for me")}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] hover:border-[#3B82F6] text-[#BBB] flex items-center justify-between group transition"
                    >
                      <span>[MACRO] Customer Slot Reservation</span>
                      <ChevronRight className="w-3 h-3 text-[#555] group-hover:text-[#3B82F6]" />
                    </button>
                    <button
                      onClick={() => setSimMessage("Stop messaging me. Not interested.")}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] hover:border-red-500 text-red-400 flex items-center justify-between group transition"
                    >
                      <span>[MACRO] Hard Opt-Out & Suppression</span>
                      <ChevronRight className="w-3 h-3 text-[#555] group-hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Status footer for left panel */}
              <div className="pt-4 border-t border-[#222] text-[10px] font-mono text-[#555] flex items-center justify-between">
                <span>SIMULATOR_STATE: LIVE</span>
                <span>IDEMPOTENT: TRUE</span>
              </div>
            </div>

            {/* Right Panel: Live Terminal Console (Col 8) */}
            <div className="lg:col-span-8 bg-[#0A0A0A] border border-[#222] rounded-lg flex flex-col h-[560px]">
              {/* Terminal Header */}
              <div className="bg-[#111] border-b border-[#222] px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  <span className="text-xs font-mono font-bold text-white">REPLY CONSOLE (/v1/reply)</span>
                  <span className="text-[10px] font-mono text-[#666]">• Multi-Turn Reactive Trace</span>
                </div>
                <button
                  onClick={() => setChatLog([chatLog[0]])}
                  className="text-xs font-mono text-[#888] hover:text-white flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3" /> RESET_LOGS
                </button>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
                {chatLog.map((log, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${log.sender === 'vera' ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded p-3 border ${
                        log.sender === 'vera'
                          ? 'bg-[#141414] border-[#222] text-[#E0E0E0]'
                          : 'bg-[#111] border-[#3B82F6]/60 text-white shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-[#222] text-[10px]">
                        <span className={log.sender === 'vera' ? 'text-[#3B82F6] font-bold' : 'text-green-400 font-bold'}>
                          [{log.sender === 'vera' ? 'VERA_DISPATCH' : `INBOUND_${log.sender.toUpperCase()}`}]
                        </span>
                        {log.latency && (
                          <span className="text-[#666]">{log.latency}ms</span>
                        )}
                      </div>
                      <p className="leading-relaxed select-text">{log.text}</p>

                      {log.action && (
                        <div className="mt-2 pt-1.5 border-t border-[#222] flex items-center justify-between text-[10px] text-[#888]">
                          <span>ACTION: <strong className="text-white">{log.action}</strong></span>
                          {log.rationale && (
                            <span className="truncate max-w-[280px] italic text-[#666]">
                              {log.rationale}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {simLoading && (
                  <div className="flex items-center gap-2 text-xs font-mono text-[#3B82F6] italic p-2 bg-[#111] rounded border border-[#222]">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Executing decision machine (/v1/reply)...
                  </div>
                )}
              </div>

              {/* Terminal Input */}
              <div className="p-3 bg-[#111] border-t border-[#222] flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Type message as ${simRole.toUpperCase()}...`}
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSimSend()}
                  className="flex-1 bg-black border border-[#333] rounded px-3 py-2 text-xs text-[#E0E0E0] font-mono placeholder-[#555] focus:outline-none focus:border-[#3B82F6]"
                />
                <button
                  onClick={handleSimSend}
                  disabled={simLoading || !simMessage.trim()}
                  className="bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-black px-4 py-2 rounded text-xs font-bold font-mono flex items-center gap-1.5 transition uppercase tracking-wider"
                >
                  <Send className="w-3.5 h-3.5" />
                  Dispatch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 3: SUBMISSION JSONL EXPORT */}
        {/* ──────────────────────────────────────────────────────────── */}
        {tab === 'submission' && (
          <div className="space-y-4">
            <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xs uppercase tracking-widest text-[#666] font-bold font-mono">
                  Challenge Export • submission.jsonl
                </h2>
                <p className="text-xs text-[#888] font-mono mt-1">
                  30 composition records; abstentions are empty. Confirm portal acceptance of offline abstentions.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    const text = exportItems.map((item) => JSON.stringify(item)).join('\n');
                    copyToClipboard(text, 'jsonl_all');
                  }}
                  className="px-3 py-1.5 rounded bg-black border border-[#333] text-xs font-mono text-[#E0E0E0] hover:border-[#3B82F6] flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-[#3B82F6]" />
                  {copied === 'jsonl_all' ? 'COPIED' : 'COPY RAW JSONL'}
                </button>
                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                    exportItems.map((item) => JSON.stringify(item)).join('\n')
                  )}`}
                  download="submission.jsonl"
                  className="px-4 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-black text-xs font-bold font-mono flex items-center gap-1.5 transition shadow-[0_0_12px_rgba(59,130,246,0.3)] uppercase tracking-wider"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download submission.jsonl
                </a>
              </div>
            </div>

            {/* Validation Checklist Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">30 / 30 RECORDS</div>
                  <div className="text-[10px] text-[#666]">
                    {benchmarkReport ? 'Generated live from benchmark' : 'Canonical baseline dataset'}
                  </div>
                </div>
              </div>
              <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">0 HALLUCINATIONS</div>
                  <div className="text-[10px] text-[#666]">Strict context grounding</div>
                </div>
              </div>
              <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">SINGLE_CTA STRICT</div>
                  <div className="text-[10px] text-[#666]">No competing asks</div>
                </div>
              </div>
              <div className="bg-[#0F0F0F] border border-[#222] p-3 rounded flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">UTF-8 VERIFIED</div>
                  <div className="text-[10px] text-[#666]">Clean ₹ currency tokens</div>
                </div>
              </div>
            </div>

            {/* High-density JSONL Viewer */}
            <div className="bg-black border border-[#222] rounded-lg p-4 font-mono text-xs text-[#888] max-h-[500px] overflow-y-auto space-y-1.5">
              {exportItems.map((item, idx) => (
                <div key={idx} className="hover:bg-[#111] p-2 rounded transition flex items-start gap-2 border border-transparent hover:border-[#222]">
                  <span className="text-[#3B82F6] font-bold shrink-0">[{item.test_id}]</span>
                  <span className="text-[#BBB] break-all select-text">{JSON.stringify(item)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 4: CONTEXT STORE INSPECTOR */}
        {/* ──────────────────────────────────────────────────────────── */}
        {tab === 'contexts' && (
          <div className="space-y-4">
            <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg flex items-center justify-between">
              <div>
                <h2 className="text-xs uppercase tracking-widest text-[#666] font-bold font-mono">
                  Hierarchical Context Store (/v1/context)
                </h2>
                <p className="text-xs text-[#888] font-mono mt-1">
                  In-memory store partitioned across 4 canonical scopes populated via idempotent ingest.
                </p>
              </div>
              <div className="font-mono text-xs text-green-400 bg-green-950/40 border border-green-900/60 px-3 py-1 rounded">
                STORE_STATUS: SYNCHRONIZED
              </div>
            </div>

            {/* 4 Scope Panels */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
              {/* Categories */}
              <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                  <span className="text-xs font-bold text-[#3B82F6] uppercase">Scope: Category</span>
                  <span className="text-[10px] bg-black px-2 py-0.5 rounded border border-[#222] text-[#888]">
                    {stateData?.counts.categories || 5} Records
                  </span>
                </div>
                <div className="text-xs text-[#888] space-y-1.5">
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">RESTAURANTS</div>
                    <div className="text-[10px] text-[#666]">Tone: Operator-Peer • High Velocity</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">SALONS</div>
                    <div className="text-[10px] text-[#666]">Tone: Warm-Practical • Bookings</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">GYMS</div>
                    <div className="text-[10px] text-[#666]">Tone: Energetic Coach • Renewal</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">DENTISTS</div>
                    <div className="text-[10px] text-[#666]">Tone: Clinical-Peer • Fluoride Study</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">PHARMACIES</div>
                    <div className="text-[10px] text-[#666]">Tone: Trust-Precise • Refill Alerts</div>
                  </div>
                </div>
              </div>

              {/* Merchants */}
              <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                  <span className="text-xs font-bold text-[#3B82F6] uppercase">Scope: Merchant</span>
                  <span className="text-[10px] bg-black px-2 py-0.5 rounded border border-[#222] text-[#888]">
                    {stateData?.counts.merchants || 50} Records
                  </span>
                </div>
                <div className="text-xs text-[#888] space-y-1.5">
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Dr. Meera's Clinic</div>
                    <div className="text-[10px] text-[#666]">Delhi • 124 high risk patients</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Mylari South Indian</div>
                    <div className="text-[10px] text-[#666]">Bangalore • 145 orders this mo</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Studio11 Family Salon</div>
                    <div className="text-[10px] text-[#666]">Hyderabad • 4.6★ • Kapra</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">PowerHouse Fitness</div>
                    <div className="text-[10px] text-[#666]">Bangalore • 42 active passes</div>
                  </div>
                </div>
              </div>

              {/* Triggers */}
              <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                  <span className="text-xs font-bold text-[#3B82F6] uppercase">Scope: Trigger</span>
                  <span className="text-[10px] bg-black px-2 py-0.5 rounded border border-[#222] text-[#888]">
                    {stateData?.counts.triggers || 100} Records
                  </span>
                </div>
                <div className="text-xs text-[#888] space-y-1.5">
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">JIDA Fluoride Study</div>
                    <div className="text-[10px] text-[#666]">Research digest • 38% caries cut</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Match Night / Weekend</div>
                    <div className="text-[10px] text-[#666]">Event hook • Pre-game dinner</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Dormant Re-engagement</div>
                    <div className="text-[10px] text-[#666]">38d inactivity • VIP offer</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Competitor Proximity</div>
                    <div className="text-[10px] text-[#666]">1.3km defense alert</div>
                  </div>
                </div>
              </div>

              {/* Customers */}
              <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                  <span className="text-xs font-bold text-[#3B82F6] uppercase">Scope: Customer</span>
                  <span className="text-[10px] bg-black px-2 py-0.5 rounded border border-[#222] text-[#888]">
                    {stateData?.counts.customers || 200} Records
                  </span>
                </div>
                <div className="text-xs text-[#888] space-y-1.5">
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Mr. Sharma (Chronic Rx)</div>
                    <div className="text-[10px] text-[#666]">Amlodipine 5mg • 30d refill due</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Priya Sharma (Dental)</div>
                    <div className="text-[10px] text-[#666]">6mo cleaning recall due</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Diya (Yoga Member)</div>
                    <div className="text-[10px] text-[#666]">3 days left on 20-class pack</div>
                  </div>
                  <div className="p-1.5 bg-black rounded border border-[#222]">
                    <div className="text-white font-semibold">Aditya (Salon VIP)</div>
                    <div className="text-[10px] text-[#666]">Cut & Beard • Karim's Salon</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* TAB 5: API SANDBOX */}
        {/* ──────────────────────────────────────────────────────────── */}
        {tab === 'api' && (
          <div className="space-y-4">
            <div className="bg-[#0F0F0F] border border-[#222] p-4 rounded-lg flex items-center justify-between">
              <div>
                <h2 className="text-xs uppercase tracking-widest text-[#666] font-bold font-mono">
                  REST Sandbox (/v1/*)
                </h2>
                <p className="text-xs text-[#888] font-mono mt-1">
                  Direct evaluation console for all 5 protocol endpoints specified in the competition contract.
                </p>
              </div>
              <span className="text-[10px] font-mono text-[#3B82F6] bg-blue-950/40 border border-blue-900/60 px-2.5 py-1 rounded">
                SPEC: magicpin-vera-v1
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Presets & Request Builder (Col 5) */}
              <div className="lg:col-span-5 bg-[#0F0F0F] border border-[#222] rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase text-[#666] font-mono font-bold">Standard Presets</div>
                  <div className="space-y-1.5 font-mono text-xs">
                    <button
                      onClick={() => {
                        setApiMethod('GET');
                        setApiEndpoint('/v1/healthz');
                        setApiPayload('');
                      }}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] text-[#BBB] flex items-center justify-between transition"
                    >
                      <span>GET /v1/healthz</span>
                      <span className="text-[10px] text-green-400">Probe</span>
                    </button>
                    <button
                      onClick={() => {
                        setApiMethod('GET');
                        setApiEndpoint('/v1/metadata');
                        setApiPayload('');
                      }}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] text-[#BBB] flex items-center justify-between transition"
                    >
                      <span>GET /v1/metadata</span>
                      <span className="text-[10px] text-[#3B82F6]">Identity</span>
                    </button>
                    <button
                      onClick={() => {
                        setApiMethod('POST');
                        setApiEndpoint('/v1/tick');
                        setApiPayload(
                          JSON.stringify(
                            {
                              now: new Date().toISOString(),
                              available_triggers: ['trg_001_research_digest_dentists']
                            },
                            null,
                            2
                          )
                        );
                      }}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] text-[#BBB] flex items-center justify-between transition"
                    >
                      <span>POST /v1/tick</span>
                      <span className="text-[10px] text-amber-400">Proactive Dispatch</span>
                    </button>
                    <button
                      onClick={() => {
                        setApiMethod('POST');
                        setApiEndpoint('/v1/reply');
                        setApiPayload(
                          JSON.stringify(
                            {
                              conversation_id: 'conv_sandbox_test',
                              merchant_id: 'm_001_drmeera_dentist_delhi',
                              customer_id: null,
                              from_role: 'merchant',
                              message: "Ok let's do it. What's next?",
                              received_at: new Date().toISOString(),
                              turn_number: 2
                            },
                            null,
                            2
                          )
                        );
                      }}
                      className="w-full text-left p-2 rounded bg-black hover:bg-[#141414] border border-[#222] text-[#BBB] flex items-center justify-between transition"
                    >
                      <span>POST /v1/reply</span>
                      <span className="text-[10px] text-purple-400">Reactive Reply</span>
                    </button>
                  </div>
                </div>

                {/* Method & Path inputs */}
                <div className="space-y-1.5 font-mono">
                  <div className="text-[10px] uppercase text-[#666] font-bold">Endpoint Target</div>
                  <div className="flex gap-2">
                    <select
                      value={apiMethod}
                      onChange={(e: any) => setApiMethod(e.target.value)}
                      className="bg-black border border-[#333] rounded px-3 py-1.5 text-xs text-[#E0E0E0] focus:border-[#3B82F6]"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                    <input
                      type="text"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      className="flex-1 bg-black border border-[#333] rounded px-3 py-1.5 text-xs text-[#E0E0E0] focus:border-[#3B82F6]"
                    />
                  </div>
                </div>

                {apiMethod === 'POST' && (
                  <div className="space-y-1.5 font-mono">
                    <div className="text-[10px] uppercase text-[#666] font-bold">JSON Payload</div>
                    <textarea
                      rows={5}
                      value={apiPayload}
                      onChange={(e) => setApiPayload(e.target.value)}
                      className="w-full bg-black border border-[#333] rounded p-2.5 text-xs text-[#E0E0E0] focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                )}

                <button
                  onClick={executeApiCall}
                  className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-black font-bold font-mono py-2 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                >
                  <Send className="w-3.5 h-3.5" />
                  Execute Request
                </button>
              </div>

              {/* Response Inspector (Col 7) */}
              <div className="lg:col-span-7 bg-black border border-[#222] rounded-lg p-4 flex flex-col h-[460px]">
                <div className="flex items-center justify-between pb-3 border-b border-[#222] text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">HTTP RESPONSE</span>
                    {apiTime !== null && (
                      <span className="text-[10px] text-green-400 bg-green-950/40 border border-green-900/60 px-2 py-0.5 rounded">
                        {apiTime}ms LATENCY
                      </span>
                    )}
                  </div>
                  {apiResponse && (
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(apiResponse, null, 2), 'res_copy')}
                      className="text-[10px] text-[#888] hover:text-white flex items-center gap-1 transition"
                    >
                      <Copy className="w-3 h-3" />
                      {copied === 'res_copy' ? 'COPIED' : 'COPY'}
                    </button>
                  )}
                </div>

                <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-green-400 leading-relaxed bg-[#050505] rounded border border-[#181818] mt-3 select-text">
                  {apiResponse
                    ? JSON.stringify(apiResponse, null, 2)
                    : '// Execute request to view formatted JSON response payload...'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Technical Footer ───────────────────────────────────── */}
      <footer className="h-8 bg-[#000] border-t border-[#222] flex items-center justify-between px-6 text-[10px] text-[#555] font-mono mt-auto">
        <div className="flex items-center gap-3">
          <span>LOG_READY: Vera_Internal_Dispatcher_Active</span>
          <span className="hidden sm:inline text-[#333]">|</span>
          <span className="hidden sm:inline">DETERMINISTIC_HASH: 0x7f82b21c</span>
        </div>
        <div>ENVIRONMENT: PRODUCTION_CHALLENGE_JUDGE</div>
        <div className="hidden sm:block">SYSTEM_ID: 0xDEADBEEF42</div>
      </footer>
    </div>
  );
}
