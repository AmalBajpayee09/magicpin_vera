import test from 'node:test';
import assert from 'node:assert/strict';
import {NOW,merchant,trigger,seeded,serve} from './helpers';
for (const [slug,kind,payload,message,patterns] of [
 ['salons','active_planning_intent',{intent_topic:'bridal_service_package'},'Yes, show me a concrete outline.',[/Services: \[merchant-approved/,/Consultation or trial/,/Customer draft/]],
 ['restaurants','active_planning_intent',{intent_topic:'corporate_bulk_thali_package'},'Yes, what would the package outline look like?',[/Menu: \[approved thali/,/minimum quantity and lead time/,/Billing:/]],
 ['pharmacies','supply_alert',{molecule:'synthetic product',manufacturer:'Synthetic Manufacturer',affected_batches:['SYN-001','SYN-002']},'Yes, show me the batch-check checklist.',[/SYN-001/,/SYN-002/,/compare the labels/,/record matches, quantities/]],
] as const) {
 test(`accepted ${slug} proposal delivers concrete fields and replays identically`,async()=>{
  const store=seeded();
  store.pushContext('category',slug,2,NOW,{slug,voice:{tone:'practical'}});
  store.pushContext('merchant',merchant.merchant_id,2,NOW,{...merchant,category_slug:slug,offers:[]});
  store.pushContext('trigger',trigger.id,2,NOW,{...trigger,kind,payload});
  const api=await serve(store);
  try {
   const action=(await api.request('/v1/tick',{now:NOW,available_triggers:[trigger.id]})).body.actions[0];
   assert.ok(action);
   const req={conversation_id:action.conversation_id,merchant_id:merchant.merchant_id,from_role:'merchant',customer_id:null,message,received_at:NOW,turn_number:2};
   const response=await api.request('/v1/reply',req);
   assert.equal(response.status,200);assert.equal(response.body.action,'send');
   for(const pattern of patterns)assert.match(response.body.body,pattern);
   assert.doesNotMatch(response.body.body,/₹|999|129|CDSCO|FDA|guaranteed|nothing has been dispatched/);
   assert.equal((response.body.body.match(/\?/g)||[]).length,1);
   assert.deepEqual((await api.request('/v1/reply',req)).body,response.body);
  } finally {await api.close();}
 });
}
