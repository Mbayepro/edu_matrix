// src/lib/syncService.ts
// Service de synchronisation bidirectionnel Dexie ↔ Supabase
// ─────────────────────────────────────────────────────────────
// Stratégie :
//  • PULL  — Supabase → Dexie : au chargement, si online, on rafraîchit le cache local
//  • PUSH  — Dexie sync_queue → Supabase : dès le retour en ligne, on envoie les mutations
//  • "Last Write Wins" : le timestamp local gagne en cas de conflit

import { supabase } from './supabase'
import { getDb, type SyncAction } from './db'

// ─── PULL : Supabase → cache local ───────────────────────────────────────────

/**
 * Synchronise les données de Supabase vers Dexie.
 * Appelé au démarrage de l'application (si online) et après chaque reconnexion.
 * @param ecoleId  UUID de l'école courante
 */
export async function syncFromSupabase(ecoleId: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!navigator.onLine || !ecoleId) return

  console.info('[EduMatrix Sync] ⬇️  Pull Supabase → IndexedDB...')
  const db = getDb()

  const tables = [
    { name: 'ecoles', query: supabase.from('ecoles').select('*').eq('id', ecoleId) },
    { name: 'niveaux', query: supabase.from('niveaux').select('*').eq('ecole_id', ecoleId) },
    { name: 'series', query: supabase.from('series').select('*').eq('ecole_id', ecoleId) },
    { name: 'classes', query: supabase.from('classes').select('*').eq('ecole_id', ecoleId) },
    { name: 'matieres', query: supabase.from('matieres').select('*').eq('ecole_id', ecoleId) },
    { name: 'coefficients_matieres', query: supabase.from('coefficients_matieres').select('*').eq('ecole_id', ecoleId) },
    { name: 'evaluations', query: supabase.from('evaluations').select('*').eq('ecole_id', ecoleId) },
    { name: 'eleves', query: supabase.from('eleves').select('*').eq('ecole_id', ecoleId) },
    { name: 'notes', query: supabase.from('notes').select('*').eq('ecole_id', ecoleId) },
    // Use slightly different query for presences (no ecole_id column)
    { name: 'presences', query: supabase.from('presences').select('*') },
    { name: 'profiles', query: supabase.from('profiles').select('*').eq('ecole_id', ecoleId) },
    { name: 'frais_scolaires', query: supabase.from('frais_scolaires').select('*').eq('ecole_id', ecoleId) },
    { name: 'eleves_frais', query: supabase.from('eleves_frais').select('*').eq('ecole_id', ecoleId) },
    { name: 'paiements', query: supabase.from('paiements').select('*').eq('ecole_id', ecoleId) },
    { name: 'emargements', query: supabase.from('emargements').select('*') } // Might fail if table missing
  ]

  for (const t of tables) {
    try {
      const { data, error } = await t.query
      if (error) {
        console.warn(`[EduMatrix Sync] ⚠️ Skip ${t.name}: ${error.message}`)
        continue
      }
      if (data && data.length > 0) {
        const tableObj = (db as any)[t.name]
        if (tableObj) {
          await tableObj.bulkPut(data)
        }
      }
    } catch (err) {
      console.warn(`[EduMatrix Sync] ❌ Fail ${t.name}:`, err)
    }
  }
  
  console.info('[EduMatrix Sync] ✅ Pull terminé.')
}

// ─── PUSH : sync_queue → Supabase ────────────────────────────────────────────

/**
 * Exécute toutes les actions en attente dans sync_queue vers Supabase.
 * Appelé automatiquement au retour en ligne par le hook useNetwork.
 * @returns { flushed, errors }
 */
export async function flushSyncQueue(): Promise<{ flushed: number; errors: number }> {
  if (typeof window === 'undefined') return { flushed: 0, errors: 0 }
  if (!navigator.onLine) return { flushed: 0, errors: 0 }

  const db = getDb()
  const queue = await db.sync_queue.orderBy('createdAt').toArray()
  if (queue.length === 0) return { flushed: 0, errors: 0 }

  console.info(`[EduMatrix Sync] ⬆️  Push ${queue.length} action(s) en attente...`)

  let flushed = 0
  let errors  = 0

  for (const action of queue) {
    try {
      await executeAction(action)
      await db.sync_queue.delete(action.id!)
      flushed++
    } catch (err) {
      errors++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[EduMatrix Sync] ❌ Erreur action #${action.id}:`, message)
      // Incrémente le compteur d'échecs
      await db.sync_queue.update(action.id!, {
        attempts: action.attempts + 1,
        lastError: message,
      })
      // Abandon après 5 tentatives pour éviter les boucles infinies
      if (action.attempts >= 4) {
        console.warn(`[EduMatrix Sync] ⚠️ Action #${action.id} abandonnée après 5 tentatives`)
        await db.sync_queue.delete(action.id!)
      }
    }
  }

  console.info(`[EduMatrix Sync] ✅ Push terminé : ${flushed} réussies, ${errors} erreurs`)
  return { flushed, errors }
}

// ─── Exécuteur d'actions ──────────────────────────────────────────────────────

async function executeAction(action: SyncAction): Promise<void> {
  const { table, action: type, payload } = action

  switch (type) {
    case 'INSERT': {
      const { error } = await (supabase as any).from(table).insert(payload)
      if (error) throw new Error(error.message)
      break
    }
    case 'UPDATE': {
      // payload doit contenir { id, ...fields }
      const { id, ...fields } = payload as { id: string; [key: string]: unknown }
      const { error } = await (supabase as any).from(table).update(fields).eq('id', id)
      if (error) throw new Error(error.message)
      break
    }
    case 'DELETE': {
      const { id } = payload as { id: string }
      const { error } = await (supabase as any).from(table).delete().eq('id', id)
      if (error) throw new Error(error.message)
      break
    }
  }
}

// ─── Helpers : ajouter à la file d'attente ───────────────────────────────────

/**
 * Enfile une mutation en attente (à utiliser quand offline OU pour garantie offline).
 * Si online, on essaie d'abord de flush immédiatement.
 */
export async function addToSyncQueue(
  table: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>,
  ecoleId?: string,
): Promise<void> {
  const db = getDb()
  await db.sync_queue.add({
    table,
    action,
    payload,
    ecole_id: ecoleId,
    createdAt: Date.now(),
    attempts: 0,
  })

  // Immediate Flush attempt if online
  if (typeof window !== 'undefined' && navigator.onLine) {
    void flushSyncQueue()
  }
}

/**
 * Nombre d'actions en attente dans la sync_queue.
 */
export async function getPendingActionsCount(): Promise<number> {
  if (typeof window === 'undefined') return 0
  try {
    const db = getDb()
    return await db.sync_queue.count()
  } catch {
    return 0
  }
}
