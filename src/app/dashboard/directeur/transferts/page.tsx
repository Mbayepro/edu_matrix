'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Search, Calendar, User, Layers, Filter, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'

interface HistoriqueClasse {
  id: string
  eleve_id: string
  eleve_nom: string
  eleve_prenom: string
  ancienne_classe_id?: string
  ancienne_classe_nom?: string
  nouvelle_classe_id: string
  nouvelle_classe_nom: string
  annee_scolaire_id: string
  annee_scolaire_nom: string
  date_debut: string
  date_fin?: string
  motif?: string
  type: 'transfert' | 'redoublement' | 'passage'
  ecole_id: string
  created_at: string
}

export default function HistoriqueTransferts() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const [historique, setHistorique] = useState<HistoriqueClasse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [anneeFilter, setAnneeFilter] = useState('')

  useEffect(() => {
    if (profile?.ecole_id) {
      loadData()
    }
  }, [profile])

  async function loadData() {
    if (!profile?.ecole_id) return

    try {
      const { data } = await (supabase.from('historique_classes' as any) as any)
        .select(`
          *,
          eleve:eleves(nom, prenom),
          ancienne_classe:classes(nom),
          nouvelle_classe:classes(nom),
          annee_scolaire:annees_scolaires(nom)
        `)
        .eq('ecole_id', profile.ecole_id)
        .order('created_at', { ascending: false })

      const formattedHistorique = (data || []).map((h: any) => ({
        id: h.id,
        eleve_id: h.eleve_id,
        eleve_nom: h.eleve?.nom || '',
        eleve_prenom: h.eleve?.prenom || '',
        ancienne_classe_id: h.ancienne_classe_id,
        ancienne_classe_nom: h.ancienne_classe?.nom,
        nouvelle_classe_id: h.nouvelle_classe_id,
        nouvelle_classe_nom: h.nouvelle_classe?.nom,
        annee_scolaire_id: h.annee_scolaire_id,
        annee_scolaire_nom: h.annee_scolaire?.nom,
        date_debut: h.date_debut,
        date_fin: h.date_fin,
        motif: h.motif,
        type: h.type,
        ecole_id: h.ecole_id,
        created_at: h.created_at
      }))

      setHistorique(formattedHistorique)
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredHistorique = historique.filter(h => {
    const matchesSearch = 
      h.eleve_nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.eleve_prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.nouvelle_classe_nom?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = !typeFilter || h.type === typeFilter
    const matchesAnnee = !anneeFilter || h.annee_scolaire_id === anneeFilter
    return matchesSearch && matchesType && matchesAnnee
  })

  const typeLabels = {
    transfert: 'Transfert',
    redoublement: 'Redoublement',
    passage: 'Passage'
  }

  const typeColors = {
    transfert: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    redoublement: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    passage: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
  }

  if (profileLoading || loading) {
    return <div className="p-8 text-slate-400">Chargement de l'historique...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/directeur')}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Historique des Changements de Classe</h1>
          <p className="text-slate-400">Transferts, redoublements et passages des élèves</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un élève..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-full"
          />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">Tous les types</option>
            <option value="transfert">Transfert</option>
            <option value="redoublement">Redoublement</option>
            <option value="passage">Passage</option>
          </select>
        </div>

        <button
          onClick={loadData}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          title="Actualiser"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Transferts</p>
              <p className="text-xl font-bold text-white">
                {historique.filter(h => h.type === 'transfert').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <RefreshCw className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Redoublements</p>
              <p className="text-xl font-bold text-white">
                {historique.filter(h => h.type === 'redoublement').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Passages</p>
              <p className="text-xl font-bold text-white">
                {historique.filter(h => h.type === 'passage').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Historique Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-300 font-medium">
              <tr>
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ancienne classe</th>
                <th className="px-4 py-3">Nouvelle classe</th>
                <th className="px-4 py-3">Année scolaire</th>
                <th className="px-4 py-3">Date début</th>
                <th className="px-4 py-3">Date fin</th>
                <th className="px-4 py-3">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredHistorique.map((h) => (
                <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
                        {h.eleve_prenom?.charAt(0)}{h.eleve_nom?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{h.eleve_prenom} {h.eleve_nom}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[h.type]}`}>
                      {typeLabels[h.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{h.ancienne_classe_nom || '-'}</td>
                  <td className="px-4 py-3 font-medium text-white">{h.nouvelle_classe_nom}</td>
                  <td className="px-4 py-3 text-slate-400">{h.annee_scolaire_nom}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(h.date_debut).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {h.date_fin ? new Date(h.date_fin).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">
                    {h.motif || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-800">
          {filteredHistorique.map((h) => (
            <div key={h.id} className="p-4 space-y-3 hover:bg-slate-800/30 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold">
                    {h.eleve_prenom?.charAt(0)}{h.eleve_nom?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{h.eleve_prenom} {h.eleve_nom}</p>
                    <p className="text-sm text-slate-400">{h.nouvelle_classe_nom}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[h.type]}`}>
                  {typeLabels[h.type]}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Ancienne classe</p>
                  <p className="text-white">{h.ancienne_classe_nom || '-'}</p>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Date début</p>
                  <p className="text-white">{new Date(h.date_debut).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              {h.motif && (
                <div className="text-xs text-slate-400">
                  <span className="font-medium">Motif:</span> {h.motif}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredHistorique.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            Aucun changement de classe trouvé
          </div>
        )}
      </div>
    </div>
  )
}
