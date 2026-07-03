// src/lib/syncService.ts
// Service de synchronisation bidirectionnel Dexie ↔ Supabase
// ─────────────────────────────────────────────────────────────
// Stratégie :
//  • PULL  — Supabase → Dexie : au chargement, si online, on rafraîchit le cache local
//  • PUSH  — Dexie sync_queue → Supabase : dès le retour en ligne, on envoie les mutations
//  • "Last Write Wins" : le timestamp local gagne en cas de conflit

import { supabase } from './supabase'
import { getDb, type SyncAction } from './db'
import { getTodayDate } from './dateUtils'

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
  
  // Limiter les données volumineuses à l'année scolaire courante pour éviter la surcharge mémoire
  const today = new Date();
  const currentYear = today.getMonth() >= 8 
    ? `${today.getFullYear()}-${today.getFullYear() + 1}`
    : `${today.getFullYear() - 1}-${today.getFullYear()}`

  const tables = [
    { name: 'ecoles', query: (supabase.from('ecoles' as any) as any).select('*').eq('id', ecoleId) },
    { name: 'niveaux', query: (supabase.from('niveaux' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'series', query: (supabase.from('series' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'classes', query: (supabase.from('classes' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'matieres', query: (supabase.from('matieres' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'coefficients_matieres', query: (supabase.from('coefficients_matieres' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'evaluations', query: (supabase.from('evaluations' as any) as any).select('*').eq('ecole_id', ecoleId).eq('annee_scolaire', currentYear) },
    { name: 'eleves', query: (supabase.from('eleves' as any) as any).select('*').eq('ecole_id', ecoleId) }, // Les élèves restent tous chargés pour le moment
    { name: 'notes', query: (supabase.from('notes' as any) as any).select('*').eq('ecole_id', ecoleId).eq('annee_scolaire', currentYear) }, // Filtrage par année scolaire pour optimiser le cache
    { name: 'presences', query: (supabase.from('presences' as any) as any).select('*').eq('ecole_id', ecoleId) }, 
    { name: 'profiles', query: (supabase.from('profiles' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'frais_scolaires', query: (supabase.from('frais_scolaires' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'eleves_frais', query: (supabase.from('eleves_frais' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'paiements', query: (supabase.from('paiements' as any) as any).select('*').eq('ecole_id', ecoleId) },
    { name: 'emargements', query: (supabase.from('emargements' as any) as any).select('*').eq('ecole_id', ecoleId) }
  ]

  for (const t of tables) {
    try {
      // 1. Chercher la date de dernière synchro locale pour cette table
      const meta = await db.sync_metadata.get(`${t.name}_${ecoleId}`)
      const lastSyncedAt = meta?.last_synced_at

      let query = t.query
      if (lastSyncedAt) {
        query = query.gt('updated_at', lastSyncedAt)
      }

      const { data, error } = await query
      
      if (error) {
        console.warn(`[EduMatrix Sync] ⚠️ Skip ${t.name}: ${error.message}`)
        continue
      }

      if (data && data.length > 0) {
        const tableObj = db.table(t.name)
        if (tableObj) {
          // Séparer les actifs des supprimés (Soft Delete)
          const toPut = data.filter((row: any) => !row.deleted_at)
          const toDelete = data.filter((row: any) => row.deleted_at).map((row: any) => row.id)

          if (toPut.length > 0) await tableObj.bulkPut(toPut)
          if (toDelete.length > 0) await tableObj.bulkDelete(toDelete)
          
          console.info(`[EduMatrix Sync] 📥 ${t.name} : +${toPut.length} modifiés, -${toDelete.length} supprimés`)

          // 2. Mettre à jour le timestamp de synchro (prendre le plus récent des data reçus)
          const latestUpdate = data.reduce((max: string, row: any) => 
            !max || row.updated_at > max ? row.updated_at : max, '')
          
          if (latestUpdate) {
            await db.sync_metadata.put({
              id: `${t.name}_${ecoleId}`,
              table_name: t.name,
              ecole_id: ecoleId,
              last_synced_at: latestUpdate
            })
          }
        }
      }
    } catch (err) {
      console.warn(`[EduMatrix Sync] ❌ Fail ${t.name}:`, err)
    }
  }
  
  console.info('[EduMatrix Sync] ✅ Pull terminé.')
  
  // Lancer le nettoyage en arrière-plan après la sync
  setTimeout(cleanupLocalCache, 5000)
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
  const syncQueue = db.table('sync_queue')
  const queue = await syncQueue.orderBy('createdAt').toArray()
  if (queue.length === 0) return { flushed: 0, errors: 0 }

  console.info(`[EduMatrix Sync] ⬆️  Push ${queue.length} action(s) en attente...`)

  let flushed = 0
  let errors  = 0

  for (const action of queue) {
    try {
      await executeAction(action)
      await syncQueue.delete(action.id!)
      flushed++
    } catch (err) {
      errors++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[EduMatrix Sync] ❌ Erreur action #${action.id}:`, message)
      // Incrémente le compteur d'échecs
      await syncQueue.update(action.id!, {
        attempts: action.attempts + 1,
        lastError: message,
      })
      // Abandon après 5 tentatives pour éviter les boucles infinies
      if (action.attempts >= 4) {
        console.warn(`[EduMatrix Sync] ⚠️ Action #${action.id} abandonnée après 5 tentatives`)
        await syncQueue.delete(action.id!)
      }
    }
  }

  console.info(`[EduMatrix Sync] ✅ Push terminé : ${flushed} réussies, ${errors} erreurs`)
  return { flushed, errors }
}

// ─── Exécuteur d'actions ──────────────────────────────────────────────────────

async function executeAction(action: SyncAction): Promise<void> {
  const { table, action: type, payload } = action

  const safePayload = { ...payload };
  // Suppression de la contrainte artificielle sur ecole_id maintenant que la colonne existe

  switch (type) {
    case 'INSERT': {
      const { error } = await (supabase as any).from(table).insert(safePayload)
      if (error) throw new Error(error.message)
      break
    }
    case 'UPDATE': {
      const { id, ...fields } = safePayload as { id: string; updated_at?: string; [key: string]: unknown }
      
      // BLOQUAGE DES CONFLITS : Contrôle de concurrence optimiste
      if (fields.updated_at) {
        const { data: serverData } = await (supabase as any)
          .from(table)
          .select('updated_at')
          .eq('id', id)
          .single() as any
          
        if (serverData && serverData.updated_at) {
          const serverTime = new Date(serverData.updated_at).getTime()
          const localOriginalTime = new Date(fields.updated_at).getTime()
          
          // Si le serveur a une version plus récente que celle que nous avions au moment de la modif
          if (serverTime > localOriginalTime) {
            const errorMsg = `CONFLIT : La ligne dans ${table} (${id}) a été modifiée par un autre utilisateur. Action bloquée.`
            console.error(`[EduMatrix Sync] 🛑 ${errorMsg}`)
            throw new Error(errorMsg)
          }
        }
      }
      
      const { error } = await (supabase as any).from(table).update(fields).eq('id', id)
      if (error) throw new Error(error.message)
      break
    }
    case 'DELETE': {
      const { id } = payload as { id: string }
      // On privilégie le Soft Delete si la colonne existe (mise à jour de deleted_at)
      const { error } = await (supabase as any).from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
      
      // Fallback au Hard Delete si erreur (ex: colonne deleted_at pas encore migrée partout)
      if (error) {
        const { error: delError } = await (supabase as any).from(table).delete().eq('id', id)
        if (delError) throw new Error(delError.message)
      }
      break
    }
  }
}

// ─── Helpers : ajouter à la file d'attente ───────────────────────────────────

/**
 * Exécute une requête Supabase avec un timeout.
 * Si le timeout est atteint, rejette l'erreur pour passer au fallback offline.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number = 3000): Promise<T> {
  let timeoutId: NodeJS.Timeout
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Timeout Supabase')), ms)
  })
  
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId)
  })
}

/**
 * Enfile une mutation en attente.
 * STRATÉGIE ONLINE-FIRST : Si on est en ligne, on tente d'abord d'écrire directement sur Supabase avec un timeout (3s).
 * - Si succès : on met à jour IndexedDB localement pour le cache et on ne met PAS en file d'attente.
 * - Si échec/timeout/offline : on met en file d'attente (sync_queue) pour un flush ultérieur et on met à jour IndexedDB.
 */
export async function addToSyncQueue(
  table: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>,
  ecoleId?: string,
): Promise<void> {
  const db = getDb()

  // 1. ONLINE-FIRST ATTEMPT
  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      // Tentative directe avec Timeout
      await withTimeout(executeAction({ table, action, payload } as SyncAction), 4000)
      
      // Si on arrive ici, l'écriture Supabase a réussi. 
      // On applique la modification au cache local (Dexie) directement sans passer par la queue.
      // Si on arrive ici, l'écriture Supabase a réussi. 
      // On applique la modification au cache local (Dexie) directement sans passer par la queue.
      try {
        const tableObj = db.table(table)
        if (action === 'INSERT' || action === 'UPDATE') {
          await tableObj.put(payload)
        } else if (action === 'DELETE' && payload.id) {
          await tableObj.delete(payload.id as string)
        }
      } catch (e) {
        console.warn(`[EduMatrix Sync] Cache local update skipped: ${table}`)
      }
      
      // Essayer de flush le reste de la queue au passage
      void flushSyncQueue()
      
      return // Succès direct, on s'arrête là
    } catch (err) {
      console.warn(`[EduMatrix Sync] ⚠️ Échec direct (${err instanceof Error ? err.message : String(err)}). Passage en mode Offline-Queue.`)
      // On continue vers l'ajout en file d'attente
    }
  }

  // 2. OFFLINE FALLBACK (ou échec direct)
  const syncQueue = db.table('sync_queue')
  await syncQueue.add({
    table,
    action,
    payload,
    ecole_id: ecoleId,
    createdAt: Date.now(),
    attempts: 0,
  })
  
  // Appliquer la modification au cache local (Dexie) pour que l'UI soit à jour immédiatement
  try {
    const tableObj = db.table(table)
    if (action === 'INSERT' || action === 'UPDATE') {
      await tableObj.put(payload)
    } else if (action === 'DELETE' && payload.id) {
      await tableObj.delete(payload.id as string)
    }
  } catch (e) {
    console.warn(`[EduMatrix Sync] Cache local update skipped: ${table}`)
  }
}

/**
 * Nombre d'actions en attente dans la sync_queue.
 */
export async function getPendingActionsCount(): Promise<number> {
  if (typeof window === 'undefined') return 0
  try {
    const db = getDb()
    return await db.table('sync_queue').count()
  } catch {
    return 0
  }
}

/**
 * Nettoie le cache Dexie pour libérer de l'espace (Garbage Collection).
 * Supprime les données vieilles de plus de X jours.
 * N'affecte PAS Supabase.
 */
export async function cleanupLocalCache(): Promise<void> {
  if (typeof window === 'undefined') return
  const db = getDb()
  try {
    // Garder les présences des 3 derniers mois uniquement
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const oldDate = threeMonthsAgo.toISOString().split('T')[0] // Gardé en ISO pour comparer avec la BDD
    
    const presenceTable = db.table('presences')
    const countPresences = await presenceTable.where('date').below(oldDate).delete()
    
    // Garder les paiements de l'année scolaire en cours (depuis septembre dernier)
    const currentYear = new Date().getFullYear()
    const startOfSchoolYear = new Date(currentYear, 8, 1).toISOString() // 1er Septembre
    const paiementTable = db.table('paiements')
    const countPaiements = await paiementTable.where('date_paiement').below(startOfSchoolYear).delete()
    
    if (countPresences > 0 || countPaiements > 0) {
      console.info(`[EduMatrix GC] Cache nettoyé: ${countPresences} présences, ${countPaiements} paiements supprimés.`)
    }
  } catch (err) {
    console.warn('[EduMatrix GC] Erreur lors du nettoyage:', err)
  }
}
