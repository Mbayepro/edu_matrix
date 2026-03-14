'use client'

// src/app/error.tsx
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log en production : remplacer par votre service (ex. Sentry)
    console.error('[EduMatrix Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Icône */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-3xl mx-auto">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>

        {/* Message */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Une erreur est survenue
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Un problème inattendu s'est produit. Vos données sont en sécurité.
            Essayez de recharger la page ou revenez à l'accueil.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 mt-3 font-mono">
              Code : {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                       text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
          <a
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-white border border-slate-200
                       hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Tableau de bord
          </a>
        </div>
      </div>
    </div>
  )
}
