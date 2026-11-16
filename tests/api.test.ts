import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EngineStore} from '../src/engine/store';
import {NOW,category,merchant,trigger,customer,seeded,serve} from './helpers';
const context=(scope:string,id:string,payload:any,version=1)=>({scope,context_id:id,version,delivered_at:NOW,payload});
const tick={now:NOW,available_triggers:[trigger.id]};
const reply=(a:any,message:string,turn=2)=>({conversation_id:a.conversation_id,merchant_id:a.merchant_id,customer_id:a.customer_id,from_role:a.customer_id?'customer':'merchant',message,received_at:`2026-04-26T10:${30+turn}:00Z`,turn_number:turn});

test('health and metadata use exact mandatory field types and initially empty state',async()=>{
 const a=await serve();try{const h=await a.request('/v1/healthz');assert.equal(h.status,200);assert.deepEqual(h.body.contexts_loaded,{category:0,merchant:0,customer:0,trigger:0});const m=(await a.request('/v1/metadata')).body;assert.ok(Array.isArray(m.team_members));for(const k of ['team_name','approach','model','contact_email','version','submitted_at'])assert.equal(typeof m[k],'string');}finally{await a.close();}
});
test('context equality no-op, higher version replacement, lower HTTP 409',async()=>{
 const a=await serve();try{
 const b=context('merchant',merchant.merchant_id,merchant,2);assert.equal((await a.request('/v1/context',b)).body.accepted,true);
 const equal=await a.request('/v1/context',{...b,payload:{...merchant,offers:[]}});assert.equal(equal.status,200);assert.ok(equal.body.stored_at);assert.equal(a.store.getMerchant(merchant.merchant_id)?.offers?.length,2);
 assert.deepEqual(await a.request('/v1/context',{...b,version:1}),{status:409,body:{accepted:false,reason:'stale_version',current_version:2}});
 await a.request('/v1/context',{...b,version:3,payload:{...merchant,offers:[]}});assert.deepEqual(a.store.getMerchant(merchant.merchant_id)?.offers,[]);
 }finally{await a.close();}
});
test('bad scope/types/IDs/dates/malformed JSON and oversized data return structured errors',async()=>{
 const a=await serve();try{
 const good=context('merchant',merchant.merchant_id,merchant);
 for(const b of [null,[],{...good,scope:'x'},{...good,version:'1'},{...good,version:-1},{...good,delivered_at:'2026-02-30T10:00:00Z'},{...good,context_id:'wrong'},{...good,payload:{...merchant,performance:'bad'}},{...good,payload:{...merchant,offers:[null]}}]) assert.equal((await a.request('/v1/context',b)).status,400);
 assert.equal((await a.request('/v1/context',undefined,'{bad')).status,400);
 assert.equal((await a.request('/v1/context',{...good,padding:'x'.repeat(512001)})).status,413);
 assert.equal((await a.request('/v1/tick',{now:'bad',available_triggers:[]})).status,400);
 assert.equal((await a.request('/v1/tick',{now:NOW,available_triggers:[9]})).status,400);
 }finally{await a.close();}
});
test('tick respects expiry, unknown IDs, dedup and new conversation requirement',async()=>{
 const a=await serve(seeded());try{
 assert.deepEqual((await a.request('/v1/tick',{now:'2027-01-01T00:00:00Z',available_triggers:[trigger.id]})).body,{actions:[]});
 const first=(await a.request('/v1/tick',{...tick,available_triggers:[trigger.id,trigger.id,'unknown']})).body.actions;assert.equal(first.length,1);
 assert.deepEqual((await a.request('/v1/tick',tick)).body.actions,[]);
 await a.request('/v1/context',context('trigger',trigger.id,{...trigger,payload:{intent_topic:'changed'}},2));
 assert.deepEqual((await a.request('/v1/tick',tick)).body.actions,[]);
 }finally{await a.close();}
});
test('highest supported priority wins for same recipient regardless of input order',async()=>{
 const s=seeded();s.pushContext('trigger','low',1,NOW,{...trigger,id:'low',kind:'dormant_with_vera',payload:{days_since_last_merchant_message:35},suppression_key:'low'});
 const a=await serve(s);try{const out=(await a.request('/v1/tick',{now:NOW,available_triggers:['low',trigger.id]})).body.actions;assert.equal(out.length,1);assert.equal(out[0].trigger_id,trigger.id);}finally{await a.close();}
});
test('20 action cap does not mark the unsent tail as suppressed',async()=>{
 const s=seeded(),ids=[];
 for(let i=0;i<25;i++){const id='m'+i,tid='t'+i;ids.push(tid);s.pushContext('merchant',id,1,NOW,{...merchant,merchant_id:id});s.pushContext('trigger',tid,1,NOW,{...trigger,id:tid,merchant_id:id});}
 const a=await serve(s);try{assert.equal((await a.request('/v1/tick',{now:NOW,available_triggers:ids})).body.actions.length,20);assert.equal((await a.request('/v1/tick',{now:NOW,available_triggers:ids})).body.actions.length,5);}finally{await a.close();}
});
test('same category suppression key does not suppress another merchant',async()=>{
 const s=seeded();s.pushContext('merchant','other',1,NOW,{...merchant,merchant_id:'other'});s.pushContext('trigger','other-t',1,NOW,{...trigger,id:'other-t',merchant_id:'other'});
 const a=await serve(s);try{assert.equal((await a.request('/v1/tick',{now:NOW,available_triggers:[trigger.id,'other-t']})).body.actions.length,2);}finally{await a.close();}
});
test('concurrent ticks emit an event once',async()=>{
 const a=await serve(seeded());try{const results=await Promise.all(Array.from({length:10},()=>a.request('/v1/tick',tick)));assert.equal(results.reduce((n,r)=>n+r.body.actions.length,0),1);}finally{await a.close();}
});
test('consent, scope and relationship mismatch suppress customer action',async()=>{
 const s=seeded(),t={...trigger,id:'cust-t',scope:'customer',kind:'appointment_tomorrow',customer_id:customer.customer_id,payload:{appointment_time:'2026-04-27T14:00:00Z'}};
 s.pushContext('trigger',t.id,1,NOW,t);s.pushContext('customer',customer.customer_id,1,NOW,{...customer,merchant_id:'wrong'});
 const a=await serve(s);try{assert.deepEqual((await a.request('/v1/tick',{now:NOW,available_triggers:[t.id]})).body.actions,[]);
 await a.request('/v1/context',context('customer',customer.customer_id,customer,2));assert.equal((await a.request('/v1/tick',{now:NOW,available_triggers:[t.id]})).body.actions[0].send_as,'merchant_on_behalf');}finally{await a.close();}
});
test('reply delivers actual plan, advances approval, and replays idempotently',async()=>{
 const a=await serve(seeded());try{const action=(await a.request('/v1/tick',tick)).body.actions[0],b=reply(action,"ok let's do it");const r=await a.request('/v1/reply',b);assert.equal(r.body.action,'send');assert.match(r.body.body,/Menu: \[approved thali/);assert.doesNotMatch(r.body.body,/Confirm to send|reserved/);
 const n=a.store.getConversation(action.conversation_id).turns.length;assert.deepEqual(await a.request('/v1/reply',b),r);assert.equal(a.store.getConversation(action.conversation_id).turns.length,n);
 assert.equal((await a.request('/v1/reply',{...b,message:'different'})).status,409);
 const next=(await a.request('/v1/reply',reply(action,'yes please',4))).body;assert.match(next.body,/Draft approved/);assert.match(next.body,/not been published/);
 }finally{await a.close();}
});
test('reply ownership and unknown conversations are rejected',async()=>{
 const a=await serve(seeded());try{const action=(await a.request('/v1/tick',tick)).body.actions[0];assert.equal((await a.request('/v1/reply',{...reply(action,'yes'),merchant_id:'other'})).status,409);assert.equal((await a.request('/v1/reply',{...reply(action,'yes'),conversation_id:'missing'})).status,404);assert.equal((await a.request('/v1/reply',{})).status,400);}finally{await a.close();}
});
test('opt-out prevents later events while refusal closes only this proposal',async()=>{
 const a=await serve(seeded());try{const action=(await a.request('/v1/tick',tick)).body.actions[0];assert.equal((await a.request('/v1/reply',reply(action,'STOP'))).body.action,'end');a.store.pushContext('trigger','new',1,NOW,{...trigger,id:'new',suppression_key:'new'});assert.deepEqual((await a.request('/v1/tick',{now:NOW,available_triggers:['new']})).body.actions,[]);}finally{await a.close();}
});
test('auto-reply loop waits then ends; hostile and off-topic replies stay on mission',async()=>{
 const a=await serve(seeded());try{const action=(await a.request('/v1/tick',tick)).body.actions[0];const b=reply(action,'Thank you for contacting our business.');assert.equal((await a.request('/v1/reply',b)).body.action,'wait');assert.equal((await a.request('/v1/reply',reply(action,b.message,4))).body.action,'end');}finally{await a.close();}
 const b=await serve(seeded());try{const action=(await b.request('/v1/tick',tick)).body.actions[0];assert.equal((await b.request('/v1/reply',reply(action,'stupid bot'))).body.action,'send');assert.match((await b.request('/v1/reply',reply(action,'can you file GST',4))).body.body,/appropriate professional/);}finally{await b.close();}
});
test('no, yes but later and negative commitment do not dispatch a pitch',async()=>{
 for(const message of ['no','yes but later','do not proceed']){const a=await serve(seeded());try{const action=(await a.request('/v1/tick',tick)).body.actions[0];assert.ok(['end','wait'].includes((await a.request('/v1/reply',reply(action,message))).body.action));}finally{await a.close();}}
});
test('customer booking response never claims a reservation',async()=>{
 const s=seeded();s.pushContext('customer',customer.customer_id,1,NOW,customer);const t={...trigger,id:'cust',scope:'customer',kind:'appointment_tomorrow',customer_id:customer.customer_id,payload:{appointment_time:'2026-04-27T15:00:00Z'}};s.pushContext('trigger',t.id,1,NOW,t);
 const a=await serve(s);try{const action=(await a.request('/v1/tick',{now:NOW,available_triggers:[t.id]})).body.actions[0];const r=(await a.request('/v1/reply',reply(action,'yes book it'))).body;assert.match(r.body,/listed appointment/);assert.doesNotMatch(r.body,/booking (?:created|updated)|slot has been reserved/);}finally{await a.close();}
});
test('durable snapshot preserves contexts, conversations, suppression and reply replay',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vera-state-')),file=path.join(dir,'state.json');
 const s=seeded();s.stateFile=file;const a=await serve(s);let action:any,b:any,r:any;
 try{action=(await a.request('/v1/tick',tick)).body.actions[0];b=reply(action,'yes');r=await a.request('/v1/reply',b);}finally{await a.close();}
 const next=await serve(new EngineStore(false,file));try{assert.deepEqual((await next.request('/v1/tick',tick)).body.actions,[]);assert.deepEqual(await next.request('/v1/reply',b),r);assert.equal(next.store.merchants.size,1);
 await next.request('/v1/teardown',{});assert.equal(new EngineStore(false,file).merchants.size,0);assert.equal(next.store.replyCache.size,0);
 }finally{await next.close();fs.rmSync(dir,{recursive:true});}
});
test('failed persistence rolls back request state and returns JSON error',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vera-fail-'));const s=new EngineStore();s.stateFile=dir;
 const a=await serve(s);try{assert.equal((await a.request('/v1/context',context('merchant',merchant.merchant_id,merchant))).status,500);assert.equal(s.merchants.size,0);}finally{await a.close();fs.rmSync(dir,{recursive:true});fs.rmSync(dir+'.tmp',{force:true});}
});
test('admin data and reset endpoints are disabled by default',async()=>{const a=await serve();try{assert.equal((await a.request('/api/state')).status,404);assert.equal((await a.request('/api/reset-suppressions',{})).status,404);}finally{await a.close();}});
test('changed intent retires the old draft and no subsequent reply repeats the old pitch',async()=>{
 const a=await serve(seeded());try{const action=(await a.request('/v1/tick',tick)).body.actions[0];await a.request('/v1/reply',reply(action,'yes'));const change=(await a.request('/v1/reply',reply(action,'Instead help with delivery hours',4))).body;assert.match(change.body,/Revised brief/);const next=(await a.request('/v1/reply',reply(action,'yes',6))).body;assert.match(next.body,/delivery hours/);assert.doesNotMatch(next.body,/corporate bulk lunch/);}finally{await a.close();}
});
test('confusion asks for clarification, and expired proposal is not executed',async()=>{
 const a=await serve(seeded());try{const action=(await a.request('/v1/tick',tick)).body.actions[0];assert.equal((await a.request('/v1/reply',reply(action,"I don't understand"))).body.action,'send');const expired={...reply(action,'yes',4),received_at:'2026-06-01T10:00:00Z'};assert.match((await a.request('/v1/reply',expired)).body.body,/no longer sufficient/);}finally{await a.close();}
});
test('optional local dashboard demo creates a real conversation for replies',async()=>{
 process.env.ENABLE_DASHBOARD='true';const a=await serve(seeded());delete process.env.ENABLE_DASHBOARD;
 try{const started=await a.request('/api/demo/start',{merchant_id:merchant.merchant_id,role:'merchant'});assert.equal(started.status,200);const action=started.body.action;const out=await a.request('/v1/reply',{...reply(action,'yes'),received_at:new Date().toISOString()});assert.equal(out.status,200);assert.equal(out.body.action,'send');}finally{await a.close();}
});
