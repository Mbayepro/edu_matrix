'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ecole, Profile } from '@/lib/supabase'
import {
  ShieldAlert, School, Search, MoreVertical,
  CheckCircle, XCircle, Clock, Loader2, User, Phone, MapPin
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EcoleMembres extends Ecole {
  directeur?: Profile
}

export default function ValidationAdminPage() {
  const router = useRouter()
  const [ecoles, setEcoles] = useState<EcoleMembres[]>([])
  const [loading, setLoading] = useState(true)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [errorBtn, setErrorBtn] = useState<string | null>(null)

  useEffect(() => {
    loadEnAttente()
  }, [])

  async function loadEnAttente() {
    try {
      // 1. Check superadmin role
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      
      if (prof?.role !== 'superadmin') {
        router.push('/dashboard')
        return
      }

      // 2. Load schools en attente
      const { data: enAttente, error: ee } = await supabase
        .from('ecoles')
        .select('*')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false })

      if (ee) throw ee

      // 3. For each school, load the director (first profile with director role)
      if (enAttente && enAttente.length > 0) {
        const enriched = await Promise.all(
          enAttente.map(async (ec: Ecole) => {
            const { data: dir } = await supabase
              .from('profiles')
              .select('*')
              .eq('ecole_id', ec.id)
              .eq('role', 'director')
              .limit(1)
              .single()
            return { ...ec, directeur: dir || undefined }
          })
        )
        setEcoles(enriched)
      } else {
        setEcoles([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function validerEcole(ecoleId: string) {
    setValidatingId(ecoleId)
    setErrorBtn(null)
    try {
      const { error } = await supabase
        .from('ecoles')
        .update({ statut: 'actif' })
        .eq('id', ecoleId)

      if (error) throw error

      // Remove from list
      setEcoles((prev) => prev.filter((e) => e.id !== ecoleId))
    } catch (err: any) {
      console.error(err)
      setErrorBtn('Erreur lors de la validation')
    } finally {
      setValidatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-slate-400 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p>Chargement des demandes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Validation des Écoles</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            Examinez et approuvez les nouvelles demandes d'inscription.
          </p>
        </div>
        <div className="relative bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-xl px-5 py-3 flex items-center gap-4 shadow-lg">
          <div>
            <p className="text-2xl font-bold text-amber-400 leading-none">{ecoles.length}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1 font-semibold">En attente</p>
          </div>
          <div className="w-10 h-10 bg-amber-400/10 rounded-full flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
        </div>
      </div>

      {errorBtn && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <span>⚠️</span> {errorBtn}
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {ecoles.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl p-12 border border-slate-800 text-center shadow-sm">
            <div className="inline-flex w-16 h-16 bg-slate-800 rounded-full items-center justify-center mb-4 border border-slate-700">
              <CheckCircle className="w-8 h-8 text-emerald-500/50" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Tout est à jour</h3>
            <p className="text-slate-400 text-sm">Aucune demande d'inscription en attente de validation.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {ecoles.map((ecole) => (
              <div key={ecole.id} className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700 transition-all group flex flex-col justify-between">
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                      <School className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">
                        {ecole.nom}
                      </h3>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {ecole.ville}
                      </p>
                    </div>
                  </div>
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    En attente
                  </span>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-5 relative flex-1">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Informations de contact</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <User className="w-4 h-4 text-emerald-500/70" />
                      <span className="font-medium text-white">
                        {ecole.directeur ? `${ecole.directeur.prenom} ${ecole.directeur.nom}` : 'Non assigné'}
                      </span>
                      {ecole.directeur && <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 ml-1">Directeur</span>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Phone className="w-4 h-4 text-slate-500" />
                      {ecole.telephone || 'Non renseigné'}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-4 text-right">
                    Créée le {new Date(ecole.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/50">
                  <button
                    disabled={validatingId === ecole.id}
                    onClick={() => validerEcole(ecole.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold py-2 px-6 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {validatingId === ecole.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Valider le compte
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
