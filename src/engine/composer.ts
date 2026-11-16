import { createHash } from 'node:crypto';
import { CategoryContext, MerchantContext, TriggerContext, CustomerContext, Action } from '../types';
import { selectEvidencePlan, validateOutput, clean, EvidencePlan } from './decision';
import { getCategoryPolicy } from './categoryPolicy';
import { ObservabilityTrace } from './realization';
export interface ComposeResult {action: Action; trace: ObservabilityTrace; plan: EvidencePlan;}
export class NoActionError extends Error { constructor() {super('Insufficient permitted, actionable evidence');} }
export function composeWithTrace(category: CategoryContext | null, merchant: MerchantContext, trigger: TriggerContext, customer?: CustomerContext | null, now = '2026-04-26T10:30:00Z'): ComposeResult {
  const plan = selectEvidencePlan(category, merchant, trigger, customer, now);
  if (!plan) throw new NoActionError();
  const greeting = customer ? `${/hi|hindi/i.test(customer.identity.language_pref || '') ? 'Namaste' : 'Hi'} ${clean(customer.identity.name)}, ${clean(merchant.identity.name)} here.` : `${getCategoryPolicy(merchant.category_slug).salutation(clean(merchant.identity.owner_first_name || ''),clean(merchant.identity.name))},`;
  const parts = [greeting, plan.observation, [plan.proposal, plan.question].filter(Boolean).join(' ')];
  const body = parts.join(' ');
  const digest = createHash('sha256').update(JSON.stringify([merchant.merchant_id,customer?.customer_id || null,trigger.id])).digest('hex').slice(0,24);
  const action: Action = {
    conversation_id: `conv_${digest}`, merchant_id:merchant.merchant_id, customer_id:customer?.customer_id || null,
    trigger_id:trigger.id, send_as:customer ? 'merchant_on_behalf' : 'vera',
    template_name:'vera_context_update_v1', template_params:parts,
    body, cta:plan.cta, suppression_key:trigger.suppression_key || `${trigger.kind}:${trigger.id}`,
    rationale:plan.reason,
  };
  if (!validateOutput(action,plan,merchant,customer)) throw new NoActionError();
  return {action, plan, trace:{trigger_kind:trigger.kind,trigger_id:trigger.id,extracted_facts:plan.evidence,
    signal_class:trigger.kind, selected_signal:plan.observation,priority_score:plan.score,
    score_breakdown:{evidence:plan.evidence.length,urgency:trigger.urgency || 1,actionability:1},
    selected_action:plan.proposal || plan.question,concrete_asset:plan.topic,is_trigger_asset:true,
    composer_mode:'deterministic',grounding_pass:true,cta_pass:true,suppression_key:action.suppression_key}};
}
export function compose(category: CategoryContext | null, merchant: MerchantContext, trigger: TriggerContext, customer?: CustomerContext | null, now?: string): Action {
  return composeWithTrace(category,merchant,trigger,customer,now).action;
}
