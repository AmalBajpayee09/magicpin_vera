import {createApp} from '../src/api';
import {EngineStore} from '../src/engine/store';
import {CategoryContext,MerchantContext,TriggerContext,CustomerContext} from '../src/types';
export const NOW='2026-04-26T10:30:00Z';
export const category:CategoryContext={slug:'restaurants',voice:{tone:'warm'},peer_stats:{avg_ctr:.03},digest:[{id:'new-source',kind:'research',title:'Local lunch demand up 18%',source:'Supplied Research 2026'}]};
export const merchant:MerchantContext={merchant_id:'unseen-merchant',category_slug:'restaurants',identity:{name:'Unseen Cafe',locality:'Pune',languages:['en'],verified:true},performance:{views:1217,calls:34,ctr:.04,window_days:30,delta_7d:{views_pct:-.2,calls_pct:-.4}},offers:[{id:'expired',title:'Old Lunch ₹9',status:'expired'},{id:'active',title:'Lunch ₹129',status:'active'}]};
export const trigger:TriggerContext={id:'new-plan',scope:'merchant',kind:'active_planning_intent',merchant_id:merchant.merchant_id,payload:{intent_topic:'corporate_bulk_lunch'},urgency:4,suppression_key:'plan:week17',expires_at:'2026-05-03T00:00:00Z'};
export const customer:CustomerContext={customer_id:'new-customer',merchant_id:merchant.merchant_id,identity:{name:'Priya',language_pref:'english'},state:'active',preferences:{channel:'whatsapp',reminder_opt_in:true},consent:{opted_in_at:'2026-04-01',scope:['appointment_reminders']}};
export function seeded(){const s=new EngineStore();s.pushContext('category',category.slug,1,NOW,category);s.pushContext('merchant',merchant.merchant_id,1,NOW,merchant);s.pushContext('trigger',trigger.id,1,NOW,trigger);return s;}
export async function serve(store=new EngineStore()) {
 const app=createApp(store);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const address=server.address() as any,url=`http://127.0.0.1:${address.port}`;
 const request=async(path:string,body?:any,raw?:string)=>{
  const res=await fetch(url+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:raw??(body===undefined?undefined:JSON.stringify(body))});return {status:res.status,body:await res.json()};
 };
 return {store,request,url,close:()=>new Promise<void>((r,j)=>server.close(e=>e?j(e):r()))};
}
