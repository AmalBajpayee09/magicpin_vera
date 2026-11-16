import fs from 'node:fs';
import {runCanonicalBenchmark} from '../src/engine/benchmark';
const r=await runCanonicalBenchmark();
const lines=r.results.map((p:any)=>JSON.stringify({test_id:p.test_id,body:p.generated_body,cta:p.cta,send_as:p.send_as,suppression_key:p.suppression_key,rationale:p.rationale}));
fs.writeFileSync('challenge_pack/submission.jsonl',lines.join('\n')+'\n');
console.log(`Exported ${lines.length} offline composition records (${r.sent} messages, ${r.suppressed} abstentions with empty body). HTTP is the primary submission contract; confirm portal treatment of offline abstentions.`);
