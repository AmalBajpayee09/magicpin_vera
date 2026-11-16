import fs from 'fs';
import path from 'path';
import {
  CategoryContext,
  MerchantContext,
  TriggerContext,
  CustomerContext,
  ContextScope,
  ReplyResponse
} from '../types';

export interface StoredContext<T> {
  scope: ContextScope;
  id: string;
  version: number;
  delivered_at: string;
  stored_at?: string;
  payload: T;
}

export interface ConversationState {
  conversation_id: string;
  merchant_id: string;
  customer_id?: string | null;
  trigger_id?: string;
  turns: Array<{
    turn_number: number;
    from: 'vera' | 'merchant' | 'customer';
    message: string;
    timestamp: string;
  }>;
  status: 'active' | 'waiting' | 'ended';
  auto_reply_count: number;
  last_auto_reply_msg?: string;
  last_reply_turn?: number;
  draft?: string;
  draft_approved?: boolean;
  now?: string;
  topic?: string;
  requested_topic?: string;
}

export class EngineStore {
  public categories: Map<string, StoredContext<CategoryContext>> = new Map();
  public merchants: Map<string, StoredContext<MerchantContext>> = new Map();
  public triggers: Map<string, StoredContext<TriggerContext>> = new Map();
  public customers: Map<string, StoredContext<CustomerContext>> = new Map();

  public conversations: Map<string, ConversationState> = new Map();
  public firedSuppressions: Set<string> = new Set();
  public suppressionUntil = new Map<string, number>();
  public sentEvents = new Set<string>();
  public optedOut = new Set<string>();
  public replyCache = new Map<string, {request: string; response: ReplyResponse}>();
  public startTime: number = Date.now();

  constructor(preload: boolean = false, public stateFile?: string) {
    if (stateFile && fs.existsSync(stateFile)) this.restore(JSON.parse(fs.readFileSync(stateFile, "utf8")));
    if (preload) {
      this.preloadSeedData();
    }
  }

  /**
   * Creates an isolated clone of this store.
   * Contexts (categories, merchants, triggers, customers) are shared by reference for fast, zero-IO lookups,
   * while mutable runtime states (conversations, firedSuppressions) are cleanly isolated.
   */
  public clone(isolateSuppressions: boolean = true): EngineStore {
    const cloned = new EngineStore(false);
    cloned.categories = new Map(this.categories);
    cloned.merchants = new Map(this.merchants);
    cloned.triggers = new Map(this.triggers);
    cloned.customers = new Map(this.customers);
    cloned.conversations = new Map();
    cloned.firedSuppressions = isolateSuppressions ? new Set() : new Set(this.firedSuppressions);
    cloned.startTime = this.startTime;
    return cloned;
  }

  /**
   * Resets only transient runtime state (fired suppression keys and conversations).
   * Ingested contextual knowledge remains intact.
   */
  public resetRuntimeState(): void {
    this.firedSuppressions.clear();
    this.conversations.clear();
  }

  public getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public getCounts() {
    return {
      categories: this.categories.size,
      merchants: this.merchants.size,
      triggers: this.triggers.size,
      customers: this.customers.size,
      conversations: this.conversations.size,
      suppressions: this.firedSuppressions.size,
    };
  }

  public pushContext(
    scope: ContextScope,
    id: string,
    version: number,
    deliveredAt: string,
    payload: any
  ): { accepted: boolean; ack_id: string; isNewVersion: boolean } {
    const ack_id = `ack_${scope}_${id}_${version}`;
    let map: Map<string, StoredContext<any>>;

    switch (scope) {
      case 'category':
        map = this.categories;
        break;
      case 'merchant':
        map = this.merchants;
        break;
      case 'trigger':
        map = this.triggers;
        break;
      case 'customer':
        map = this.customers;
        break;
      default:
        return { accepted: false, ack_id, isNewVersion: false };
    }

    const existing = map.get(id);
    if (existing && existing.version > version) return {accepted: false, ack_id, isNewVersion: false};
    if (existing && existing.version === version) {
      // Idempotent: acknowledge without overwriting newer/equal version
      return { accepted: true, ack_id, isNewVersion: false };
    }

    if (scope === 'trigger') {
      if (!payload.id) {
        payload.id = payload.trigger_id || id;
      }
      if (!payload.merchant_id && payload.merchant) {
        payload.merchant_id = payload.merchant;
      }

    }

    if (scope === 'merchant') {
      if (!payload.merchant_id) {
        payload.merchant_id = id;
      }
    }

    map.set(id, {
      scope,
      id,
      version,
      delivered_at: deliveredAt,
      stored_at: new Date().toISOString(),
      payload: structuredClone(payload),
    });

    return { accepted: true, ack_id, isNewVersion: true };
  }

  public getCategory(slug: string): CategoryContext | null {
    const item = this.categories.get(slug);
    return item ? item.payload : null;
  }

  public getMerchant(merchantId: string): MerchantContext | null {
    const item = this.merchants.get(merchantId);
    return item ? item.payload : null;
  }

  public getTrigger(triggerId: string): TriggerContext | null {
    const item = this.triggers.get(triggerId);
    return item ? item.payload : null;
  }

  public getCustomer(customerId: string): CustomerContext | null {
    const item = this.customers.get(customerId);
    return item ? item.payload : null;
  }

  public isSuppressed(key: string, now = Date.now()): boolean {
    if (!key) return false;
    return this.firedSuppressions.has(key) && (this.suppressionUntil.get(key) ?? Infinity) > now;
  }

  public markSuppressed(key: string, until = Infinity) {
    if (key) {
      this.firedSuppressions.add(key);
      this.suppressionUntil.set(key, until);
    }
  }

  public clearSuppression(key?: string) {
    if (key) {
      this.firedSuppressions.delete(key);
    } else {
      this.firedSuppressions.clear();
    }
  }

  public getConversation(convId: string): ConversationState {
    let conv = this.conversations.get(convId);
    if (!conv) {
      conv = {
        conversation_id: convId,
        merchant_id: '',
        turns: [],
        status: 'active',
        auto_reply_count: 0,
      };
      this.conversations.set(convId, conv);
    }
    return conv;
  }

  public recordBotMessage(
    convId: string,
    merchantId: string,
    customerId: string | null | undefined,
    triggerId: string,
    message: string
  ) {
    const conv = this.getConversation(convId);
    conv.merchant_id = merchantId;
    conv.customer_id = customerId;
    conv.trigger_id = triggerId;
    conv.turns.push({
      turn_number: conv.turns.length + 1,
      from: 'vera',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  public snapshot() {
    return {schema: 1, categories: [...this.categories], merchants: [...this.merchants],
      customers: [...this.customers], triggers: [...this.triggers], conversations: [...this.conversations],
      suppressions: [...this.firedSuppressions], suppressionUntil: [...this.suppressionUntil].map(([k,v]) => [k, Number.isFinite(v) ? v : null]),
      sentEvents: [...this.sentEvents], optedOut: [...this.optedOut], replyCache: [...this.replyCache]};
  }
  public restore(s: any) {
    if (s.schema !== 1) throw new Error('Unsupported state schema');
    for (const key of ['categories','merchants','customers','triggers','conversations','replyCache'] as const) (this as any)[key] = new Map(s[key]);
    this.firedSuppressions = new Set(s.suppressions);
    this.suppressionUntil = new Map(s.suppressionUntil.map(([k,v]: any) => [k,v ?? Infinity]));
    this.sentEvents = new Set(s.sentEvents); this.optedOut = new Set(s.optedOut);
  }
  /** One synchronous writer; rename commits the whole request before HTTP success. */
  public transaction<T>(fn: () => T): T {
    const before = structuredClone(this.snapshot());
    try { const result = fn(); this.save(); return result; }
    catch (err) { this.restore(before); throw err; }
  }
  public save() {
    if (!this.stateFile) return;
    fs.mkdirSync(path.dirname(this.stateFile), {recursive:true});
    const tmp = this.stateFile + '.tmp';
    const fd = fs.openSync(tmp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(this.snapshot())); fs.fsyncSync(fd); } finally {fs.closeSync(fd);}
    fs.renameSync(tmp, this.stateFile);
  }
  public teardown() {
    this.categories.clear(); this.merchants.clear(); this.customers.clear(); this.triggers.clear();
    this.resetRuntimeState(); this.suppressionUntil.clear(); this.sentEvents.clear(); this.optedOut.clear(); this.replyCache.clear();
  }

  public preloadSeedData() {
    // Try to load dataset from expanded or dataset folders
    const candidateDirs = [
      path.join(process.cwd(), 'challenge_pack', 'expanded'),
      path.join(process.cwd(), 'challenge_pack', 'dataset'),
    ];

    for (const baseDir of candidateDirs) {
      if (!fs.existsSync(baseDir)) continue;

      const catDir = path.join(baseDir, 'categories');
      if (fs.existsSync(catDir)) {
        for (const file of fs.readdirSync(catDir)) {
          if (file.endsWith('.json')) {
            try {
              const data = JSON.parse(fs.readFileSync(path.join(catDir, file), 'utf-8'));
              this.pushContext('category', data.slug, 1, new Date().toISOString(), data);
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }

      const mDir = path.join(baseDir, 'merchants');
      if (fs.existsSync(mDir)) {
        for (const file of fs.readdirSync(mDir)) {
          if (file.endsWith('.json')) {
            try {
              const data = JSON.parse(fs.readFileSync(path.join(mDir, file), 'utf-8'));
              this.pushContext('merchant', data.merchant_id, 1, new Date().toISOString(), data);
            } catch (e) {
              // ignore
            }
          }
        }
      }

      const trgDir = path.join(baseDir, 'triggers');
      if (fs.existsSync(trgDir)) {
        for (const file of fs.readdirSync(trgDir)) {
          if (file.endsWith('.json')) {
            try {
              const data = JSON.parse(fs.readFileSync(path.join(trgDir, file), 'utf-8'));
              this.pushContext('trigger', data.id, 1, new Date().toISOString(), data);
            } catch (e) {
              // ignore
            }
          }
        }
      }

      const custDir = path.join(baseDir, 'customers');
      if (fs.existsSync(custDir)) {
        for (const file of fs.readdirSync(custDir)) {
          if (file.endsWith('.json')) {
            try {
              const data = JSON.parse(fs.readFileSync(path.join(custDir, file), 'utf-8'));
              this.pushContext('customer', data.customer_id, 1, new Date().toISOString(), data);
            } catch (e) {
              // ignore
            }
          }
        }
      }
      break; // successfully loaded from first valid directory
    }
  }
}

export const productionStore = new EngineStore(false);
export const engineStore = productionStore;

export function createIsolatedStore(sourceStore: EngineStore = productionStore): EngineStore {
  return sourceStore.clone(true);
}
