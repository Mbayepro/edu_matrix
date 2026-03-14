// src/app/not-found.tsx
import { GraduationCap, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Page introuvable' }

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative text-center space-y-6 max-w-md">

        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl mx-auto mb-2">
          <GraduationCap className="w-8 h-8 text-emerald-400" />
        </div>

        {/* 404 */}
        <div>
          <p className="text-8xl font-bold text-white/10 leading-none select-none">404</p>
          <h1 className="text-2xl font-bold text-white -mt-4 mb-3">
            Page introuvable
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            La page que vous cherchez n'existe pas ou a été déplacée.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700
                       text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Tableau de bord
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20
                       text-white font-semibold px-6 py-3 rounded-xl transition-colors border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
        </div>
      </div>
    </div>
  )
}
