export const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export function validDate(v: unknown, timestamp = false): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v) || !Number.isFinite(Date.parse(v))) return false;
  const day = v.slice(0, 10);
  if (new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) return false;
  return !timestamp || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v);
}
export class InputError extends Error {
  constructor(public reason: string, public status = 400) { super(reason); }
}
const need = (ok: unknown, reason: string) => { if (!ok) throw new InputError(reason); };
function finiteTree(v: any, depth = 0): void {
  need(depth <= 24, 'context_too_deep');
  if (typeof v === 'number') need(Number.isFinite(v), 'invalid_number');
  if (v && typeof v === 'object') for (const [key, value] of Object.entries(v)) {
    need(!['__proto__', 'constructor', 'prototype'].includes(key), 'invalid_key');
    finiteTree(value, depth + 1);
  }
}
export function validateContext(b: any): void {
  need(object(b), 'invalid_body');
  need(['category', 'merchant', 'customer', 'trigger'].includes(b.scope), 'invalid_scope');
  need(text(b.context_id) && b.context_id.length <= 256, 'invalid_context_id');
  need(Number.isSafeInteger(b.version) && b.version >= 1, 'invalid_version');
  need(validDate(b.delivered_at, true), 'invalid_delivered_at');
  need(object(b.payload), 'invalid_payload'); finiteTree(b.payload);
  const p = b.payload;
  const idKey = {category:'slug',merchant:'merchant_id',customer:'customer_id',trigger:'id'}[b.scope];
  need(p[idKey] === b.context_id, 'identity_mismatch');
  if (b.scope === 'category') {
    need(object(p.voice) && text(p.voice.tone), 'invalid_voice');
    if (p.digest !== undefined) need(Array.isArray(p.digest) && p.digest.every((d: any) => object(d) && text(d.id) && text(d.title) && text(d.source)), 'invalid_digest');
  }
  if (['merchant', 'customer'].includes(b.scope)) need(object(p.identity) && text(p.identity.name), 'invalid_identity');
  if (b.scope === 'merchant') {
    need(text(p.category_slug), 'invalid_category_slug');
    if (p.offers !== undefined) need(Array.isArray(p.offers) && p.offers.every((o: any) => object(o) && text(o.title) && text(o.status)), 'invalid_offers');
    if (p.performance !== undefined) {
      need(object(p.performance), 'invalid_performance');
      for (const key of ['views','calls','ctr','directions','window_days']) if (p.performance[key] !== undefined) need(typeof p.performance[key] === 'number' && p.performance[key] >= 0, 'invalid_metric');
      if (p.performance.delta_7d !== undefined) {
        need(object(p.performance.delta_7d), 'invalid_delta');
        for (const value of Object.values(p.performance.delta_7d)) need(typeof value === 'number', 'invalid_delta');
      }
    }
    if (p.conversation_history !== undefined) need(Array.isArray(p.conversation_history) && p.conversation_history.every((t: any) => object(t) && text(t.body) && text(t.from) && validDate(t.ts, true)), 'invalid_history');
  }
  if (b.scope === 'customer') {
    need(text(p.merchant_id), 'invalid_merchant_id');
    if (p.state !== undefined) need(['new','active','lapsed_soft','lapsed_hard','churned'].includes(p.state), 'invalid_customer_state');
    if (p.consent !== undefined) need(object(p.consent) && Array.isArray(p.consent.scope) && p.consent.scope.every(text) && (p.consent.opted_in_at == null || validDate(p.consent.opted_in_at)), 'invalid_consent');
  }
  if (b.scope === 'trigger') {
    need(['merchant','customer'].includes(p.scope), 'invalid_trigger_scope');
    need(text(p.kind) && text(p.merchant_id) && object(p.payload), 'invalid_trigger');
    if (p.scope === 'customer') need(text(p.customer_id), 'invalid_customer_id');
    if (p.scope === 'merchant') need(p.customer_id == null, 'invalid_customer_id');
    if (p.expires_at !== undefined) need(validDate(p.expires_at, true), 'invalid_expires_at');
    if (p.urgency !== undefined) need(Number.isInteger(p.urgency) && p.urgency >= 1 && p.urgency <= 5, 'invalid_urgency');
  }
  for (const key of ['preferences','relationship','subscription','peer_stats']) if (p[key] !== undefined) need(object(p[key]), 'invalid_' + key);
  if (p.signals !== undefined) need(Array.isArray(p.signals) && p.signals.every(text), 'invalid_signals');
  if (p.review_themes !== undefined) need(Array.isArray(p.review_themes) && p.review_themes.every(object), 'invalid_review_themes');
}
export function validateTick(b: any): void {
  need(object(b) && validDate(b.now, true), 'invalid_now');
  need(Array.isArray(b.available_triggers) && b.available_triggers.length <= 1000 && b.available_triggers.every(text), 'invalid_available_triggers');
}
export function validateReply(b: any): void {
  need(object(b), 'invalid_body');
  need(text(b.conversation_id) && text(b.merchant_id), 'invalid_identity');
  need(['merchant','customer'].includes(b.from_role), 'invalid_from_role');
  need(text(b.message) && b.message.length <= 10000, 'invalid_message');
  need(validDate(b.received_at, true), 'invalid_received_at');
  need(Number.isSafeInteger(b.turn_number) && b.turn_number >= 2, 'invalid_turn_number');
  if (b.from_role === 'customer') need(text(b.customer_id), 'invalid_customer_id');
}
