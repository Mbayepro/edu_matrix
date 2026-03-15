'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Settings
} from 'lucide-react'

interface Ecole {
  id: string
  nom: string
  ville: string
  telephone: string | null
  email: string | null
  statut: 'en_attente' | 'actif' | 'suspendu'
  created_at: string
}

export default function AdminEcolesPage() {
  const router = useRouter()
  const [ecoles, setEcoles] = useState<Ecole[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    checkSuperAdmin()
  }, [])

  async function checkSuperAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      router.push('/dashboard')
      return
    }

    loadEcoles()
  }

  async function loadEcoles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ecoles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setEcoles(data as Ecole[])
    }
    setLoading(false)
  }

  async function updateStatut(ecoleId: string, newStatut: 'actif' | 'suspendu' | 'en_attente') {
    setUpdating(ecoleId)
    const { error } = await supabase
      .from('ecoles')
      .update({ statut: newStatut })
      .eq('id', ecoleId)

    if (!error) {
      setEcoles(prev => prev.map(e => e.id === ecoleId ? { ...e, statut: newStatut } : e))
    }
    setUpdating(null)
  }

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'actif':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Actif</span>
      case 'suspendu':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3.5 h-3.5" /> Suspendu</span>
      case 'en_attente':
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock className="w-3.5 h-3.5" /> En attente</span>
    }
  }

  const filteredEcoles = ecoles.filter(e => 
    e.nom.toLowerCase().includes(search.toLowerCase()) || 
    (e.ville && e.ville.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <Building2 className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestion des Écoles</h1>
            <p className="text-sm text-slate-500">Supervision de tous les établissements partenaires</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une école..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="text-sm font-medium text-slate-600">
            Total: {filteredEcoles.length} école(s)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Établissement</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Inscription</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEcoles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    Aucune école trouvée avec ces critères.
                  </td>
                </tr>
              ) : (
                filteredEcoles.map((ecole) => (
                  <tr key={ecole.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{ecole.nom}</div>
                      <div className="text-sm text-slate-500">{ecole.ville || 'Ville non précisée'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-800">{ecole.email || '—'}</div>
                      <div className="text-sm text-slate-500">{ecole.telephone || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-800">
                        {new Date(ecole.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatutBadge(ecole.statut)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {updating === ecole.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                        ) : (
                          <>
                            {ecole.statut !== 'actif' && (
                              <button
                                onClick={() => updateStatut(ecole.id, 'actif')}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                                title="Activer l'école"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            {ecole.statut !== 'suspendu' && (
                              <button
                                onClick={() => updateStatut(ecole.id, 'suspendu')}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                title="Suspendre l'école"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                            {ecole.statut !== 'en_attente' && (
                              <button
                                onClick={() => updateStatut(ecole.id, 'en_attente')}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                                title="Mettre en attente"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
