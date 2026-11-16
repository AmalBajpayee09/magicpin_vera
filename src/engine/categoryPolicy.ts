import { CategoryContext, MerchantContext } from '../types';

export interface CategoryRules {
  salutation: (owner: string, name: string) => string;
  tabooWords: string[];
  tone: string;
  defaultActions: string[];
  forbiddenActions: string[];
}

export const CATEGORY_POLICIES: Record<string, CategoryRules> = {
  dentists: {
    salutation: (owner, name) => (owner ? (owner.toLowerCase().startsWith('dr') ? owner : `Dr. ${owner}`) : name || 'Doctor'),
    tabooWords: ['footfall', 'bogo', 'flash sale', 'bargain', 'supercharge', 'cheap'],
    tone: 'clinical, calm, authoritative, reassuring',
    defaultActions: ['patient clinical recall', 'preventive oral checkup', 'slot reservation', 'compliance protocol'],
    forbiddenActions: ['footfall blast', 'flash discount coupon', 'bogo buy-one-get-one'],
  },
  salons: {
    salutation: (owner, name) => owner || name || 'Partner',
    tabooWords: ['treatment plan', 'clinical', 'medical', 'prescription'],
    tone: 'warm, stylish, consultative, trend-aware',
    defaultActions: ['haircut and styling', 'festive makeover package', 'open slot fill', 'VIP client checkup'],
    forbiddenActions: ['clinical recall', 'medical checkup'],
  },
  restaurants: {
    salutation: (owner, name) => owner || name || 'Partner',
    tabooWords: ['consultation', 'treatment', 'patient', 'clinical'],
    tone: 'energetic, operator P&L aware, food-focused',
    defaultActions: ['lunch thali package', 'delivery broadcast', 'table cover optimization', 'weekend special'],
    forbiddenActions: ['clinical recall', 'appointment booking'],
  },
  gyms: {
    salutation: (owner, name) => owner || name || 'Coach',
    tabooWords: ['patient', 'prescription', 'footfall', 'cheap'],
    tone: 'motivational, coach-like, empathetic, streak-driven',
    defaultActions: ['attendance challenge', 'free trial reservation', 'membership renewal', 'recovery pass'],
    forbiddenActions: ['medical diagnosis', 'clinical recall'],
  },
  pharmacies: {
    salutation: (owner, name) => owner || name || 'Pharmacist',
    tabooWords: ['drive footfall', 'supercharge', 'bargain', 'flash sale', 'loyalty points'],
    tone: 'trustworthy, professional, community healthcare partner',
    defaultActions: ['chronic medication refill', 'free home delivery dispatch', 'seasonal health broadcast', 'dosage check'],
    forbiddenActions: ['promotional flash sale', 'aggressive upsell'],
  },
};

export function getCategoryPolicy(catSlug: string): CategoryRules {
  return CATEGORY_POLICIES[catSlug] || {
    salutation: (owner, name) => owner || name || 'Partner',
    tabooWords: ['supercharge', 'empower'],
    tone: 'helpful, professional',
    defaultActions: ['growth action plan', 'customer outreach'],
    forbiddenActions: [],
  };
}
