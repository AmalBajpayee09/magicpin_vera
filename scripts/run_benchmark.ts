import fs from 'node:fs';
import {runCanonicalBenchmark} from '../src/engine/benchmark';
const report=await runCanonicalBenchmark();
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/canonical-decisions.json',JSON.stringify(report,null,2)+'\n');
for(const r of report.results) console.log(`${r.test_id}: ${r.decision.toUpperCase()} ${r.generated_body || r.rationale}`);
console.log(`Evaluated ${report.total_tests}; send ${report.sent}, suppress ${report.suppressed}. Local invariants only; no official score.`);
