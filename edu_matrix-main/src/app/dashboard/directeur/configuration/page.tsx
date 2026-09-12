'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, Plus, Edit, Trash2, CheckCircle, XCircle, Clock, Save } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import ConfirmModal from '@/components/admin/ConfirmModal'

interface AnneeScolaire {
  id: string
  nom: string
  date_debut: string
  date_fin: string
  statut: 'active' | 'clôturée' | 'brouillon'
  ecole_id?: string | null
  created_at: string
}

interface Trimestre {
  id: string
  nom: string
  date_debut: string
  date_fin: string
  annee_scolaire_id?: string | null
  ordre: number
}

export default function ConfigurationAnneeScolaire() {
  const { profile, loading: profileLoading } = useProfile()
  const [annees, setAnnees] = useState<AnneeScolaire[]>([])
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAnnee, setActiveAnnee] = useState<AnneeScolaire | null>(null)
  
  // Modal states
  const [anneeModal, setAnneeModal] = useState<{ isOpen: boolean, annee: AnneeScolaire | null }>({ isOpen: false, annee: null })
  const [trimestreModal, setTrimestreModal] = useState<{ isOpen: boolean, trimestre: Trimestre | null }>({ isOpen: false, trimestre: null })
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
      const [anneesData, trimestresData] = await Promise.all([
        (supabase.from('annees_scolaires' as any) as any)
          .select('*')
          .eq('ecole_id', profile.ecole_id)
          .order('created_at', { ascending: false }),
        (supabase.from('trimestres' as any) as any)
          .select('*')
          .eq('ecole_id', profile.ecole_id)
          .order('ordre', { ascending: true })
      ])

      setAnnees(anneesData?.data || [])
      setTrimestres(trimestresData?.data || [])
      
      const active = anneesData?.data?.find((a: AnneeScolaire) => a.statut === 'active')
      setActiveAnnee(active || null)
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  async function setActiveAnneeStatus(annee: AnneeScolaire, newStatus: 'active' | 'clôturée') {
    setConfirmModal({
      isOpen: true,
      title: newStatus === 'active' ? 'Activer l\'année scolaire' : 'Clôturer l\'année scolaire',
      message: `Voulez-vous vraiment ${newStatus === 'active' ? 'activer' : 'clôturer'} l'année scolaire "${annee.nom}" ?`,
      onConfirm: async () => {
        try {
          // Si on active une nouvelle année, désactiver l'ancienne
          if (newStatus === 'active' && activeAnnee) {
            await (supabase.from('annees_scolaires' as any) as any)
              .update({ statut: 'clôturée' } as any)
              .eq('id', activeAnnee.id)
          }

          const { error } = await (supabase.from('annees_scolaires' as any) as any)
            .update({ statut: newStatus } as any)
            .eq('id', annee.id)

          if (error) throw error
          
          setAnnees(annees.map(a => a.id === annee.id ? { ...a, statut: newStatus } : a))
          if (newStatus === 'active') {
            setActiveAnnee(annee)
          } else {
            setActiveAnnee(null)
          }
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: newStatus === 'active' ? 'info' : 'warning'
    })
  }

  async function deleteAnnee(annee: AnneeScolaire) {
    if (annee.statut === 'active') {
      alert('Impossible de supprimer une année scolaire active.')
      return
    }

    setConfirmModal({
      isOpen: true,
      title: 'Supprimer l\'année scolaire',
      message: `ATTENTION: La suppression de l'année scolaire "${annee.nom}" est irréversible. Toutes les données liées seront supprimées.`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('annees_scolaires' as any) as any).delete().eq('id', annee.id)
          if (error) throw error
          
          setAnnees(annees.filter(a => a.id !== annee.id))
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: 'danger'
    })
  }

  async function saveAnnee(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const anneeData = {
      nom: formData.get('nom') as string,
      date_debut: formData.get('date_debut') as string,
      date_fin: formData.get('date_fin') as string,
      ecole_id: profile?.ecole_id
    }

    try {
      if (anneeModal.annee) {
        const { error } = await (supabase.from('annees_scolaires' as any) as any)
          .update(anneeData as any)
          .eq('id', anneeModal.annee.id)
        if (error) throw error
        setAnnees(annees.map(a => a.id === anneeModal.annee!.id ? { ...a, ...anneeData } : a))
      } else {
        const { data, error } = await (supabase.from('annees_scolaires' as any) as any)
          .insert([{ ...anneeData, statut: 'brouillon' }] as any)
          .select()
        if (error) throw error
        setAnnees([...annees, data[0]])
      }
      setAnneeModal({ isOpen: false, annee: null })
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  async function saveTrimestre(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const trimestreData = {
      nom: formData.get('nom') as string,
      date_debut: formData.get('date_debut') as string,
      date_fin: formData.get('date_fin') as string,
      annee_scolaire_id: activeAnnee?.id,
      ecole_id: profile?.ecole_id,
      ordre: parseInt(formData.get('ordre') as string) || 1
    }

    try {
      if (trimestreModal.trimestre) {
        const { error } = await (supabase.from('trimestres' as any) as any)
          .update(trimestreData as any)
          .eq('id', trimestreModal.trimestre.id)
        if (error) throw error
        setTrimestres(trimestres.map(t => t.id === trimestreModal.trimestre!.id ? { ...t, ...trimestreData } : t))
      } else {
        const { data, error } = await (supabase.from('trimestres' as any) as any)
          .insert([trimestreData] as any)
          .select()
        if (error) throw error
        setTrimestres([...trimestres, data[0]])
      }
      setTrimestreModal({ isOpen: false, trimestre: null })
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  async function deleteTrimestre(trimestre: Trimestre) {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer le trimestre',
      message: `Voulez-vous vraiment supprimer le trimestre "${trimestre.nom}" ?`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('trimestres' as any) as any).delete().eq('id', trimestre.id)
          if (error) throw error
          setTrimestres(trimestres.filter(t => t.id !== trimestre.id))
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: 'danger'
    })
  }

  if (profileLoading || loading) {
    return <div className="p-8 text-slate-400">Chargement de la configuration...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuration Année Scolaire</h1>
        <p className="text-slate-400">Gérez les années scolaires et les trimestres de votre établissement</p>
      </div>

      {/* Active Year Banner */}
      {activeAnnee ? (
        <div className="bg-emerald-600/10 border border-emerald-600/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-white font-medium">Année active : {activeAnnee.nom}</p>
              <p className="text-sm text-slate-400">
                {new Date(activeAnnee.date_debut).toLocaleDateString('fr-FR')} - {new Date(activeAnnee.date_fin).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveAnneeStatus(activeAnnee, 'clôturée')}
            className="px-4 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-sm font-medium"
          >
            Clôturer
          </button>
        </div>
      ) : (
        <div className="bg-amber-600/10 border border-amber-600/20 rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400" />
          <p className="text-amber-400">Aucune année scolaire active. Veuillez en activer une.</p>
        </div>
      )}

      {/* Années Scolaires */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Années Scolaires</h2>
          <button
            onClick={() => setAnneeModal({ isOpen: true, annee: null })}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouvelle année
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          {annees.map((annee) => (
            <div key={annee.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  annee.statut === 'active' 
                    ? 'bg-emerald-500/10' 
                    : annee.statut === 'clôturée'
                    ? 'bg-slate-500/10'
                    : 'bg-amber-500/10'
                }`}>
                  <Calendar className={`w-5 h-5 ${
                    annee.statut === 'active'
                      ? 'text-emerald-400'
                      : annee.statut === 'clôturée'
                      ? 'text-slate-400'
                      : 'text-amber-400'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-white">{annee.nom}</p>
                  <p className="text-sm text-slate-400">
                    {new Date(annee.date_debut).toLocaleDateString('fr-FR')} - {new Date(annee.date_fin).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {annee.statut !== 'active' && (
                  <button
                    onClick={() => setActiveAnneeStatus(annee, 'active')}
                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-sm font-medium"
                  >
                    Activer
                  </button>
                )}
                <button
                  onClick={() => setAnneeModal({ isOpen: true, annee })}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteAnnee(annee)}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trimestres */}
      {activeAnnee && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Trimestres - {activeAnnee.nom}</h2>
            <button
              onClick={() => setTrimestreModal({ isOpen: true, trimestre: null })}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouveau trimestre
            </button>
          </div>

          <div className="divide-y divide-slate-800">
            {trimestres
              .filter(t => t.annee_scolaire_id === activeAnnee.id)
              .sort((a, b) => a.ordre - b.ordre)
              .map((trimestre) => (
              <div key={trimestre.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-sm">
                    {trimestre.ordre}
                  </div>
                  <div>
                    <p className="font-medium text-white">{trimestre.nom}</p>
                    <p className="text-sm text-slate-400">
                      {new Date(trimestre.date_debut).toLocaleDateString('fr-FR')} - {new Date(trimestre.date_fin).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTrimestreModal({ isOpen: true, trimestre })}
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTrimestre(trimestre)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Année Modal */}
      {anneeModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">
                {anneeModal.annee ? 'Modifier' : 'Nouvelle'} année scolaire
              </h3>
            </div>
            
            <form onSubmit={saveAnnee} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom</label>
                <input
                  name="nom"
                  type="text"
                  defaultValue={anneeModal.annee?.nom}
                  placeholder="Ex: 2025-2026"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Date de début</label>
                <input
                  name="date_debut"
                  type="date"
                  defaultValue={anneeModal.annee?.date_debut}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Date de fin</label>
                <input
                  name="date_fin"
                  type="date"
                  defaultValue={anneeModal.annee?.date_fin}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setAnneeModal({ isOpen: false, annee: null })}
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

      {/* Trimestre Modal */}
      {trimestreModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">
                {trimestreModal.trimestre ? 'Modifier' : 'Nouveau'} trimestre
              </h3>
            </div>
            
            <form onSubmit={saveTrimestre} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom</label>
                <input
                  name="nom"
                  type="text"
                  defaultValue={trimestreModal.trimestre?.nom}
                  placeholder="Ex: 1er Trimestre"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Ordre</label>
                <input
                  name="ordre"
                  type="number"
                  min="1"
                  max="3"
                  defaultValue={trimestreModal.trimestre?.ordre || 1}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Date de début</label>
                <input
                  name="date_debut"
                  type="date"
                  defaultValue={trimestreModal.trimestre?.date_debut}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Date de fin</label>
                <input
                  name="date_fin"
                  type="date"
                  defaultValue={trimestreModal.trimestre?.date_fin}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setTrimestreModal({ isOpen: false, trimestre: null })}
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
