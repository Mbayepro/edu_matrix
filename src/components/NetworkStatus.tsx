'use client'

// src/components/NetworkStatus.tsx
// Badge réseau discret affiché en haut de l'écran
// S'intègre sans casser le composant OfflineBanner existant
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react'
import { useNetwork } from '@/hooks/useNetwork'

export default function NetworkStatus() {
  const { isOnline, justReconnected, pendingCount, isSyncing, lastSyncResult } = useNetwork()
  const [visible, setVisible] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Affiche le badge uniquement quand il y a quelque chose à montrer
  useEffect(() => {
    if (!isOnline || isSyncing || pendingCount > 0) {
      setVisible(true)
      setShowSuccess(false)
    } else if (justReconnected && lastSyncResult && lastSyncResult.flushed > 0) {
      setShowSuccess(true)
      setVisible(true)
      const t = setTimeout(() => { setVisible(false); setShowSuccess(false) }, 4000)
      return () => clearTimeout(t)
    } else if (isOnline && !isSyncing && pendingCount === 0) {
      // On line et rien en attente : on cache après 2s
      const t = setTimeout(() => setVisible(false), 2000)
      return () => clearTimeout(t)
    }
  }, [isOnline, justReconnected, pendingCount, isSyncing, lastSyncResult])

  if (!visible) return null

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
        flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl
        text-sm font-semibold backdrop-blur-sm
        transition-all duration-500 ease-in-out
        ${showSuccess
          ? 'bg-emerald-500/90 text-white border border-emerald-400/40'
          : isSyncing
            ? 'bg-blue-600/90 text-white border border-blue-400/40'
            : !isOnline && pendingCount > 0
              ? 'bg-amber-500/90 text-white border border-amber-400/40'
              : !isOnline
                ? 'bg-rose-600/90 text-white border border-rose-400/40'
                : 'bg-emerald-500/90 text-white border border-emerald-400/40'
        }
      `}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
      role="status"
      aria-live="polite"
    >
      {/* Icône */}
      {showSuccess ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : isSyncing ? (
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
      ) : !isOnline ? (
        <WifiOff className="w-4 h-4 shrink-0" />
      ) : (
        <Wifi className="w-4 h-4 shrink-0" />
      )}

      {/* Texte */}
      <span>
        {showSuccess
          ? `✓ ${lastSyncResult?.flushed} action${lastSyncResult?.flushed !== 1 ? 's' : ''} synchronisée${lastSyncResult?.flushed !== 1 ? 's' : ''}`
          : isSyncing
            ? 'Synchronisation en cours…'
            : !isOnline && pendingCount > 0
              ? `🔴 Hors-ligne · ${pendingCount} en attente`
              : !isOnline
                ? '🔴 Mode Hors-ligne'
                : '🟢 Connecté'
        }
      </span>

      {/* Indicateur d'actions en attente (si online mais sync en cours) */}
      {isOnline && !isSyncing && pendingCount > 0 && !showSuccess && (
        <span className="flex items-center gap-1 text-amber-200">
          <CloudUpload className="w-3.5 h-3.5" />
          {pendingCount}
        </span>
      )}
    </div>
  )
}
