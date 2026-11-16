import fs from 'node:fs';
import {EngineStore} from './store';
import {composeWithTrace, NoActionError} from './composer';
import {validateOutput} from './decision';

let latest: any = null;
export const getLatestBenchmarkReport = () => latest;
/** Canonical composition checks are not the official LLM rubric. No estimated scores. */
export async function runCanonicalBenchmark(store = new EngineStore(true)) {
  const started=Date.now();
  const pairs=JSON.parse(fs.readFileSync('challenge_pack/expanded/test_pairs.json','utf8')).pairs;
  const results=pairs.map((p:any)=>{
    const m=store.getMerchant(p.merchant_id),t=store.getTrigger(p.trigger_id),c=p.customer_id?store.getCustomer(p.customer_id):null;
    if(!m||!t) throw new Error(`Missing fixture ${p.test_id}`);
    const base={...p,engine_path:'selectEvidencePlan -> composeWithTrace -> validateOutput',specificity:null,category_fit:null,merchant_fit:null,trigger_relevance:null,engagement_compulsion:null,total_score:null,
      provenance:{executed_at:new Date().toISOString(),node_version:process.version},status:'PASS'};
    try {
      const r=composeWithTrace(store.getCategory(m.category_slug),m,t,c,'2026-04-26T10:30:00Z');
      const valid=validateOutput(r.action,r.plan,m,c);
      if(!valid) throw new Error(`Invalid generated action ${p.test_id}`);
      return {...base,decision:'send',generated_body:r.action.body,send_as:r.action.send_as,cta:r.action.cta,suppression_key:r.action.suppression_key,rationale:r.action.rationale,trace:r.trace,grounding_result:true,cta_result:true};
    } catch(e) {
      if(!(e instanceof NoActionError)) throw e;
      return {...base,decision:'suppress',generated_body:'',send_as:c?'merchant_on_behalf':'vera',cta:'none',suppression_key:t.suppression_key || t.id,rationale:'Insufficient permitted actionable evidence at the explicit offline scenario time.',grounding_result:null,cta_result:null};
    }
  });
  latest={status:'COMPLETED',kind:'local invariant checks; NOT an official score',scenario_time:'2026-04-26T10:30:00Z',executed_at:new Date().toISOString(),duration_ms:Date.now()-started,total_tests:results.length,passed_tests:results.length,
    sent:results.filter((r:any)=>r.decision==='send').length,suppressed:results.filter((r:any)=>r.decision==='suppress').length,
    grounding_passed:results.filter((r:any)=>r.grounding_result).length,cta_passed:results.filter((r:any)=>r.cta_result).length,
    total_score:null,max_possible_score:null,average_score:null,rubric_percentage:null,results};
  return latest;
}
