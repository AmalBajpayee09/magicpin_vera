import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,composeWithTrace,NoActionError} from '../src/engine/composer';
import {selectEvidencePlan,activeOffers,customerAllowed,validateOutput} from '../src/engine/decision';
import {NOW,category,merchant,trigger,customer} from './helpers';

test('same input produces exactly identical action including template fields',()=>{
 const a=compose(category,merchant,trigger,null,NOW);assert.deepEqual(a,compose(category,merchant,trigger,null,NOW));
 assert.equal(a.template_name,'vera_context_update_v1');assert.equal(a.template_params?.join(' '),a.body);assert.match(a.body,/corporate bulk lunch/);assert.doesNotMatch(a.body,/₹9|published|sent to customers/);
});
test('placeholder and unknown trigger are genuine no-action',()=>{
 assert.equal(selectEvidencePlan(category,merchant,{...trigger,payload:{placeholder:true,metric_or_topic:'whatever'}},null,NOW),null);
 assert.throws(()=>compose(category,merchant,{...trigger,kind:'unknown',payload:{}},null,NOW),NoActionError);
});
test('fresh digest is selected by exact reference, never unrelated fallback',()=>{
 const t={...trigger,kind:'research_digest',payload:{top_item_id:'new-source'}};assert.match(compose(category,merchant,t,null,NOW).body,/Local lunch demand up 18%/);
 assert.equal(selectEvidencePlan(category,merchant,{...t,payload:{top_item_id:'missing'}},null,NOW),null);
});
test('current performance wins over stale trigger and above-peer CTR changes proposed action',()=>{
 const t={...trigger,kind:'perf_dip',payload:{metric:'calls',delta_pct:-.9}};
 const a=compose(category,merchant,t,null,NOW);assert.match(a.body,/down 40%/);assert.match(a.body,/retention/);assert.doesNotMatch(a.body,/90%|below/);
 const changed={...merchant,performance:{...merchant.performance,delta_7d:{calls_pct:.5}}};assert.equal(selectEvidencePlan(category,changed,t,null,NOW),null);
});
test('active offers honor status, dates and Indian weekday restrictions',()=>{
 const m={...merchant,offers:[{id:'1',title:'BOGO Tue–Thu',status:'active'},{id:'2',title:'expired by date',status:'active',valid_until:'2026-04-01'},{id:'3',title:'future',status:'active',valid_from:'2026-06-01'},{id:'4',title:'invalid',status:'active',valid_until:'bad'},{id:'5',title:'okay',status:'active'}]};
 assert.deepEqual(activeOffers(m,NOW).map(o=>o.id),['5']);assert.deepEqual(activeOffers(m,'2026-04-28T12:00:00Z').map(o=>o.id),['1','5']);
});
test('consent is purpose specific and merchant relationships must match',()=>{
 const t={...trigger,scope:'customer' as const,kind:'appointment_tomorrow',customer_id:customer.customer_id,payload:{appointment_time:'2026-04-27T10:00:00Z',service:'consultation'}};
 assert.equal(customerAllowed(t,customer,NOW),true);
 for(const c of [{...customer,merchant_id:'other'},{...customer,consent:{...customer.consent,scope:['promotional_offers']}},{...customer,preferences:{channel:'email'}},{...customer,consent:undefined}]) assert.equal(customerAllowed(t,c as any,NOW),false);
 const a=compose(category,merchant,t,customer,NOW);assert.equal(a.send_as,'merchant_on_behalf');assert.match(a.body,/Priya/);assert.match(a.body,/2026-04-27/);
});
test('lifecycle state changes winback eligibility and wording',()=>{
 const t={...trigger,scope:'customer' as const,kind:'customer_lapsed_hard',customer_id:customer.customer_id,payload:{days_since_last_visit:91}};
 const c={...customer,state:'lapsed_hard' as const,consent:{opted_in_at:'2026-04-01',scope:['winback_offers']}};
 assert.equal(selectEvidencePlan(category,merchant,t,{...c,state:'active'},NOW),null);
 assert.match(compose(category,merchant,t,c,NOW).body,/91 days/);
 assert.match(compose(category,merchant,t,{...c,state:'churned'},NOW).body,/whenever it suits/);
});
test('pharmacy recall preserves batch IDs and does not invent treatment',()=>{
 const cat={...category,slug:'pharmacies'},m={...merchant,category_slug:'pharmacies'};
 const t={...trigger,kind:'supply_alert',payload:{molecule:'atorvastatin',manufacturer:'MfrZ',affected_batches:['AT2024-1102','AT2024-1108']}};
 const a=compose(cat,m,t,null,NOW);assert.match(a.body,/AT2024-1102, AT2024-1108/);assert.match(a.body,/official notice/);assert.doesNotMatch(a.body,/stop taking|replacement|cure/);
});
test('customer refill avoids medication detail disclosure and requires pharmacy category',()=>{
 const c={...customer,consent:{opted_in_at:'2026-04-01',scope:['refill_reminders']}};
 const t={...trigger,scope:'customer' as const,kind:'chronic_refill_due',customer_id:c.customer_id,payload:{molecule_list:['atorvastatin'],stock_runs_out_iso:'2026-04-28T12:00:00Z'}};
 assert.equal(selectEvidencePlan(category,merchant,t,c,NOW),null);
 const a=compose({...category,slug:'pharmacies'},{...merchant,category_slug:'pharmacies'},t,c,NOW);assert.doesNotMatch(a.body,/atorvastatin/);assert.match(a.body,/2026-04-28/);
});
test('far future festival and past event do not create urgency',()=>{
 for(const payload of [{festival:'Diwali',days_until:188,date:'2026-10-31'},{event_name:'Old match',date:'2026-04-25'}]) assert.equal(selectEvidencePlan(category,merchant,{...trigger,kind:'festival_upcoming',payload},null,NOW),null);
});
test('offer catalog is not merchant activation',()=>{
 const m={...merchant,offers:[]};const cat={...category,offer_catalog:[{id:'cat',title:'Free Lunch ₹1'}]};
 const a=compose(cat,m,{...trigger,kind:'ipl_match_today',payload:{match:'DC vs MI',match_time_iso:'2026-04-26T19:30:00+05:30'}},null,NOW);assert.doesNotMatch(a.body,/Free Lunch|₹1/);
});
test('output validation rejects altered numeric claims and multiple CTAs',()=>{
 const r=composeWithTrace(category,merchant,trigger,null,NOW);
 assert.equal(validateOutput({...r.action,body:r.action.body+' Guaranteed 999999 customers.'},r.plan,merchant),false);
 assert.equal(validateOutput({...r.action,body:r.action.body+' Another question?'},r.plan,merchant),false);
});
test('recall does not send months before due or before the recorded last service',()=>{
 const cat={...category,slug:'dentists'},m={...merchant,category_slug:'dentists'},c={...customer,consent:{opted_in_at:'2026-01-01',scope:['recall_reminders']}};
 const t={...trigger,scope:'customer' as const,customer_id:customer.customer_id,kind:'recall_due',payload:{service_due:'cleaning',due_date:'2026-11-12',last_service_date:'2026-05-12'}};
 assert.equal(selectEvidencePlan(cat,m,t,c,NOW),null);
 assert.ok(selectEvidencePlan(cat,m,t,c,'2026-11-01T10:00:00Z'));
});
