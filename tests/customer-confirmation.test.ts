import test from 'node:test';
import assert from 'node:assert/strict';
import {NOW,merchant,trigger,customer,seeded,serve} from './helpers';

async function appointmentConversation(){
 const store=seeded();store.pushContext('customer',customer.customer_id,1,NOW,customer);
 const t={...trigger,id:'listed-appointment',scope:'customer' as const,kind:'appointment_tomorrow',customer_id:customer.customer_id,payload:{service:'haircut',appointment_time:'2026-04-27T15:00:00Z'}};
 store.pushContext('trigger',t.id,1,NOW,t);const api=await serve(store);
 const action=(await api.request('/v1/tick',{now:NOW,available_triggers:[t.id]})).body.actions[0];
 const body=(message:string,turn_number=2)=>({conversation_id:action.conversation_id,merchant_id:merchant.merchant_id,customer_id:customer.customer_id,from_role:'customer',message,received_at:`2026-04-26T10:${30+turn_number}:00Z`,turn_number});
 return {...api,action,body};
}

test('YES acknowledges the existing appointment rather than inventing a new booking flow',async()=>{
 const api=await appointmentConversation();try{
  const r=await api.request('/v1/reply',api.body('YES'));assert.equal(r.status,200);assert.equal(r.body.action,'send');
  assert.match(r.body.body,/confirmation.*recorded.*conversation/i);assert.match(r.body.body,/haircut/);assert.match(r.body.body,/2026-04-27T15:00:00Z/);
  assert.doesNotMatch(r.body.body,/no slot is reserved|complete the booking|salon has been notified|booking (?:created|updated|confirmed)/i);
  assert.ok(api.store.getConversation(api.action.conversation_id).turns.some(t=>t.from==='customer'&&t.message==='YES'));
 }finally{await api.close();}
});
test('confirmation retry returns cached answer without recording another turn',async()=>{
 const api=await appointmentConversation();try{
  const request=api.body('YES'),first=await api.request('/v1/reply',request),count=api.store.getConversation(api.action.conversation_id).turns.length;
  assert.match(first.body.body,/confirmation.*recorded/i);assert.deepEqual(await api.request('/v1/reply',request),first);assert.equal(api.store.getConversation(api.action.conversation_id).turns.length,count);
 }finally{await api.close();}
});
test('asking the appointment time is not treated as customer confirmation',async()=>{
 const api=await appointmentConversation();try{
  const r=await api.request('/v1/reply',api.body('Can you confirm what time my appointment is?'));
  assert.equal(r.body.action,'send');assert.match(r.body.body,/2026-04-27T15:00:00Z/);assert.doesNotMatch(r.body.body,/your confirmation.*recorded/i);
 }finally{await api.close();}
});
test('CANCEL after YES does not invent a booking-system change',async()=>{
 const api=await appointmentConversation();try{
  await api.request('/v1/reply',api.body('YES'));
  const r=await api.request('/v1/reply',api.body('CANCEL, I cannot attend.',4));assert.equal(r.body.action,'send');
  assert.match(r.body.body,/contact the business/);assert.doesNotMatch(r.body.body,/appointment (?:is|has been) cancelled|cancellation confirmed/i);
 }finally{await api.close();}
});
