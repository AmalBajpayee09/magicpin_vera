import { CategoryContext, MerchantContext, TriggerContext, CustomerContext, Action, MerchantOffer } from '../types';
import { validDate } from './validation';

export interface EvidencePlan {
  observation: string;
  proposal: string;
  question: string;
  cta: Action['cta'];
  reason: string;
  evidence: string[];
  score: number;
  topic: string;
}
export const clean = (s: unknown): string => typeof s === 'string' ? s.replace(/<[^>]*>/g, '').replace(/[\r\n]+/g, ' ').trim() : '';
const label = (s: unknown) => clean(s).replace(/_/g, ' ');
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const pct = (n: number) => `${Number((Math.abs(n) * 100).toFixed(1))}%`;
export const recipientKey = (m: string, c?: string | null) => JSON.stringify([m, c || null]);
export const eventKey = (t: TriggerContext) => JSON.stringify([t.merchant_id, t.customer_id || null, t.id]);
export const suppressionKey = (t: TriggerContext) => JSON.stringify([t.merchant_id, t.customer_id || null, t.suppression_key || t.id]);

export function activeOffers(m: MerchantContext, now: string): MerchantOffer[] {
  const at = Date.parse(now);
  return (m.offers || []).filter(o => {
    if (o.status !== 'active' || !clean(o.title)) return false;
    for (const key of ['valid_until','valid_from'] as const) if (o[key] && !validDate(o[key])) return false;
    if (o.valid_until && Date.parse(o.valid_until.length === 10 ? o.valid_until + 'T23:59:59Z' : o.valid_until) < at) return false;
    if (o.valid_from && Date.parse(o.valid_from) > at) return false;
    // Explicit weekday restriction wins. Canonical Tue–Thu offers also encode it in title.
    const weekday = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Kolkata',weekday:'short'}).format(at).toLowerCase();
    if (Array.isArray(o.days) && !o.days.some(d => d.toLowerCase().slice(0,3) === weekday)) return false;
    if (/tue(?:sday)?\s*[-–—]\s*thu(?:rsday)?/i.test(o.title) && !['tue','wed','thu'].includes(weekday)) return false;
    return true;
  });
}

const consentScopes: Record<string, string[]> = {
  recall_due:['recall_reminders'], appointment_tomorrow:['appointment_reminders'],
  chronic_refill_due:['refill_reminders'], wedding_package_followup:['bridal_package_followup'],
  trial_followup:['kids_program_updates','program_updates','trial_followup'],
  customer_lapsed_hard:['winback_offers'], customer_lapsed_soft:['winback_offers'],
  renewal_due:['renewal_reminders'], winback_eligible:['winback_offers'],
};
export function customerAllowed(t: TriggerContext, c: CustomerContext | null | undefined, now: string): boolean {
  if (t.scope !== 'customer') return !t.customer_id;
  if (!c || c.customer_id !== t.customer_id || c.merchant_id !== t.merchant_id) return false;
  if (c.preferences?.channel !== 'whatsapp' || c.preferences?.reminder_opt_in === false || c.preferences?.opted_in === false) return false;
  const consent = c.consent;
  if (!consent || !consent.opted_in_at || !validDate(consent.opted_in_at) || Date.parse(consent.opted_in_at) > Date.parse(now) || consent.revoked_at || consent.opted_out) return false;
  if (!consentScopes[t.kind]?.some(scope => consent.scope.includes(scope))) return false;
  if (t.kind.startsWith('customer_lapsed') && !['lapsed_soft','lapsed_hard','churned'].includes(c.state || '')) return false;
  return true;
}

/** Facts become a plan before prose is rendered. Missing evidence is an actual no-action. */
export function selectEvidencePlan(cat: CategoryContext | null, m: MerchantContext, t: TriggerContext, c?: CustomerContext | null, now = '2026-04-26T10:30:00Z'): EvidencePlan | null {
  if (!cat || cat.slug !== m.category_slug || t.merchant_id !== m.merchant_id || !customerAllowed(t,c,now)) return null;
  const p = t.payload || {}, k = t.kind, perf = m.performance || {};
  if (p.placeholder === true) return null;
  if (p.category && p.category !== cat.slug) return null;
  if (k === 'chronic_refill_due' && cat.slug !== 'pharmacies') return null;
  if (k === 'recall_due' && !['dentists','pharmacies'].includes(cat.slug)) return null;
  const offer = activeOffers(m, now)[0];
  const asset = offer ? `the active ${clean(offer.title)} offer` : '';
  const plan = (observation: string, proposal: string, question: string, score: number, topic = k, cta: Action['cta'] = 'binary_yes_no'): EvidencePlan => ({
    observation, proposal, question, score: score + (t.urgency || 1), topic, cta,
    reason: `${k}: ${observation} Proposed next step: ${proposal || question}`,
    evidence: [observation, ...(offer ? [clean(offer.title)] : [])],
  });
  if (t.scope === 'customer') {
    if (!c) return null;
    const prefix = c.state === 'new' ? 'Thanks for trying us.' : c.state === 'churned' ? 'You are welcome back whenever it suits you.' : '';
    if (k === 'appointment_tomorrow') {
      const time = clean(p.appointment_time || p.appointment_time_iso);
      if (!time) return null;
      if (validDate(time, true) && Date.parse(time) < Date.parse(now)) return null;
      return plan(`Your ${label(p.service) || 'appointment'} is listed for ${time}.`, '', 'Reply YES to confirm or CANCEL to request a change.', 85, k, 'binary_confirm_cancel');
    }
    if (k === 'recall_due') {
      if (!clean(p.service_due) || !validDate(p.due_date) || Date.parse(p.due_date)-Date.parse(now)>30*86400000 || (validDate(p.last_service_date) && Date.parse(p.last_service_date)>Date.parse(now))) return null;
      const slots = Array.isArray(p.available_slots) ? p.available_slots.filter((s: any) => validDate(s?.iso,true) && Date.parse(s.iso) >= Date.parse(now) && clean(s.label)) : [];
      const options = slots.slice(0,2).map((s: any) => clean(s.label)).join(' or ');
      return plan(`Your ${label(p.service_due)} reminder is due ${p.due_date}.`, options ? `Available options: ${options}.` : '', options ? 'Which option would you prefer? Availability needs confirmation.' : 'Would you like the clinic to check a suitable time?', 80, k, options ? 'multi_choice_slot' : 'binary_yes_no');
    }
    if (k === 'chronic_refill_due') {
      if (!validDate(p.stock_runs_out_iso,true) || !Array.isArray(p.molecule_list) || !p.molecule_list.length) return null;
      // Keep medication details out of outbound WhatsApp copy; use only timing.
      return plan(`Your recorded refill window ends ${p.stock_runs_out_iso.slice(0,10)}.`, 'The pharmacist can check your existing prescription and stock.', 'Would you like a refill availability check?', 86);
    }
    if (k === 'wedding_package_followup') {
      if (!validDate(p.wedding_date) || Date.parse(p.wedding_date + 'T23:59:59Z') < Date.parse(now)) return null;
      return plan(`${prefix} Following up on your bridal trial for the wedding on ${p.wedding_date}.`.trim(), '', 'Would you like to discuss the next preparation step?', 65);
    }
    if (k === 'trial_followup') {
      if (!validDate(p.trial_date)) return null;
      const opts = Array.isArray(p.next_session_options) ? p.next_session_options.filter((s: any) => validDate(s?.iso,true) && Date.parse(s.iso) >= Date.parse(now)) : [];
      return plan(`Following up on your trial on ${p.trial_date}.`, opts.length ? `A listed next session is ${clean(opts[0].label) || opts[0].iso}.` : '', 'Would you like us to check the next session for you?', 65);
    }
    if (k.includes('lapsed') || k === 'winback_eligible') {
      const days = finite(p.days_since_last_visit) ? `${p.days_since_last_visit} days since your last visit.` : 'We have not seen you for a while.';
      return plan(`${prefix} ${days}`.trim(), offer ? `An option if useful: ${clean(offer.title)}.` : '', c.state === 'lapsed_soft' ? 'Would you like help planning your next visit?' : 'Would you like to discuss a comfortable way to return?', 60);
    }
    if (k === 'renewal_due' && finite(p.days_remaining)) return plan(`Your membership has ${p.days_remaining} days remaining.`, '', 'Would you like the renewal details?', 70);
    return null;
  }
  if (k === 'supply_alert') {
    if (cat.slug !== 'pharmacies' || !clean(p.molecule) || !clean(p.manufacturer) || !Array.isArray(p.affected_batches) || !p.affected_batches.length || !p.affected_batches.every((v: any) => typeof v === 'string')) return null;
    return plan(`Supplied recall alert: ${clean(p.molecule)}, ${clean(p.manufacturer)}, batches ${p.affected_batches.map(clean).join(', ')}.`, 'Check these exact batches against the official notice before taking stock action.', 'Shall I format a batch-check checklist?', 100);
  }
  const digestId = p.top_item_id || p.digest_item_id || p.alert_id;
  if (digestId || ['research_digest','regulation_change','cde_opportunity'].includes(k)) {
    const item = digestId ? cat.digest?.find(d => d.id === digestId) : p.top_item;
    if (!item || !clean(item.title) || !clean(item.source)) return null;
    const deadline = validDate(p.deadline_iso) ? ` Deadline supplied: ${p.deadline_iso}.` : '';
    return plan(`${clean(item.source)}: “${clean(item.title)}”.${deadline}`, '', k === 'regulation_change' ? 'Shall I turn this notice into a review checklist?' : 'Shall I share a source-attributed summary for your review?', k === 'regulation_change' ? 95 : 64, clean(item.title));
  }
  if (k === 'active_planning_intent' || clean(p.intent_topic)) {
    const topic = label(p.intent_topic || p.topic);
    if (!topic) return null;
    const suggestion = /thali|corporate|bulk/i.test(topic)
      ? 'Proposed outline: menu, order minimum, delivery window and billing terms; pricing needs your approval.'
      : /kids|yoga/i.test(topic) ? 'Proposed outline: age groups, session schedule and guardian consent; capacity and fees need your approval.'
      : 'Proposed outline: audience, service details and availability; commercial terms need your approval.';
    return plan(`Continuing your ${topic} plan.`, suggestion, 'Shall I draft the announcement for review?', 90, topic);
  }
  if (['perf_dip','seasonal_perf_dip','perf_spike'].includes(k)) {
    const metric = clean(p.metric);
    if (!['calls','views','directions','ctr'].includes(metric)) return null;
    const liveDelta = perf.delta_7d?.[`${metric}_pct`];
    const delta = finite(liveDelta) ? liveDelta : p.delta_pct;
    if (!finite(delta) || delta === 0 || (k.includes('dip') && delta > 0) || (k === 'perf_spike' && delta < 0)) return null;
    let obs = `${metric} ${delta < 0 ? 'down' : 'up'} ${pct(delta)}${finite(liveDelta) ? ' in the current 7-day snapshot' : clean(p.window) ? ` over ${clean(p.window)}` : ''}.`;
    let proposal = asset ? `We could review how ${asset} is presented.` : 'We could review the listing and enquiry follow-up.';
    if (finite(perf.ctr) && finite(cat.peer_stats?.avg_ctr)) {
      obs += ` CTR ${pct(perf.ctr)} versus category peer average ${pct(cat.peer_stats.avg_ctr)}.`;
      if (perf.ctr >= cat.peer_stats.avg_ctr && delta < 0) proposal = 'CTR is above the peer average; review retention before changing acquisition spend.';
    }
    if (k === 'seasonal_perf_dip' && p.is_expected_seasonal === true) proposal += ' The trigger marks this as an expected seasonal dip.';
    return plan(obs, proposal, 'Shall I draft a focused review plan?', 75);
  }
  if (k === 'renewal_due') {
    const sub = m.subscription;
    if (!sub || !finite(sub.days_remaining) || sub.status === 'expired') return null;
    return plan(`${clean(sub.plan)} subscription: ${sub.days_remaining} days remaining.`, '', 'Would you like a renewal and listing-status review?', 72);
  }
  if (k === 'gbp_unverified') {
    if (m.identity.verified !== false) return null;
    return plan('Your Google Business Profile is marked unverified.', 'Verification should be completed before relying on listing visibility.', 'Would you like a verification checklist?', 78);
  }
  if (k === 'review_theme_emerged' && clean(p.theme) && finite(p.occurrences_30d)) {
    return plan(`${p.occurrences_30d} reviews in 30 days mention ${label(p.theme)}.`, /late|wait|delay/i.test(p.theme) ? 'Review the service bottleneck before promoting more demand.' : 'We could reflect this feedback in a listing update.', 'Shall I draft a focused response plan?', 82);
  }
  if (k === 'milestone_reached' && finite(p.value_now) && finite(p.milestone_value) && clean(p.metric)) {
    return plan(`${label(p.metric)} stands at ${p.value_now}; ${p.value_now < p.milestone_value ? 'approaching' : 'reached'} the ${p.milestone_value} milestone.`, 'Invite honest feedback from recent customers without incentives.', 'Would you like a review-request draft?', 50);
  }
  if (k === 'curious_ask_due') {
    const count = finite(perf.calls) ? `${perf.calls} calls` : finite(perf.views) ? `${perf.views} views` : '';
    return count ? plan(`Your latest${finite(perf.window_days) ? ` ${perf.window_days}-day` : ''} snapshot shows ${count}.`, '', 'Which service is getting the most enquiries this week?', 30, k, 'open_ended') : null;
  }
  if (k === 'winback_eligible' && m.subscription?.status === 'expired' && finite(p.days_since_expiry)) {
    return plan(`Your subscription expired ${p.days_since_expiry} days ago.`, 'We can review listing readiness and returning-customer outreach before a new campaign.', 'Would you like a restart checklist?', 48);
  }
  if (k === 'dormant_with_vera' && finite(p.days_since_last_merchant_message)) {
    return plan(`It has been ${p.days_since_last_merchant_message} days since your last message to VERA.`, '', 'What would be most useful to work on next?', 20, k, 'open_ended');
  }
  if (k === 'competitor_opened' && clean(p.competitor_name)) {
    return plan(`The supplied update lists ${clean(p.competitor_name)}${finite(p.distance_km) ? ` at ${p.distance_km} km` : ''}.`, 'We can clarify what makes your service distinctive without copying their prices.', 'Shall I draft a differentiation post?', 55);
  }
  if (k === 'category_seasonal' && clean(p.season) && Array.isArray(p.trends) && p.trends.length) {
    return plan(`Supplied ${label(p.season)} trends: ${p.trends.map(label).join('; ')}.`, cat.slug === 'pharmacies' ? 'Review stock readiness; this is not a medication recommendation.' : 'Review how your current services match this demand.', 'Would you like a readiness checklist?', 55);
  }
  const event = clean(p.event_name || p.festival || p.match);
  if (event) {
    if (finite(p.days_until) && (p.days_until > 30 || p.days_until < 0)) return null;
    const date = p.date || p.match_time_iso;
    if (date && (!validDate(date) || Date.parse(date.length === 10 ? date+'T23:59:59Z' : date) < Date.parse(now))) return null;
    return plan(`${event}${date ? ` is listed for ${date}` : ' appears in the supplied local update'}.`, asset ? `We could feature ${asset}, subject to its terms.` : 'We can outline an event-specific message after checking availability.', 'Would you like a draft to review?', 60, event);
  }
  // Unseen kinds are supported through explicit evidence, never guessed from their names.
  if (finite(p.open_slots_count) && p.open_slots_count > 0 && clean(p.time_window)) return plan(`${p.open_slots_count} open slots are listed for ${clean(p.time_window)}.`, 'Offer the openings to eligible regulars after confirming availability.', 'Shall I draft an opening notice?', 84);
  if (clean(p.competitor_name)) return plan(`Supplied competitor update: ${clean(p.competitor_name)}.`, 'Review your differentiation before changing prices.', 'Would you like a comparison checklist?', 54);
  if (clean(p.service) && finite(p.search_volume_pct)) return plan(`Supplied search movement for ${clean(p.service)}: ${p.search_volume_pct}%.`, 'Check service availability before promoting it.', 'Shall I draft a service-interest post?', 70);
  if (clean(p.weather_alert) && finite(p.temperature_c)) return plan(`Supplied weather update: ${clean(p.weather_alert)}, ${p.temperature_c}°C.`, 'Check opening hours and service availability before customer outreach.', 'Would you like a service-status note?', 68);
  if (clean(p.item) && clean(p.shelf_life)) return plan(`Stock update: ${clean(p.item)}, stated shelf life ${clean(p.shelf_life)}.`, 'Confirm stock quality and availability before any promotion.', 'Would you like a stock-review checklist?', 82);
  return null;
}

export function validateOutput(action: Action, plan: EvidencePlan, m: MerchantContext, c?: CustomerContext | null): boolean {
  if (!action.body || action.body.length > 2400 || action.body.includes('<') || action.body.includes('>')) return false;
  if (/\b(guaranteed|miracle|100% safe|cures? disease)\b/i.test(action.body)) return false;
  const nums = (v: string) => v.match(/\d+(?:[.,]\d+)*/g) || [];
  const allowed = new Set(nums([...plan.evidence, plan.proposal, plan.question, m.identity.name, c?.identity.name || ''].join(' ')));
  if (nums(action.body).some(n => !allowed.has(n))) return false;
  return (action.body.match(/\?/g) || []).length <= 1 && action.send_as === (c ? 'merchant_on_behalf' : 'vera');
}
