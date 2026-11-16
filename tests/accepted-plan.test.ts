import test from 'node:test';
import assert from 'node:assert/strict';
import {NOW,merchant,trigger,seeded,serve} from './helpers';

async function performanceConversation(categorySlug='restaurants') {
  const store=seeded();
  const cat=store.getCategory('restaurants')!;
  if(categorySlug!=='restaurants') store.pushContext('category',categorySlug,1,NOW,{...cat,slug:categorySlug});
  store.pushContext('merchant',merchant.merchant_id,2,NOW,{...merchant,category_slug:categorySlug,offers:[]});
  store.pushContext('trigger',trigger.id,2,NOW,{...trigger,kind:'perf_dip',payload:{metric:'calls',delta_pct:-.4,window:'7d'}});
  const api=await serve(store);
  const action=(await api.request('/v1/tick',{now:NOW,available_triggers:[trigger.id]})).body.actions[0];
  const reply=(message:string,turn_number=2)=>api.request('/v1/reply',{
    conversation_id:action.conversation_id,merchant_id:merchant.merchant_id,customer_id:null,
    from_role:'merchant',message,received_at:`2026-04-26T10:${30+turn_number}:00Z`,turn_number,
  });
  return {...api,reply};
}

test('accepted performance review answers what to check first with concrete diagnostic steps',async()=>{
 const api=await performanceConversation();try {
  const r=await api.reply('Yes, show me the plan. What exactly should I check first?');
  assert.equal(r.status,200);assert.equal(r.body.action,'send');
  assert.match(r.body.body,/phone number|call button/i);assert.match(r.body.body,/opening hours/i);
  assert.match(r.body.body,/menu/i);assert.match(r.body.body,/missed calls/i);
  assert.doesNotMatch(r.body.body,/we could review|calls down 40%|draft approved|₹|discount|guaranteed/i);
  assert.match(r.body.body,/\?/);assert.ok((r.body.body.match(/\?/g)||[]).length===1);
 }finally{await api.close();}
});
test('a request for details without YES also delivers the review plan',async()=>{
 const api=await performanceConversation();try {
  const r=await api.reply('What exactly should I check first?');
  assert.match(r.body.body,/phone number|call button/i);assert.doesNotMatch(r.body.body,/What would you like to change/i);
 }finally{await api.close();}
});
test('YES plus a question after the draft does not falsely approve it',async()=>{
 const api=await performanceConversation();try {
  await api.reply('yes');
  const r=await api.reply('Yes, but how do I check the phone number?',4);
  assert.equal(r.body.action,'send');assert.doesNotMatch(r.body.body,/draft approved/i);
  assert.match(r.body.body,/call button|place a test call|phone number/i);
  const conv=[...api.store.conversations.values()][0];assert.notEqual(conv.draft_approved,true);
 }finally{await api.close();}
});
test('performance review is relevant to a pharmacy rather than inventing restaurant services',async()=>{
 const api=await performanceConversation('pharmacies');try {
  const r=await api.reply('Show me the plan');
  assert.equal(r.body.action,'send');assert.match(r.body.body,/delivery information|pharmacist/i);
  assert.doesNotMatch(r.body.body,/menu|thali|discount|cure/i);
 }finally{await api.close();}
});
