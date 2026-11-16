export type ContextScope = 'category' | 'merchant' | 'trigger' | 'customer';

export interface CategoryContext {
  slug: string;
  voice: {
    tone: string;
    vocab_taboo?: string[];
    taboos?: string[];
    salutation_style?: string;
  };
  offer_catalog?: Array<{
    id: string;
    title: string;
    value?: string;
    audience?: string;
    type?: string;
  }>;
  peer_stats?: {
    avg_rating?: number;
    avg_ctr?: number;
    median_views_30d?: number;
    median_calls_30d?: number;
  };
  digest?: Array<{
    id: string;
    kind: string;
    title: string;
    source: string;
    trial_n?: number;
    patient_segment?: string;
    summary?: string;
    actionable?: string;
  }>;
  patient_content_library?: any[];
  seasonal_beats?: any[];
  trend_signals?: any[];
}

export interface MerchantIdentity {
  name: string;
  city?: string;
  locality?: string;
  verified?: boolean;
  languages?: string[];
  owner_first_name?: string;
  category_slug?: string;
}

export interface MerchantPerformance {
  window_days?: number;
  views?: number;
  calls?: number;
  directions?: number;
  ctr?: number;
  delta_7d?: {
    views_pct?: number;
    calls_pct?: number;
  };
}

export interface MerchantOffer {
  id: string;
  title: string;
  status: string;
  valid_until?: string;
  valid_from?: string;
  days?: string[];
  price?: number;
  discount_pct?: number;
}

export interface MerchantContext {
  merchant_id: string;
  category_slug: string;
  identity: MerchantIdentity;
  subscription?: {
    status: string;
    plan: string;
    days_remaining: number;
  };
  performance?: MerchantPerformance;
  offers?: MerchantOffer[];
  conversation_history?: Array<{ts: string; from: string; body: string; engagement?: string}>;
  customer_aggregate?: {
    total_unique_ytd?: number;
    lapsed_180d_plus?: number;
    lapsed_90d_plus?: number;
    retention_6mo_pct?: number;
    retention_3mo_pct?: number;
    high_risk_adult_count?: number;
    chronic_rx_count?: number;
  };
  signals?: string[];
  review_themes?: Array<{
    theme: string;
    occurrences_30d: number;
    sentiment: string;
  }>;
}

export interface TriggerContext {
  id: string;
  scope: 'merchant' | 'customer';
  kind: string;
  source?: string;
  merchant_id: string;
  customer_id?: string | null;
  payload: Record<string, any>;
  urgency?: number;
  suppression_key?: string;
  expires_at?: string;
  status?: string;
  is_stale?: boolean;
}

export interface CustomerContext {
  customer_id: string;
  merchant_id: string;
  identity: {
    name: string;
    languages?: string[];
    phone?: string;
    language_pref?: string;
    age_band?: string;
    is_senior?: boolean;
  };
  state?: "new" | "active" | "lapsed_soft" | "lapsed_hard" | "churned";
  consent?: {opted_in_at?: string | null; scope: string[]; revoked_at?: string; opted_out?: boolean};
  relationship?: {
    visits_total?: number;
    services_received?: string[];
    first_visit?: string;
    last_visit?: string;
    visit_count?: number;
    total_spend?: number;
    past_services?: string[];
    past_medications?: string[];
    chronic_condition?: string;
  };
  preferences?: {
    reminder_opt_in?: boolean;
    preferred_slots?: string;
    channel?: string;
    preferred_language?: string;
    opted_in?: boolean;
  };
}

export interface Action {
  conversation_id: string;
  merchant_id: string;
  customer_id?: string | null;
  trigger_id: string;
  send_as: 'vera' | 'merchant_on_behalf';
  template_name?: string;
  template_params?: string[];
  body: string;
  cta: 'binary_yes_no' | 'open_ended' | 'binary_confirm_cancel' | 'multi_choice_slot' | 'none';
  suppression_key: string;
  rationale: string;
}

export interface ReplyRequest {
  conversation_id: string;
  merchant_id: string;
  customer_id?: string | null;
  from_role: 'merchant' | 'customer';
  message: string;
  received_at: string;
  turn_number: number;
}

export interface ReplyResponse {
  action: 'send' | 'wait' | 'end';
  body?: string;
  wait_seconds?: number;
  rationale?: string;
  cta?: Action['cta'];
}

export interface GroundingCheck {
  isGrounded: boolean;
  numbersFound: string[];
  verifiedNumbers: string[];
  ungroundedNumbers: string[];
  ungroundedEntities: string[];
  unsupportedClaims: string[];
  tabooWordsFound: string[];
  wordCount: number;
  hasSingleCta: boolean;
  estimatedScores: {
    specificity: number;
    categoryFit: number;
    merchantFit: number;
    triggerRelevance: number;
    engagementCompulsion: number;
    total: number;
  };
}
