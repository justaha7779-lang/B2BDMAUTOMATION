// Persistent storage engine: localStorage (fast reads) + IndexedDB (large data)
const DB_NAME = 'ProspectingEngine';
const DB_VERSION = 1;
const STORE_LEADS = 'campaign_queue';
const LS_STATS_KEY = 'pe_stats';
const LS_TARGET_KEY = 'pe_target_index';
const LS_OUTREACH_KEY = 'pe_outreach_state';

// ─── IndexedDB ────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_LEADS)) {
        db.createObjectStore(STORE_LEADS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveLeads(leads: object[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LEADS, 'readwrite');
    const store = tx.objectStore(STORE_LEADS);
    store.clear();
    leads.forEach((lead) => store.put(lead));
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {
    // Silent fallback — localStorage is primary source of truth for leads count
  }
}

export async function idbLoadLeads<T>(): Promise<T[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LEADS, 'readonly');
    const store = tx.objectStore(STORE_LEADS);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        resolve((req.result as T[]) ?? []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

// ─── Stats (localStorage) ─────────────────────────────────────────────────────

export interface PersistedStats {
  totalScans: number;
  totalLeads: number;
  messagesSent: number;
  successRate: number;
}

const DEFAULT_STATS: PersistedStats = {
  totalScans: 24,
  totalLeads: 1547,
  messagesSent: 892,
  successRate: 94.2,
};

export function lsLoadStats(): PersistedStats {
  try {
    const raw = localStorage.getItem(LS_STATS_KEY);
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw) as Partial<PersistedStats>;
    return {
      totalScans: parsed.totalScans ?? DEFAULT_STATS.totalScans,
      totalLeads: parsed.totalLeads ?? DEFAULT_STATS.totalLeads,
      messagesSent: parsed.messagesSent ?? DEFAULT_STATS.messagesSent,
      successRate: parsed.successRate ?? DEFAULT_STATS.successRate,
    };
  } catch {
    return DEFAULT_STATS;
  }
}

export function lsSaveStats(stats: PersistedStats): void {
  try {
    localStorage.setItem(LS_STATS_KEY, JSON.stringify(stats));
  } catch {}
}

// ─── Scan position tracking token (localStorage) ──────────────────────────────

export function lsLoadTargetIndex(): number {
  try {
    const raw = localStorage.getItem(LS_TARGET_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export function lsSaveTargetIndex(index: number): void {
  try {
    localStorage.setItem(LS_TARGET_KEY, String(index));
  } catch {}
}

// ─── Outreach completed set (localStorage) ────────────────────────────────────

export function lsLoadOutreachCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_OUTREACH_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function lsSaveOutreachCompleted(completed: Set<string>): void {
  try {
    localStorage.setItem(LS_OUTREACH_KEY, JSON.stringify([...completed]));
  } catch {}
}
