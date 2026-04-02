// src/lib/offline.ts
// Gestion hors-ligne — couche de compatibilité + migration vers Dexie
// ─────────────────────────────────────────────────────────────────────
// Ce fichier conserve l'API originale (localStorage) pour les présences
// et redirige les nouvelles mutations vers Dexie sync_queue.

import { supabase } from './supabase'
import { addToSyncQueue, flushSyncQueue, getPendingActionsCount } from './syncService'

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — API ORIGINALE (localStorage) — CONSERVÉE POUR COMPATIBILITÉ
// ══════════════════════════════════════════════════════════════════════════════

const QUEUE_KEY = 'edumatrix_offline_presences'

interface OfflinePresence {
  id:        string
  eleve_id:  string
  classe_id: string
  date:      string
  heure:     string
  statut:    'présent' | 'absent' | 'retard'
  createdAt: number
}

function getQueue(): OfflinePresence[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: OfflinePresence[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/**
 * @deprecated Préférer addToSyncQueue() via syncService.ts
 * Conservé pour compatibilité avec le code existant.
 */
export function queuePresence(presence: Omit<OfflinePresence, 'id' | 'createdAt'>) {
  // Ajoute dans localStorage (rétrocompatibilité)
  const queue = getQueue()
  const entry: OfflinePresence = {
    ...presence,
    id:        crypto.randomUUID(),
    createdAt: Date.now(),
  }
  queue.push(entry)
  saveQueue(queue)

  // 🆕 Ajoute aussi dans Dexie sync_queue (si disponible)
  addToSyncQueue('presences', 'INSERT', {
    eleve_id:  presence.eleve_id,
    classe_id: presence.classe_id,
    date:      presence.date,
    heure:     presence.heure,
    statut:    presence.statut,
  }).catch(() => {/* IndexedDB pas encore prêt — localStorage suffit */})

  console.info('[EduMatrix Offline] Présence mise en file d\'attente :', entry)
}

/**
 * Nombre d'entrées en attente (localStorage + Dexie).
 * Pour la rétrocompatibilité, retourne uniquement le count localStorage.
 * Utiliser getPendingActionsCount() de syncService pour le total Dexie.
 */
export function getPendingCount(): number {
  return getQueue().length
}

/**
 * @deprecated Préférer flushSyncQueue() via syncService.ts
 * Conservé pour compatibilité avec OfflineBanner.tsx existant.
 */
export async function syncOfflinePresences(): Promise<{ synced: number; errors: number }> {
  // 1. Tente de vider la Dexie sync_queue (plus robuste)
  const dexieResult = await flushSyncQueue().catch(() => ({ flushed: 0, errors: 0 }))

  // 2. Conserve la logique localStorage pour les entrées déjà présentes
  const queue = getQueue()
  if (queue.length === 0) {
    return { synced: dexieResult.flushed, errors: dexieResult.errors }
  }

  let synced = dexieResult.flushed
  let errors  = dexieResult.errors
  const remaining: OfflinePresence[] = []

  for (const p of queue) {
    try {
      const { data: existing } = await supabase
        .from('presences')
        .select('id')
        .eq('eleve_id', p.eleve_id)
        .eq('date', p.date)
        .single()

      if (!existing) {
        const { error } = await supabase.from('presences').insert({
          eleve_id:  p.eleve_id,
          classe_id: p.classe_id,
          date:      p.date,
          heure:     p.heure,
          statut:    p.statut,
        })
        if (error) throw error
      }
      synced++
    } catch (err) {
      console.error('[EduMatrix Offline] Erreur sync présence :', err)
      errors++
      remaining.push(p)
    }
  }

  saveQueue(remaining)
  console.info(`[EduMatrix Offline] Sync : ${synced} synchronisées, ${errors} erreurs`)
  return { synced, errors }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — NOUVELLES APIS DEXIE (à utiliser dans le nouveau code)
// ══════════════════════════════════════════════════════════════════════════════

// Ré-export des nouvelles APIs pour un import unique depuis offline.ts
export { addToSyncQueue, flushSyncQueue, getPendingActionsCount } from './syncService'

// ── Hook React : écoute le retour en ligne ────────────────────────────────────
// Conservé pour rétrocompatibilité. Préférer useNetwork() de @/hooks/useNetwork

export function useOnlineSync() {
  if (typeof window === 'undefined') return

  const handleOnline = async () => {
    const localPending = getPendingCount()
    const dexiePending = await getPendingActionsCount()

    if (localPending === 0 && dexiePending === 0) return

    console.info(`[EduMatrix Offline] Retour en ligne — sync en cours...`)
    const result = await syncOfflinePresences()

    if (result.synced > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('EduMatrix', {
        body: `${result.synced} action(s) synchronisée(s) avec succès.`,
        icon: '/favicon.ico',
      })
    }
  }

  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}

export function isOffline(): boolean {
  if (typeof window === 'undefined') return false
  return !navigator.onLine
}
