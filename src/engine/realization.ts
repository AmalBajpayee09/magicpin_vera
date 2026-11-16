export interface ObservabilityTrace {
  trigger_kind: string;
  trigger_id: string;
  extracted_facts: string[];
  signal_class: string;
  selected_signal: string;
  priority_score: number;
  score_breakdown: Record<string, number>;
  selected_action: string;
  concrete_asset: string;
  is_trigger_asset: boolean;
  composer_mode: 'deterministic' | 'gemini';
  grounding_pass: boolean;
  cta_pass: boolean;
  suppression_key: string;
}
