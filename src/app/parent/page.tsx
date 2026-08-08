'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, ArrowRight, ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ParentLoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const trimmedPin = pin.trim()
    if (!trimmedPin) return

    setLoading(true)
    
    try {
      // Check if PIN exists
      const { data, error: err } = await supabase.rpc('get_eleve_by_pin', { p_pin: trimmedPin })
      
      if (err || !data) {
        setError('Code PIN invalide. Veuillez vérifier et réessayer.')
        setLoading(false)
        return
      }

      // Valid PIN, redirect to the parent dashboard
      router.push(`/p/${trimmedPin}`)
    } catch (err) {
      setError('Une erreur est survenue lors de la vérification.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <Link href="/" className="flex items-center gap-3 mb-8 group">
        <div className="bg-emerald-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <span className="font-black text-2xl tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">
          EduMatrix
        </span>
      </Link>

      <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 w-full max-w-md relative overflow-hidden">
        {/* Décoration */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-amber-500" />
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-900 mb-2">Espace Parent</h1>
          <p className="text-sm font-medium text-slate-500">
            Saisissez le code PIN de votre enfant pour accéder à son dossier (notes, absences, paiement).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pin" className="block text-sm font-bold text-slate-700 mb-2">
              Code PIN Sécurisé
            </label>
            <input
              id="pin"
              type="password"
              placeholder="Ex: 123456"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-medium placeholder:text-base"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl text-sm font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-emerald-600 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5 group"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Accéder au dossier
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Connexion cryptée et sécurisée
        </div>
      </div>
    </div>
  )
}
