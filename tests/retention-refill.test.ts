import test from 'node:test';
import assert from 'node:assert/strict';
import {NOW,merchant,trigger,customer,seeded,serve} from './helpers';
for(const refill of [false,true])test(refill?'refill YES provides private pharmacy handoff without booking claims':'seasonal gym acceptance provides retention steps rather than contact audit',async()=>{
 const store=seeded(),slug=refill?'pharmacies':'gyms';
 store.pushContext('category',slug,1,NOW,{slug,voice:{tone:'practical'},peer_stats:{avg_ctr:.045}});
 store.pushContext('merchant',merchant.merchant_id,2,NOW,{...merchant,category_slug:slug,offers:[],performance:{...merchant.performance,ctr:.08}});
 if(refill)store.pushContext('customer',customer.customer_id,1,NOW,{...customer,consent:{opted_in_at:'2026-04-01',scope:['refill_reminders']}});
 const t={...trigger,scope:refill?'customer':'merchant',customer_id:refill?customer.customer_id:null,kind:refill?'chronic_refill_due':'seasonal_perf_dip',payload:refill?{molecule_list:['PRIVATE-MEDICATION'],stock_runs_out_iso:'2026-04-27T10:30:00Z'}:{metric:'calls',delta_pct:-.4,is_expected_seasonal:true}};
 store.pushContext('trigger',t.id,2,NOW,t);
 const api=await serve(store);try{
  const action=(await api.request('/v1/tick',{now:NOW,available_triggers:[t.id]})).body.actions[0];assert.ok(action);
  const req={conversation_id:action.conversation_id,merchant_id:merchant.merchant_id,customer_id:t.customer_id,from_role:refill?'customer':'merchant',message:refill?'YES':'Yes, show me the retention plan.',received_at:NOW,turn_number:2};
  const r=await api.request('/v1/reply',req);assert.equal(r.status,200);assert.equal(r.body.action,'send');
  if(refill){assert.match(r.body.body,/existing prescription/);assert.match(r.body.body,/cannot check live stock or notify/);assert.doesNotMatch(r.body.body,/PRIVATE-MEDICATION|booking|slot|stock is available/);}
  else{assert.match(r.body.body,/attendance and renewals/);assert.match(r.body.body,/do not establish member churn/);assert.match(r.body.body,/permission for this purpose and channel/);assert.doesNotMatch(r.body.body,/call button|₹|free trial/);}
  assert.deepEqual((await api.request('/v1/reply',req)).body,r.body);
 }finally{await api.close();}
});
