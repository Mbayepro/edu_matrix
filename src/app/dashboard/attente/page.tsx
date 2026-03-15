'use client'

// src/app/dashboard/attente/page.tsx
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ecole, Profile } from '@/lib/supabase'
import { Clock, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PendingDirectorPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ecole, setEcole] = useState<Ecole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      if (prof.ecole_id) {
        const { data: ec } = await supabase
          .from('ecoles')
          .select('*')
          .eq('id', prof.ecole_id)
          .single()
        
        setEcole(ec)
        
        // If the school is actually active, redirect them to the real dashboard
        if (ec?.statut === 'actif') {
          router.push('/dashboard')
          return
        }
      } else {
        // No school attached yet (maybe trigger failed or didn't finish)
        // Handled as pending too for safety
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-slate-900 rounded-2xl p-8 sm:p-10 border border-slate-800 shadow-2xl text-center">
          
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/10 rounded-full mb-6">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            En attente de validation
          </h1>

          <div className="text-slate-400 mb-8 space-y-4 text-sm sm:text-base">
            <p>
              Bonjour <strong className="text-white">{profile?.prenom}</strong>,
            </p>
            {ecole ? (
              <p>
                Votre établissement <strong className="text-white">{ecole.nom}</strong> ({ecole.ville}) a bien été enregistré. 
                Cependant, son statut est actuellement <span className="text-amber-400 font-semibold px-2 py-0.5 bg-amber-400/10 rounded">en attente</span>.
              </p>
            ) : (
              <p>
                Votre compte a été créé. Le Super Administrateur doit finaliser l'association à votre établissement.
              </p>
            )}
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-left mt-6">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" /> Pourquoi ce message ?
              </h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Pour garantir la sécurité de la plateforme, chaque nouvelle école doit être vérifiée manuellement.</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Le Super Administrateur a été notifié de votre inscription.</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Ce processus prend généralement moins de 24h ouvrées.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => loadStatus()}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-all"
            >
              Vérifier le statut
            </button>
            <button
              onClick={handleLogout}
              className="sm:w-auto w-full bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700 hover:border-red-500/30"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
