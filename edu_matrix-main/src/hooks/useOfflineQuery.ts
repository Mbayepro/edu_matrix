// src/hooks/useOfflineQuery.ts
// Hook générique : lit depuis Dexie (instantané) + sync Supabase en arrière-plan
// ─────────────────────────────────────────────────────────────────────────────
// Pattern "Stale-While-Revalidate" local :
//  1. Affiche immédiatement les données du cache IndexedDB (zéro latence)
//  2. Si online, revalide depuis Supabase et met à jour Dexie + l'état React
//
// Usage :
//   const { data, loading, isFromCache } = useOfflineQuery(
//     () => db.eleves.where('ecole_id').equals(ecoleId).toArray(),
//     () => supabase.from('eleves').select('*').eq('ecole_id', ecoleId),
//     db.eleves,
//   )

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Table } from 'dexie'

interface UseOfflineQueryOptions {
  /** Désactive le fetch Supabase (ex: si ecoleId pas encore chargé) */
  enabled?: boolean
}

interface UseOfflineQueryResult<T> {
  data:        T[]
  loading:     boolean
  /** true si les données viennent uniquement du cache local (offline) */
  isFromCache: boolean
  error:       Error | null
  /** Force une re-sync depuis Supabase */
  refetch:     () => void
}

/**
 * @param localQuery   Fonction qui interroge Dexie et retourne des données locales
 * @param remoteQuery  Fonction qui appelle Supabase (retourne une PromiseLike<{ data, error }>)
 * @param table        La table Dexie cible (pour le bulkPut lors de la revalidation)
 * @param options      Options optionnelles
 */
export function useOfflineQuery<T extends { id: string }>(
  localQuery:  () => Promise<T[]>,
  remoteQuery: () => Promise<{ data: T[] | null; error: { message: string } | null }>,
  table:       Table<T, string>,
  options:     UseOfflineQueryOptions = {},
): UseOfflineQueryResult<T> {
  const { enabled = true } = options

  const [data,        setData]        = useState<T[]>([])
  const [loading,     setLoading]     = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [error,       setError]       = useState<Error | null>(null)
  const [tick,        setTick]        = useState(0)

  const mountedRef = useRef(true)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function run() {
      // ── Étape 1 : lecture locale (rapide) ─────────────────────────────────
      try {
        const localData = await localQuery()
        if (!cancelled && localData.length > 0) {
          setData(localData)
          setIsFromCache(true)
          setLoading(false)  // affiche tout de suite sans attendre Supabase
        }
      } catch (localErr) {
        console.warn('[useOfflineQuery] Erreur lecture locale:', localErr)
      }

      // ── Étape 2 : revalidation Supabase (si online) ───────────────────────
      if (!navigator.onLine) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const { data: remoteData, error: remoteError } = await remoteQuery()

        if (cancelled) return

        if (remoteError) {
          throw new Error(remoteError.message)
        }

        if (remoteData) {
          // Met à jour le cache local
          await table.bulkPut(remoteData)
          setData(remoteData)
          setIsFromCache(false)
        }
      } catch (remoteErr) {
        if (!cancelled) {
          const err = remoteErr instanceof Error ? remoteErr : new Error(String(remoteErr))
          setError(err)
          console.error('[useOfflineQuery] Erreur Supabase:', err.message)
          // On garde les données locales si elles existent
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick])

  return { data, loading, isFromCache, error, refetch }
}
