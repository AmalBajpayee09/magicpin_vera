import { ReplyRequest, ReplyResponse, MerchantContext } from '../types';
import { engineStore, EngineStore } from './store';
import { activeOffers, clean, recipientKey, selectEvidencePlan } from './decision';
import { InputError } from './validation';

const AUTO = /thank(?:s| you) for contacting|our team will respond|will get back to you|we have received|auto.?reply|automated|out of (?:the )?office|currently (?:away|unavailable)|outside (?:business|working) hours|on (?:leave|holiday|vacation)/i;
const REFUSAL = /\b(no|nope|not interested|don't|do not|not now|nahi|nahin|nahi chahiye)\b/i;
const OPTOUT = /\b(stop|unsubscribe|do not contact|don't contact|stop messaging|stop contacting|band karo|mat bhejo)\b/i;
const ABUSE = /\b(stupid|idiot|rubbish|bakwas|useless spam|fuck)\b/i;
const COMMIT = /\b(yes|yeah|sure|agreed|confirm|proceed|go ahead|do it|let'?s do it|sounds good|haan|bilkul|send it|draft it|start karo)\b/i;
const OFFTOPIC = /\b(gst|tax|loan|legal|insurance|weather forecast|cricket score)\b/i;

const DETAILS = /\b(what|how|why|which|explain|details|summary|abstract|plan|checklist|steps|show me|send me|price|cost)\b/i;

/** Advice is phrased as checks, not claims that an audit or external update happened. */
function performanceReviewSteps(merchant: MerchantContext, metric: string, message: string): string {
  if (/phone|call button/i.test(message) && /how|test|check/i.test(message)) {
    return 'Open your public listing on a phone. Tap the call button, confirm it dials your published business number, and place a test call during your listed opening hours. If it fails, check the number and receiving phone before changing the listing. Does the call reach the business?';
  }
  const listingChecks: Record<string,string> = {
    restaurants:'the menu, current prices and ordering link',
    dentists:'the appointment contact, listed services and booking link',
    salons:'the service list, current prices and booking link',
    gyms:'the class schedule, membership information and enquiry link',
    pharmacies:'the delivery information and pharmacist contact details',
  };
  const listing = listingChecks[merchant.category_slug] || 'the service information and enquiry link';
  const period = 'the same period as the reported change';
  const followup = metric === 'calls'
    ? `Then review missed calls and enquiry response times for ${period}; this helps separate contact problems from reduced demand.`
    : `Then compare listing views and enquiries for ${period} before deciding what to change.`;
  return `Start with the contact path: open your public listing and test the phone number, call button and opening hours. Next, check ${listing} for accuracy. ${followup} Does the call button currently reach your business?`;
}


/** Fill-in planning drafts keep unknown commercial terms explicit. */
function planningOutline(merchant: MerchantContext, topic: string): string {
  const name=clean(merchant.identity.name);
  if (merchant.category_slug==='restaurants' && /bulk|thali|corporate|lunch/i.test(topic)) {
    return `Working outline for ${name}: Audience: office or group orders, to confirm. Menu: [approved thali items and portions]. Order terms: [minimum quantity and lead time]. Fulfilment: [delivery area or pickup, date and time window]. Billing: [price per meal, applicable charges and payment terms]. Customer draft: “For your next group meal, contact ${name} to discuss the menu, quantity and fulfilment options.” Keep this draft internal until the bracketed terms are confirmed. Which menu items should the package include?`;
  }
  if (merchant.category_slug==='salons' && /bridal|wedding/i.test(topic)) {
    return `Working bridal-package outline for ${name}: Audience: bridal enquiries. Services: [merchant-approved services and inclusions]. Consultation or trial: [whether available and what it includes]. Schedule: [appointment duration and available dates]. Terms: [price, deposit and change policy]. Customer draft: “For bridal service enquiries, contact ${name} to discuss your preferred services and dates.” Keep this draft internal until the bracketed details are confirmed. Which services should the package include?`;
  }
  if (merchant.category_slug==='gyms' && /kids|yoga|camp/i.test(topic)) {
    return `Working programme outline for ${name}: Participants: [age groups]. Sessions: [activities, timetable and instructor availability]. Safeguards: [guardian consent and supervision arrangements]. Enrolment: [capacity, fees and contact route]. These are fields to confirm before announcing the programme. Which age group should this programme serve?`;
  }
  return `Working outline for ${name}: Topic: ${topic}. Audience: [intended participants]. Details: [approved services or content]. Availability: [dates, capacity and contact route]. Terms: [pricing and conditions, if applicable]. Keep this internal until the missing fields are confirmed. Which service or activity should lead the outline?`;
}

/** Replay cache is committed with the conversation, so a retry cannot append another turn. */
export function handleReply(req: ReplyRequest, store: EngineStore = engineStore): ReplyResponse {
  const conv = store.conversations.get(req.conversation_id);
  if (!conv) throw new InputError('unknown_conversation',404);
  if (conv.merchant_id !== req.merchant_id || (conv.customer_id || null) !== (req.customer_id || null) || req.from_role !== (conv.customer_id ? 'customer' : 'merchant')) throw new InputError('conversation_identity_mismatch',409);
  const cacheKey = JSON.stringify([req.conversation_id,req.turn_number]);
  const signature = JSON.stringify([req.merchant_id,req.customer_id || null,req.from_role,req.message,req.received_at]);
  const cached = store.replyCache.get(cacheKey);
  if (cached) {
    if (cached.request !== signature) throw new InputError('reply_turn_conflict',409);
    return cached.response;
  }
  if (req.turn_number <= (conv.last_reply_turn || 0)) throw new InputError('stale_reply_turn',409);
  if (conv.now && Date.parse(req.received_at) < Date.parse(conv.now)) throw new InputError('stale_reply_time',409);
  conv.last_reply_turn = req.turn_number;
  conv.now = req.received_at;
  conv.turns.push({turn_number:req.turn_number,from:req.from_role,message:req.message,timestamp:req.received_at});
  const msg = req.message.trim();
  const merchant = store.getMerchant(req.merchant_id);
  const trigger = conv.trigger_id ? store.getTrigger(conv.trigger_id) : null;
  const category = merchant ? store.getCategory(merchant.category_slug) : null;
  const customer = conv.customer_id ? store.getCustomer(conv.customer_id) : null;
  const send = (body: string, rationale: string): ReplyResponse => ({action:'send',body,cta:'open_ended',rationale});
  let out: ReplyResponse;
  const optedOut = OPTOUT.test(msg);
  if (optedOut) {
    store.optedOut.add(recipientKey(req.merchant_id,req.customer_id)); conv.status = 'ended';
    out = {action:'end',rationale:'Recipient opted out. Future proactive messages to this recipient are suppressed.'};
  } else if (conv.status === 'ended') {
    out = {action:'end',rationale:'Conversation has already ended.'};
  } else if (/\b(?:I )?(?:don'?t|do not) understand\b/i.test(msg)) {
    out = send('Which part of the proposal would you like me to explain?', 'Treat confusion as a clarification request rather than a refusal.');
  } else if (REFUSAL.test(msg) && !/\bno (?:problem|worries|issue)\b/i.test(msg)) {
    conv.status = 'ended';
    out = {action:'end',rationale:'Recipient declined this proposal; no further pitch in this conversation.'};
  } else if (ABUSE.test(msg)) {
    out = send('I can help with listing updates and customer engagement. We can pause here if this is not useful.', 'De-escalating without making another sales pitch.');
  } else if (AUTO.test(msg)) {
    conv.auto_reply_count++;
    out = conv.auto_reply_count >= 2 || conv.last_auto_reply_msg === msg.toLowerCase()
      ? {action:'end',rationale:'Repeated automated reply; exiting the loop.'}
      : {action:'wait',wait_seconds:1800,rationale:'Automated reply detected; wait for a human.'};
    conv.last_auto_reply_msg = msg.toLowerCase();
  } else if (OFFTOPIC.test(msg)) {
    out = send('I can help with your listing and customer engagement. That request needs the appropriate professional or service. We can pause this conversation here.', 'Redirecting an unrelated request without claiming expertise or execution.');
  } else if (/\b(later|busy|tomorrow|give me time|next week|not today)\b/i.test(msg)) {
    out = {action:'wait',wait_seconds:/next week/i.test(msg)?604800:/tomorrow/i.test(msg)?86400:1800,rationale:'Recipient asked for time; backing off.'};
  } else if (req.from_role === 'customer') {
    if (/\b(cancel|reschedule)\b/i.test(msg)) out = send('Please contact the business to arrange the change. No booking has been modified by this bot.', 'No booking integration is available; avoid inventing a cancellation.');
    else if (trigger?.kind === 'chronic_refill_due') {
      const name=clean(merchant?.identity.name) || 'the pharmacy';
      out=send(`Your request for a refill availability check is recorded in this conversation. Contact ${name} directly and ask the pharmacist to review your existing prescription and confirm stock and collection options. VERA cannot check live stock or notify the pharmacy; availability has not been confirmed.`, 'Provide a refill-specific handoff without disclosing medication details or inventing stock checks, bookings or notifications.');
    } else if (trigger?.kind === 'appointment_tomorrow' && /\b(when|what time|which time|appointment time)\b/i.test(msg)) {
      const listedTime=clean(trigger.payload?.appointment_time || trigger.payload?.appointment_time_iso);
      out=send(listedTime ? `Your appointment is listed for ${listedTime}. Contact ${clean(merchant?.identity.name) || 'the business'} directly if you need to check or change these details.` : 'The current context does not specify an appointment time. Please contact the business to check it.', 'Answer the appointment-time question without treating it as customer confirmation.');
    } else if (trigger?.kind === 'appointment_tomorrow' && COMMIT.test(msg) && !DETAILS.test(msg) && !msg.includes('?')) {
      const service=clean(trigger.payload?.service);
      const listedTime=clean(trigger.payload?.appointment_time || trigger.payload?.appointment_time_iso);
      const appointment=service && service!=='appointment' ? `${service} appointment` : 'appointment';
      out=send(`Thanks, your confirmation for the listed ${appointment}${listedTime ? ` on ${listedTime}` : ''} has been recorded in this conversation. For changes, contact ${clean(merchant?.identity.name) || 'the business'} directly.`, 'The customer confirmed an appointment already present in the reminder context. The reply is recorded locally; no booking-system update or business notification is claimed.');
    } else if (COMMIT.test(msg) || /\b(book|slot|appointment)\b/i.test(msg)) out = send('Thanks for your preference. Please contact the business to verify availability and complete the booking; no slot is reserved yet.', 'Customer interest acknowledged without fabricating a reservation.');
    else out = send('The business can confirm the details directly. What would you like clarified about this reminder?', 'Customer-facing clarification, without campaign upselling.');
  } else if (/how many|reach|audience size/i.test(msg)) {
    const p = trigger?.payload || {};
    const count = [p.reach,p.audience_size,p.customer_count,p.target_count].find(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
    out = send(count === undefined ? 'No eligible audience count is supplied. A total customer count does not establish permission to contact them. Shall we define the permitted audience first?' : `The supplied target count is ${count}; this is not a guaranteed delivery count. Shall we review the eligible audience?`, 'Audience figures are reported only when explicitly supplied; aggregate totals are not inferred reach.');
  } else if (/\b(instead|change (?:the|our|my)|rather than)\b/i.test(msg)) {
    conv.requested_topic=clean(msg).slice(0,500);conv.draft=undefined;conv.draft_approved=false;conv.topic='the revised brief';
    out=send(`Revised brief recorded: “${conv.requested_topic}”. Proposed outline: audience, service details and availability, with pricing subject to your approval. Shall I draft that revised version?`, 'Recognize an explicit intent change and retire the previous draft.');
  } else if (COMMIT.test(msg) || DETAILS.test(msg)) {
    const plan = merchant && trigger && (!trigger.expires_at || Date.parse(trigger.expires_at)>Date.parse(req.received_at)) ? selectEvidencePlan(category,merchant,trigger,customer,req.received_at) : null;
    if (!plan || !merchant || !trigger) out = send('The context for the original proposal is no longer sufficient. Let us pause until its details are updated.', 'Re-evaluating against current context instead of reusing a stale offer.');
    else if (conv.draft && COMMIT.test(msg) && !DETAILS.test(msg) && !msg.includes('?') && !/change|adjust|instead|rather|but/i.test(msg)) {
      conv.draft_approved = true;
      out = send('Draft approved in this conversation. It has not been published or sent to customers; the business must verify consent and dispatch it through its own channel.', 'Advance from drafting to approval without claiming an external side effect.');
    } else if (!conv.requested_topic && merchant.category_slug === 'gyms' && trigger.kind === 'seasonal_perf_dip') {
      const details=`Retention review plan: ${plan.observation} First, compare recent attendance and renewals with the same period as the reported change; the supplied calls and CTR alone do not establish member churn. Next, identify members whose usual visits have reduced, using only records the business is permitted to use. Review whether class timings or membership questions are creating barriers. For members with permission for this purpose and channel, draft a personal check-in asking what would help them return; do not add an unapproved discount. Track replies, return visits and renewals before deciding whether to change acquisition spend. Which attendance or renewal records can you review first?`;
      conv.draft=details;
      out=send(details,'Deliver the requested retention review, distinguish acquisition metrics from churn evidence, and require recipient permission before any proposed outreach.');
    } else if (!conv.requested_topic && ['perf_dip','seasonal_perf_dip','perf_spike'].includes(trigger.kind)) {
      const details=performanceReviewSteps(merchant, clean(trigger.payload?.metric), msg);
      conv.draft=details;
      out=send(details, 'Answers the merchant request with a category-relevant diagnostic sequence. These are proposed checks; no audit, listing update or campaign execution is claimed.');
    } else if (!conv.requested_topic && trigger.kind === 'active_planning_intent') {
      const details=planningOutline(merchant,clean(trigger.payload?.intent_topic) || 'the proposed activity');
      conv.draft=details;
      out=send(details,'Deliver a fill-in planning outline and draft; bracketed terms require merchant confirmation before use.');
    } else if (!conv.requested_topic && trigger.kind === 'supply_alert' && merchant.category_slug === 'pharmacies') {
      const details=`Batch-check worksheet for review. Supplied alert details: ${plan.observation} First, obtain the official notice and verify its source, product, manufacturer and exact batch identifiers against the supplied alert. Next, compare the labels on stock with those identifiers and record matches, quantities and any discrepancies. Then have the responsible pharmacist verify the notice instructions and document the action taken through the business's own process. No notice has been verified or stock action taken by VERA. Do you have the official notice available for the comparison?`;
      conv.draft=details;
      out=send(details,'Deliver a verification worksheet retaining the supplied batch identifiers; no regulatory source, clinical consequence or completed action is invented.');
    } else {
      const offer = activeOffers(merchant, req.received_at)[0];
      const isCampaign = /planning|festival|winback|lapsed|curious|ipl|competitor|dormant/.test(trigger.kind);
      const details = conv.requested_topic ? `Proposed revised draft for ${clean(merchant.identity.name)}: “${conv.requested_topic}”. Confirm the service wording, availability and terms before publication.` : trigger.kind === 'active_planning_intent'
        ? `${plan.observation} ${plan.proposal}`
        : isCampaign && offer ? `Draft for ${clean(merchant.identity.name)}: “${clean(offer.title)}. Contact us to check availability and terms.”`
        : `${plan.observation} ${plan.proposal}`.trim();
      const adjustment = /change|adjust|instead|rather|but/i.test(msg) ? ' I have noted your requested change; please confirm the exact replacement wording before approval.' : '';
      conv.draft = details;
      out = send(`${details}${adjustment} This is for review; nothing has been dispatched.`, 'Deliver the grounded draft or source summary immediately; no new qualification loop.');
    }
  } else {
    out = send(`What would you like to change about ${clean(conv.topic) || 'the proposal'}?`, 'Clarify the requested change using the current conversation topic.');
  }
  if (!AUTO.test(msg)) conv.auto_reply_count = 0;
  if (out.action === 'send' && conv.turns.some(t => t.from === 'vera' && t.message === out.body)) out = {action:'end',rationale:'No new useful information; avoid repeating the same response.'};
  if (out.action === 'end') conv.status = 'ended';
  if (out.action === 'wait') conv.status = 'waiting';
  if (out.action === 'send') {
    conv.status = 'active';
    conv.turns.push({turn_number:req.turn_number+1,from:'vera',message:out.body!,timestamp:req.received_at});
  }
  store.replyCache.set(cacheKey,{request:signature,response:out});
  return out;
}
