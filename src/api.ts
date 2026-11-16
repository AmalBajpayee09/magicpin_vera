import express from 'express';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EngineStore } from './engine/store';
import { composeWithTrace, NoActionError } from './engine/composer';
import { selectEvidencePlan, eventKey, suppressionKey, recipientKey } from './engine/decision';
import { handleReply } from './engine/replier';
import { validateContext, validateReply, validateTick, InputError } from './engine/validation';
import { runCanonicalBenchmark, getLatestBenchmarkReport } from './engine/benchmark';

export function createApp(store: EngineStore) {
  const app = express(); app.disable('x-powered-by');
  app.use(express.json({limit:500 * 1024,strict:true}));
  app.use((req,res,next) => {
    res.set('Cache-Control','no-store');
    // Optional shared token. Leave unset for a judge that cannot send auth headers.
    if (process.env.BOT_TOKEN && req.method === 'POST' && req.get('Authorization') !== `Bearer ${process.env.BOT_TOKEN}`) return res.status(401).json({error:'unauthorized'});
    next();
  });
  const health = (_req: express.Request,res: express.Response) => res.json({status:'ok',uptime_seconds:store.getUptimeSeconds(),contexts_loaded:{category:store.categories.size,merchant:store.merchants.size,customer:store.customers.size,trigger:store.triggers.size}});
  app.get('/v1/healthz',health);app.get('/healthz',health);
  app.get('/v1/metadata', (_req,res) => res.json({team_name:process.env.TEAM_NAME || 'VERA Candidate',
    team_members:(process.env.TEAM_MEMBERS || 'Candidate').split(',').map(s=>s.trim()).filter(Boolean),
    model:'deterministic evidence-plan composer (no external LLM)',approach:'Evidence-gated decisions, ranked signals, consent and recipient-scoped suppression, durable conversation state',
    contact_email:process.env.CONTACT_EMAIL || 'candidate@example.com',version:'5.0.0',submitted_at:process.env.SUBMITTED_AT || '2026-11-16T00:00:00Z'}));
  app.post('/v1/context', (req,res,next) => {
    try {
      validateContext(req.body);const b=req.body;
      const current = (store[({category:'categories',merchant:'merchants',customer:'customers',trigger:'triggers'} as const)[b.scope]] as Map<string,any>).get(b.context_id);
      if (current && current.version > b.version) return res.status(409).json({accepted:false,reason:'stale_version',current_version:current.version});
      const result=store.transaction(()=>store.pushContext(b.scope,b.context_id,b.version,b.delivered_at,b.payload));
      return res.json({accepted:result.accepted,ack_id:result.ack_id,stored_at:current?.version === b.version ? (current.stored_at || current.delivered_at) : (store[({category:'categories',merchant:'merchants',customer:'customers',trigger:'triggers'} as const)[b.scope]] as Map<string,any>).get(b.context_id).stored_at});
    } catch(e) {next(e);}
  });
  app.post('/v1/tick', (req,res,next) => {
    try {
      validateTick(req.body);const {now}=req.body;const at=Date.parse(now);
      const actions=store.transaction(()=>{
        const candidates: Array<{t:any; result:ReturnType<typeof composeWithTrace>}> = [];
        for (const id of new Set<string>(req.body.available_triggers)) {
          const t=store.getTrigger(id); if(!t) continue;
          if(t.status === 'invalid' || t.status === 'stale' || t.is_stale || (t.expires_at && Date.parse(t.expires_at)<=at)) continue;
          if(store.sentEvents.has(eventKey(t)) || store.isSuppressed(suppressionKey(t),at) || store.optedOut.has(recipientKey(t.merchant_id,t.customer_id))) continue;
          const m=store.getMerchant(t.merchant_id); if(!m) continue;
          const history=m.conversation_history || [];
          if(t.scope === 'merchant' && history.some(h=>h.from==='merchant' && /\b(stop messaging|unsubscribe|do not contact|stop contacting)\b/i.test(h.body))) continue;
          if([...store.conversations.values()].some(c=>c.merchant_id===t.merchant_id && (c.customer_id || null)===(t.customer_id || null) && c.status==='waiting' && c.now && at < Date.parse(c.now)+(c as any).wait_seconds*1000)) continue;
          const lastMerchantTurn=history.filter(h=>h.from==='merchant').at(-1);
          if(t.scope==='merchant' && lastMerchantTurn && /\b(not interested|no thanks|do not proceed|nahi chahiye)\b/i.test(lastMerchantTurn.body) && Date.parse(lastMerchantTurn.ts)<=at && at-Date.parse(lastMerchantTurn.ts)<86400000) continue;
          const c=t.customer_id?store.getCustomer(t.customer_id):null;
          const cat=store.getCategory(m.category_slug);
          if(!selectEvidencePlan(cat,m,t,c,now)) continue;
          try {candidates.push({t,result:composeWithTrace(cat,m,t,c,now)});}
          catch(e) {if(!(e instanceof NoActionError)) throw e;}
        }
        candidates.sort((a,b)=>b.result.plan.score-a.result.plan.score || a.t.id.localeCompare(b.t.id,'en'));
        const out: Array<ReturnType<typeof composeWithTrace>['action']> = [], recipients=new Set<string>();
        for(const {t,result} of candidates) {
          if(out.length===20) break;
          const key=recipientKey(t.merchant_id,t.customer_id);
          if(recipients.has(key) || store.isSuppressed(suppressionKey(t),at) || store.conversations.has(result.action.conversation_id)) continue;
          const m=store.getMerchant(t.merchant_id)!;
          if(m.conversation_history?.some(h=>h.from==='vera' && h.body===result.action.body && at-Date.parse(h.ts)<86400000 && at>=Date.parse(h.ts))) continue;
          recipients.add(key);
          store.markSuppressed(suppressionKey(t),t.expires_at?Date.parse(t.expires_at):at+86400000);
          store.sentEvents.add(eventKey(t));
          store.recordBotMessage(result.action.conversation_id,t.merchant_id,t.customer_id,t.id,result.action.body);
          const conv=store.getConversation(result.action.conversation_id);conv.now=now;conv.topic=result.plan.topic;
          conv.turns[0].timestamp=now;
          out.push(result.action);
        }
        return out;
      });
      return res.json({actions});
    } catch(e) {next(e);}
  });
  app.post('/v1/reply',(req,res,next)=>{
    try {validateReply(req.body);return res.json(store.transaction(()=>{
      const result=handleReply(req.body,store);
      if(result.action==='wait') (store.getConversation(req.body.conversation_id) as any).wait_seconds=result.wait_seconds;
      return result;
    }));} catch(e){next(e);}
  });
  app.post('/v1/teardown',(_req,res,next)=>{try{store.transaction(()=>store.teardown());res.json({accepted:true});}catch(e){next(e);}});
  if(process.env.ENABLE_DASHBOARD==='true') {
    app.post('/api/demo/start',(req,res,next)=>{try {
      const m=store.getMerchant(req.body.merchant_id);if(!m) throw new InputError('merchant_not_found',404);
      const cat=store.getCategory(m.category_slug);if(!cat) throw new InputError('category_not_found',404);
      const now=new Date().toISOString(),tomorrow=new Date(Date.now()+86400000).toISOString();
      const id='demo-'+randomUUID(),isCustomer=req.body.role==='customer';
      const c=isCustomer?{customer_id:id,merchant_id:m.merchant_id,identity:{name:'Demo Customer'},state:'active' as const,preferences:{channel:'whatsapp'},consent:{opted_in_at:now,scope:['appointment_reminders']}}:null;
      const t={id,scope:isCustomer?'customer' as const:'merchant' as const,kind:isCustomer?'appointment_tomorrow':'active_planning_intent',merchant_id:m.merchant_id,customer_id:c?.customer_id || null,payload:isCustomer?{appointment_time:tomorrow}:{intent_topic:'listing update'},suppression_key:id,expires_at:tomorrow};
      const r=composeWithTrace(cat,m,t,c,now);
      store.transaction(()=>{if(c)store.pushContext('customer',id,1,now,c);store.pushContext('trigger',id,1,now,t);store.recordBotMessage(r.action.conversation_id,m.merchant_id,c?.customer_id,t.id,r.action.body);const conv=store.getConversation(r.action.conversation_id);conv.now=now;conv.topic=r.plan.topic;});
      res.json({action:r.action});
    }catch(e){next(e);}});
    app.get('/api/state',(_req,res)=>res.json({uptime_seconds:store.getUptimeSeconds(),counts:store.getCounts(),categories:[...store.categories.values()].map(c=>c.payload),merchants:[...store.merchants.values()].map(c=>c.payload),triggers:[...store.triggers.values()].map(c=>c.payload),customers:[...store.customers.values()].map(c=>c.payload),conversations:[...store.conversations.values()],suppressions:[...store.firedSuppressions]}));
    app.get('/api/submission',(_req,res)=>{const p=path.resolve('challenge_pack/submission.jsonl');const items=fs.existsSync(p)?fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];res.json({count:items.length,items});});
    app.post('/api/benchmark/run',async(_req,res,next)=>{try{res.json(await runCanonicalBenchmark(new EngineStore(true)));}catch(e){next(e);}});
    app.get('/api/benchmark/latest',(_req,res)=>res.json(getLatestBenchmarkReport() || {status:'NOT_RUN'}));
    app.post('/api/run-pair',(req,res,next)=>{try{const m=store.getMerchant(req.body.merchant_id),t=store.getTrigger(req.body.trigger_id);if(!m||!t) throw new InputError('context_not_found',404);res.json(composeWithTrace(store.getCategory(m.category_slug),m,t,t.customer_id?store.getCustomer(t.customer_id):null,req.body.now));}catch(e){next(e);}});
  }
  app.use('/v1',(_req,res)=>res.status(404).json({error:'not_found'}));
  app.use('/api',(_req,res)=>res.status(404).json({error:'dashboard_disabled_or_not_found'}));
  app.use((err:any,req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const status=err instanceof InputError?err.status:err.type==='entity.too.large'?413:err instanceof SyntaxError?400:500;
    const reason=err instanceof InputError?err.reason:status===413?'payload_too_large':status===400?'invalid_json':'internal_error';
    if(status===500) console.error(JSON.stringify({event:'request_failed',path:req.path,reason:'internal_error'}));
    res.status(status).json(req.path==='/v1/context'?{accepted:false,reason,details:reason.replace(/_/g,' ')}:{error:reason});
  });
  return app;
}
