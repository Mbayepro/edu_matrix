// src/lib/offline.ts
// Gestion hors-ligne : stocke les présences en localStorage
// et les synchronise quand la connexion revient
import { supabase } from './supabase'

const QUEUE_KEY = 'edumatrix_offline_presences'

interface OfflinePresence {
  id:        string   // uuid local temporaire
  eleve_id:  string
  classe_id: string
  date:      string
  heure:     string
  statut:    'présent' | 'absent' | 'retard'
  createdAt: number   // timestamp
}

// ── Lecture / écriture queue ──────────────────────────
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

// ── Ajoute une présence à la queue hors-ligne ─────────
export function queuePresence(presence: Omit<OfflinePresence, 'id' | 'createdAt'>) {
  const queue = getQueue()
  const entry: OfflinePresence = {
    ...presence,
    id:        crypto.randomUUID(),
    createdAt: Date.now(),
  }
  queue.push(entry)
  saveQueue(queue)
  console.info('[EduMatrix Offline] Présence mise en file d\'attente :', entry)
}

// ── Nombre d'entrées en attente ───────────────────────
export function getPendingCount(): number {
  return getQueue().length
}

// ── Synchronisation quand on revient en ligne ─────────
export async function syncOfflinePresences(): Promise<{ synced: number; errors: number }> {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, errors: 0 }

  let synced = 0
  let errors = 0
  const remaining: OfflinePresence[] = []

  for (const p of queue) {
    try {
      // Vérifie si déjà enregistré (doublon possible)
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
      console.error('[EduMatrix Offline] Erreur sync :', err)
      errors++
      remaining.push(p)   // on garde celles qui ont échoué
    }
  }

  saveQueue(remaining)
  console.info(`[EduMatrix Offline] Sync : ${synced} synchronisées, ${errors} erreurs`)
  return { synced, errors }
}

// ── Hook React : écoute le retour en ligne ────────────
// Usage dans un composant :
//   useOnlineSync()
export function useOnlineSync() {
  if (typeof window === 'undefined') return

  const handleOnline = async () => {
    const pending = getPendingCount()
    if (pending === 0) return

    console.info(`[EduMatrix Offline] Retour en ligne — ${pending} présence(s) à synchroniser`)
    const result = await syncOfflinePresences()

    if (result.synced > 0) {
      // Notification légère (sans dépendance externe)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('EduMatrix', {
          body: `${result.synced} présence(s) synchronisée(s) avec succès.`,
          icon: '/favicon.ico',
        })
      }
    }
  }

  window.addEventListener('online', handleOnline)
  // Retourne une fonction de cleanup
  return () => window.removeEventListener('online', handleOnline)
}

// ── Composant Bandeau hors-ligne ──────────────────────
// À placer dans le layout du dashboard
export function isOffline(): boolean {
  if (typeof window === 'undefined') return false
  return !navigator.onLine
}
