// IndexedDB via Dexie 4 (profile §1.4.local-only).
// AC8 contract: saveRun({score, duration_ms, seed}) → Promise<numeric id>;
// topScores(limit) → Promise<Array<{ score, duration_ms, seed, created_at }>> ordered desc.
import { TUNING } from '../config/tuning.js';

let _dbPromise = null;
let _memoryFallback = null; // last-resort if Dexie/IDB unavailable

async function loadDexie() {
  // Static import would block module init if esm.sh is offline; do it lazily.
  try {
    const mod = await import('https://esm.sh/dexie@4');
    return mod.default || mod.Dexie || mod;
  } catch (err) {
    console.warn('[PersistenceManager] Dexie load failed; using in-memory fallback', err);
    return null;
  }
}

async function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = (async () => {
    const Dexie = await loadDexie();
    if (!Dexie) { _memoryFallback = { runs: [], best: new Map() }; return null; }
    const db = new Dexie('crumb-' + TUNING.game_slug);
    db.version(1).stores({
      runs: '++id, score, duration_ms, seed, created_at',
      best: '&game_slug, best_score'
    });
    return db;
  })();
  return _dbPromise;
}

export async function saveRun({ score, duration_ms, seed }) {
  const db = await getDB();
  const row = { score: Number(score) | 0, duration_ms: Number(duration_ms) | 0, seed: String(seed || ''), created_at: Date.now() };
  if (!db) {
    const id = _memoryFallback.runs.length + 1;
    _memoryFallback.runs.push({ id, ...row });
    const prev = _memoryFallback.best.get(TUNING.game_slug) || 0;
    if (row.score > prev) _memoryFallback.best.set(TUNING.game_slug, row.score);
    return id;
  }
  const id = await db.runs.add(row);
  // upsert best score
  const prev = await db.best.get(TUNING.game_slug);
  if (!prev || row.score > prev.best_score) {
    await db.best.put({ game_slug: TUNING.game_slug, best_score: row.score });
  }
  return id;
}

export async function topScores(limit = 10) {
  const db = await getDB();
  if (!db) {
    return _memoryFallback.runs.slice().sort((a, b) => b.score - a.score).slice(0, limit);
  }
  return db.runs.orderBy('score').reverse().limit(limit).toArray();
}

export async function bestScore() {
  const db = await getDB();
  if (!db) return _memoryFallback.best.get(TUNING.game_slug) || 0;
  const row = await db.best.get(TUNING.game_slug);
  return row ? row.best_score : 0;
}

export const PersistenceAPI = { saveRun, topScores, bestScore };
