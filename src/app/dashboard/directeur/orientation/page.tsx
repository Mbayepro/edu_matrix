'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Search, GraduationCap, CheckCircle, XCircle, Clock, Save, Filter, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'
import ConfirmModal from '@/components/admin/ConfirmModal'

interface Orientation {
  id: string
  eleve_id: string
  eleve_nom: string
  eleve_prenom: string
  classe_actuelle_id: string
  classe_actuelle_nom: string
  niveau_actuel_id: string
  niveau_actuel_nom: string
  decision: 'passe' | 'redouble' | 'attente'
  niveau_suivant_id?: string | null
  niveau_suivant_nom?: string
  annee_scolaire_id: string
  annee_scolaire_nom: string
  motif?: string | null
  date_decision: string
  ecole_id?: string | null
  created_at: string
}

interface Classe {
  id: string
  nom: string
  niveau_id: string
}

interface Niveau {
  id: string
  nom: string
  code: string
  ordre: number
}

export default function GestionOrientation() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const [orientations, setOrientations] = useState<Orientation[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [niveaux, setNiveaux] = useState<Niveau[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('')
  
  // Modal states
  const [orientationModal, setOrientationModal] = useState<{ isOpen: boolean, orientation: Orientation | null }>({ isOpen: false, orientation: null })
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant: 'danger' | 'warning' | 'info'
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' })

  useEffect(() => {
    if (profile?.ecole_id) {
      loadData()
    }
  }, [profile])

  async function loadData() {
    if (!profile?.ecole_id) return

    try {
      const [orientationsData, classesData, niveauxData] = await Promise.all([
        (supabase.from('orientations' as any) as any)
          .select(`
            *,
            eleve:eleves(nom, prenom),
            classe_actuelle:classes(nom),
            niveau_actuel:niveaux(nom),
            niveau_suivant:niveaux(nom),
            annee_scolaire:annees_scolaires(nom)
          `)
          .eq('ecole_id', profile.ecole_id)
          .order('created_at', { ascending: false }),
        (supabase.from('classes' as any) as any)
          .select('id, nom, niveau_id')
          .eq('ecole_id', profile.ecole_id),
        (supabase.from('niveaux' as any) as any)
          .select('id, nom, code, ordre')
          .eq('ecole_id', profile.ecole_id)
          .order('ordre')
      ])

      const formattedOrientations = (orientationsData?.data || []).map((o: any) => ({
        id: o.id,
        eleve_id: o.eleve_id,
        eleve_nom: o.eleve?.nom || '',
        eleve_prenom: o.eleve?.prenom || '',
        classe_actuelle_id: o.classe_actuelle_id,
        classe_actuelle_nom: o.classe_actuelle?.nom,
        niveau_actuel_id: o.niveau_actuel_id,
        niveau_actuel_nom: o.niveau_actuel?.nom,
        decision: o.decision,
        niveau_suivant_id: o.niveau_suivant_id,
        niveau_suivant_nom: o.niveau_suivant?.nom,
        annee_scolaire_id: o.annee_scolaire_id,
        annee_scolaire_nom: o.annee_scolaire?.nom,
        motif: o.motif,
        date_decision: o.date_decision,
        ecole_id: o.ecole_id,
        created_at: o.created_at
      }))

      setOrientations(formattedOrientations)
      setClasses(classesData?.data || [])
      setNiveaux(niveauxData?.data || [])
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveOrientation(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const orientationData = {
      eleve_id: formData.get('eleve_id') as string,
      classe_actuelle_id: formData.get('classe_actuelle_id') as string,
      niveau_actuel_id: formData.get('niveau_actuel_id') as string,
      decision: formData.get('decision') as 'passe' | 'redouble' | 'attente',
      niveau_suivant_id: formData.get('niveau_suivant_id') as string || null,
      annee_scolaire_id: formData.get('annee_scolaire_id') as string,
      motif: formData.get('motif') as string || null,
      date_decision: new Date().toISOString(),
      ecole_id: profile?.ecole_id
    }

    try {
      if (orientationModal.orientation) {
        const { error } = await (supabase.from('orientations' as any) as any)
          .update(orientationData as any)
          .eq('id', orientationModal.orientation.id)
        if (error) throw error
        setOrientations(orientations.map(o => o.id === orientationModal.orientation!.id ? { ...o, ...orientationData } : o))
      } else {
        const { data, error } = await (supabase.from('orientations' as any) as any)
          .insert([orientationData] as any)
          .select()
        if (error) throw error
        setOrientations([...orientations, data[0]])
      }
      setOrientationModal({ isOpen: false, orientation: null })
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  async function deleteOrientation(orientation: Orientation) {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer la décision',
      message: `Voulez-vous vraiment supprimer la décision d'orientation pour ${orientation.eleve_prenom} ${orientation.eleve_nom} ?`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('orientations' as any) as any).delete().eq('id', orientation.id)
          if (error) throw error
          setOrientations(orientations.filter(o => o.id !== orientation.id))
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: 'danger'
    })
  }

  const filteredOrientations = orientations.filter(o => {
    const matchesSearch = 
      o.eleve_nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.eleve_prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.classe_actuelle_nom?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDecision = !decisionFilter || o.decision === decisionFilter
    return matchesSearch && matchesDecision
  })

  const decisionLabels = {
    passe: 'Passe',
    redouble: 'Redouble',
    attente: 'En attente'
  }

  const decisionColors = {
    passe: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    redouble: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    attente: 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
  }

  const decisionIcons = {
    passe: <CheckCircle className="w-3 h-3" />,
    redouble: <RefreshCw className="w-3 h-3" />,
    attente: <Clock className="w-3 h-3" />
  }

  if (profileLoading || loading) {
    return <div className="p-8 text-slate-400">Chargement des orientations...</div>
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
          <h1 className="text-2xl font-bold text-white">Gestion des Redoublements et Passages</h1>
          <p className="text-slate-400">Décisions d'orientation en fin d'année scolaire</p>
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
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">Toutes les décisions</option>
            <option value="passe">Passe</option>
            <option value="redouble">Redouble</option>
            <option value="attente">En attente</option>
          </select>
        </div>

        <button
          onClick={() => setOrientationModal({ isOpen: true, orientation: null })}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <GraduationCap className="w-4 h-4" />
          Nouvelle décision
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Passent</p>
              <p className="text-xl font-bold text-white">
                {orientations.filter(o => o.decision === 'passe').length}
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
              <p className="text-slate-400 text-sm">Redoublent</p>
              <p className="text-xl font-bold text-white">
                {orientations.filter(o => o.decision === 'redouble').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">En attente</p>
              <p className="text-xl font-bold text-white">
                {orientations.filter(o => o.decision === 'attente').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orientations Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-300 font-medium">
              <tr>
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">Classe actuelle</th>
                <th className="px-4 py-3">Niveau actuel</th>
                <th className="px-4 py-3">Décision</th>
                <th className="px-4 py-3">Niveau suivant</th>
                <th className="px-4 py-3">Année scolaire</th>
                <th className="px-4 py-3">Date décision</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredOrientations.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
                        {o.eleve_prenom?.charAt(0)}{o.eleve_nom?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{o.eleve_prenom} {o.eleve_nom}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{o.classe_actuelle_nom}</td>
                  <td className="px-4 py-3 text-slate-400">{o.niveau_actuel_nom}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${decisionColors[o.decision]}`}>
                      {decisionIcons[o.decision]}
                      {decisionLabels[o.decision]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{o.niveau_suivant_nom || '-'}</td>
                  <td className="px-4 py-3 text-slate-400">{o.annee_scolaire_nom}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(o.date_decision).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[150px] truncate">
                    {o.motif || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteOrientation(o)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-800">
          {filteredOrientations.map((o) => (
            <div key={o.id} className="p-4 space-y-3 hover:bg-slate-800/30 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold">
                    {o.eleve_prenom?.charAt(0)}{o.eleve_nom?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{o.eleve_prenom} {o.eleve_nom}</p>
                    <p className="text-sm text-slate-400">{o.classe_actuelle_nom}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${decisionColors[o.decision]}`}>
                  {decisionIcons[o.decision]}
                  {decisionLabels[o.decision]}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Niveau actuel</p>
                  <p className="text-white">{o.niveau_actuel_nom}</p>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Niveau suivant</p>
                  <p className="text-white">{o.niveau_suivant_nom || '-'}</p>
                </div>
              </div>

              {o.motif && (
                <div className="text-xs text-slate-400">
                  <span className="font-medium">Motif:</span> {o.motif}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredOrientations.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            Aucune décision d'orientation trouvée
          </div>
        )}
      </div>

      {/* Orientation Modal */}
      {orientationModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">
                {orientationModal.orientation ? 'Modifier' : 'Nouvelle'} décision d'orientation
              </h3>
            </div>
            
            <form onSubmit={saveOrientation} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">ID Élève</label>
                <input
                  name="eleve_id"
                  type="text"
                  defaultValue={orientationModal.orientation?.eleve_id}
                  placeholder="ID de l'élève"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Classe actuelle</label>
                <select
                  name="classe_actuelle_id"
                  defaultValue={orientationModal.orientation?.classe_actuelle_id}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                >
                  <option value="">Sélectionner une classe</option>
                  {classes.map((classe) => (
                    <option key={classe.id} value={classe.id}>
                      {classe.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Niveau actuel</label>
                <select
                  name="niveau_actuel_id"
                  defaultValue={orientationModal.orientation?.niveau_actuel_id}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                >
                  <option value="">Sélectionner un niveau</option>
                  {niveaux.map((niveau) => (
                    <option key={niveau.id} value={niveau.id}>
                      {niveau.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Décision</label>
                <select
                  name="decision"
                  defaultValue={orientationModal.orientation?.decision || 'passe'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                >
                  <option value="passe">Passe</option>
                  <option value="redouble">Redouble</option>
                  <option value="attente">En attente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Niveau suivant (si passe)</label>
                <select
                  name="niveau_suivant_id"
                  defaultValue={orientationModal.orientation?.niveau_suivant_id || ''}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Sélectionner un niveau</option>
                  {niveaux.map((niveau) => (
                    <option key={niveau.id} value={niveau.id}>
                      {niveau.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Motif (optionnel)</label>
                <textarea
                  name="motif"
                  defaultValue={orientationModal.orientation?.motif || ''}
                  placeholder="Motif de la décision..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  rows={2}
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setOrientationModal({ isOpen: false, orientation: null })}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  )
}
