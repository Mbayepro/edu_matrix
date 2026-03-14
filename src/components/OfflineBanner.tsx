'use client'

// src/components/OfflineBanner.tsx
// Bandeau affiché quand la connexion est coupée
// + synchro automatique au retour en ligne
import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getPendingCount, syncOfflinePresences } from '@/lib/offline'

export default function OfflineBanner() {
  const [offline,  setOffline]  = useState(false)
  const [pending,  setPending]  = useState(0)
  const [syncing,  setSyncing]  = useState(false)
  const [synced,   setSynced]   = useState(false)

  useEffect(() => {
    // État initial
    setOffline(!navigator.onLine)
    setPending(getPendingCount())

    const handleOffline = () => { setOffline(true); setSynced(false) }
    const handleOnline  = async () => {
      setOffline(false)
      const count = getPendingCount()
      if (count > 0) {
        setSyncing(true)
        const result = await syncOfflinePresences()
        setSyncing(false)
        if (result.synced > 0) {
          setSynced(true)
          setPending(0)
          setTimeout(() => setSynced(false), 4000)
        }
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
    }
  }, [])

  // Mise à jour du compteur périodiquement
  useEffect(() => {
    const interval = setInterval(() => setPending(getPendingCount()), 5000)
    return () => clearInterval(interval)
  }, [])

  if (!offline && !syncing && !synced) return null

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all
        ${synced
          ? 'bg-emerald-600 text-white'
          : offline
            ? 'bg-slate-900 text-white'
            : 'bg-blue-600 text-white'
        }`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      {synced ? (
        <>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Données synchronisées avec succès.</span>
        </>
      ) : syncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          <span>Synchronisation en cours…</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            Hors ligne
            {pending > 0 && ` · ${pending} présence${pending > 1 ? 's' : ''} en attente`}
          </span>
        </>
      )}
    </div>
  )
}
