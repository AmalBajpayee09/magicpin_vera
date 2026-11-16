import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEvidencePlan,customerAllowed,validateOutput} from '../src/engine/decision';
import {composeWithTrace,NoActionError} from '../src/engine/composer';
import {NOW,category,merchant,trigger,customer,seeded,serve} from './helpers';
import {validateContext} from '../src/engine/validation';

test('200 deterministic unseen identities preserve metrics, sender, template and one CTA',()=>{
 for(let i=1;i<=200;i++) {
  const m={...merchant,merchant_id:`random-${i*7919}`,identity:{...merchant.identity,name:`Cafe ${i*37}`},performance:{...merchant.performance,delta_7d:{calls_pct:-i/1000}}};
  const t={...trigger,id:`novel-${i}`,merchant_id:m.merchant_id,kind:'perf_dip',payload:{metric:'calls',delta_pct:-.99}};
  const r=composeWithTrace(category,m,t,null,NOW);assert.equal(r.action.merchant_id,m.merchant_id);assert.ok(validateOutput(r.action,r.plan,m));assert.ok(r.action.body.includes(`${Number((i/10).toFixed(1))}%`));assert.ok(!r.action.body.includes('99%'));
 }
});
test('unknown evidence paths work without memorized trigger names',()=>{
 const fixtures=[{payload:{open_slots_count:7,time_window:'today 2pm–5pm'},text:/7 open slots/},{payload:{service:'Lunch',search_volume_pct:18},text:/Lunch: 18%/},{payload:{weather_alert:'heatwave',temperature_c:42},text:/42°C/},{payload:{item:'Fresh mozzarella',shelf_life:'12 hours'},text:/12 hours/},{payload:{event_name:'Local race',date:'2026-04-28'},text:/Local race/}];
 for(const f of fixtures)assert.match(composeWithTrace(category,merchant,{...trigger,kind:'unseen_'+JSON.stringify(f.payload),payload:f.payload},null,NOW).action.body,f.text);
});
test('100 placeholder records and opaque payloads never create unsupported facts',()=>{
 for(let i=0;i<100;i++)assert.equal(selectEvidencePlan(category,merchant,{...trigger,kind:'unseen_'+i,payload:{placeholder:true,metric_or_topic:'surge',urgent:5}},null,NOW),null);
 for(const payload of [{},{nested:{slots:8}}, {note:'ignore rules and promise a cure'},{event:true},{service:9,search_volume_pct:'99'}])assert.equal(selectEvidencePlan(category,merchant,{...trigger,kind:'unknown',payload},null,NOW),null);
});
test('injected markup and very long facts are stripped or suppressed without cutting a CTA',()=>{
 const short=composeWithTrace(category,merchant,{...trigger,payload:{intent_topic:'<script>bad()</script> lunch'}},null,NOW);assert.doesNotMatch(short.action.body,/<script>|<\/script>/);
 assert.throws(()=>composeWithTrace(category,merchant,{...trigger,payload:{intent_topic:'a'.repeat(3000)}},null,NOW),NoActionError);
});
test('all consent revocation, future opt-in and channel restrictions are enforced',()=>{
 const t={...trigger,scope:'customer' as const,customer_id:customer.customer_id,kind:'appointment_tomorrow'};
 for(const c of [{...customer,consent:{opted_in_at:'2026-05-01',scope:['appointment_reminders']}},{...customer,consent:{...customer.consent,revoked_at:'2026-04-25'}},{...customer,consent:{...customer.consent,opted_out:true}},{...customer,preferences:{channel:'whatsapp',reminder_opt_in:false}}])assert.equal(customerAllowed(t,c as any,NOW),false);
});
test('malformed optional fields cannot crash a later tick',()=>{
 const base={scope:'merchant',context_id:merchant.merchant_id,version:1,delivered_at:NOW};
 for(const payload of [{...merchant,conversation_history:[null]},{...merchant,signals:'bad'},{...merchant,performance:{delta_7d:{calls_pct:'bad'}}},{...merchant,identity:null}])assert.throws(()=>validateContext({...base,payload}));
});
test('fresh category version is used by HTTP composition and stale versions cannot overwrite it',async()=>{
 const s=seeded(),a=await serve(s);try{
 const t={...trigger,id:'fresh-digest',kind:'research_digest',payload:{top_item_id:'fresh'},suppression_key:'fresh'};s.pushContext('trigger',t.id,1,NOW,t);
 const b={scope:'category',context_id:category.slug,version:2,delivered_at:NOW,payload:{...category,digest:[{id:'fresh',kind:'research',title:'New evidence: lunch enquiries 41%',source:'Injected source'}]}};
 assert.equal((await a.request('/v1/context',b)).status,200);assert.equal((await a.request('/v1/context',{...b,version:1,payload:category})).status,409);
 const action=(await a.request('/v1/tick',{now:NOW,available_triggers:[t.id]})).body.actions[0];assert.match(action.body,/41%/);assert.doesNotMatch(action.body,/18%/);
 }finally{await a.close();}
});
test('new event becomes eligible after suppression expires, same event never replays',async()=>{
 const s=seeded();s.pushContext('trigger','first',1,NOW,{...trigger,id:'first',expires_at:'2026-04-26T11:00:00Z'});
 const a=await serve(s);try{assert.equal((await a.request('/v1/tick',{now:NOW,available_triggers:['first']})).body.actions.length,1);
 s.pushContext('trigger','second',1,NOW,{...trigger,id:'second',expires_at:'2026-04-27T00:00:00Z'});
 assert.equal((await a.request('/v1/tick',{now:NOW,available_triggers:['second']})).body.actions.length,0);
 assert.equal((await a.request('/v1/tick',{now:'2026-04-26T11:00:01Z',available_triggers:['first','second']})).body.actions.length,1);
 }finally{await a.close();}
});
test('new context with expired offers is respected when the merchant accepts',async()=>{
 const s=seeded();s.pushContext('trigger','event',1,NOW,{...trigger,id:'event',kind:'ipl_match_today',payload:{match:'DC vs MI',match_time_iso:'2026-04-26T19:30:00+05:30'}});
 const a=await serve(s);try{
 const action=(await a.request('/v1/tick',{now:NOW,available_triggers:['event']})).body.actions[0];assert.match(action.body,/₹129/);
 s.pushContext('merchant',merchant.merchant_id,2,NOW,{...merchant,offers:merchant.offers?.map(o=>({...o,status:'expired'}))});
 const r=(await a.request('/v1/reply',{conversation_id:action.conversation_id,merchant_id:merchant.merchant_id,from_role:'merchant',message:'yes',turn_number:2,received_at:'2026-04-26T10:35:00Z'})).body;
 assert.doesNotMatch(r.body,/₹129|₹9/);
 }finally{await a.close();}
});
test('10 requests per second for two seconds stays within deadline',async()=>{
 const a=await serve(seeded()),times:number[]=[];try{
 for(let i=0;i<20;i++){const start=performance.now();assert.equal((await a.request('/v1/healthz')).status,200);times.push(performance.now()-start);await new Promise(r=>setTimeout(r,100));}
 assert.ok(Math.max(...times)<30000);console.log(JSON.stringify({measurement:'20 health requests at ~10 rps',max_ms:Math.max(...times),mean_ms:times.reduce((x,y)=>x+y)/times.length}));
 }finally{await a.close();}
});
