// src/hooks/useNetwork.ts
// Hook React : détecte le statut réseau et déclenche la synchronisation automatique
// ─────────────────────────────────────────────────────────────────────────────
// Usage :
//   const { isOnline, pendingCount } = useNetwork()

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSyncQueue, getPendingActionsCount } from '@/lib/syncService'

export interface NetworkState {
  /** true si le navigateur est connecté */
  isOnline: boolean
  /** true si on vient tout juste de passer de offline → online */
  justReconnected: boolean
  /** Nombre d'actions en attente dans sync_queue */
  pendingCount: number
  /** true pendant l'exécution de la sync_queue */
  isSyncing: boolean
  /** Résultat de la dernière synchronisation */
  lastSyncResult: { flushed: number; errors: number } | null
}

export function useNetwork(): NetworkState {
  const [isOnline, setIsOnline]               = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [justReconnected, setJustReconnected] = useState(false)
  const [pendingCount, setPendingCount]       = useState(0)
  const [isSyncing, setIsSyncing]             = useState(false)
  const [lastSyncResult, setLastSyncResult]   = useState<{ flushed: number; errors: number } | null>(null)

  const wasOfflineRef = useRef(!isOnline)

  // Actualise le compteur de la sync_queue toutes les 5 secondes
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingActionsCount()
    setPendingCount(count)
  }, [])

  // Déclenche la synchronisation vers Supabase
  const triggerSync = useCallback(async () => {
    setIsSyncing(true)
    try {
      const result = await flushSyncQueue()
      setLastSyncResult(result)
      await refreshPendingCount()
    } finally {
      setIsSyncing(false)
    }
  }, [refreshPendingCount])

  useEffect(() => {
    // Lecture initiale du compteur
    refreshPendingCount()

    const handleOnline = async () => {
      setIsOnline(true)

      if (wasOfflineRef.current) {
        // On vient de repasser online après une déconnexion
        setJustReconnected(true)
        setTimeout(() => setJustReconnected(false), 4000)
        await triggerSync()
      }
      wasOfflineRef.current = false
    }

    const handleOffline = () => {
      setIsOnline(false)
      wasOfflineRef.current = true
      setLastSyncResult(null)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Rafraîchissement périodique du compteur d'actions en attente
    const interval = setInterval(refreshPendingCount, 5000)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [triggerSync, refreshPendingCount])

  return { isOnline, justReconnected, pendingCount, isSyncing, lastSyncResult }
}
