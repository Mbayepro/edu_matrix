'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, Save, Layers, ArrowUp, ArrowDown } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import ConfirmModal from '@/components/admin/ConfirmModal'

interface Niveau {
  id: string
  nom: string
  code: string
  ordre: number
  cycle: 'primaire' | 'college' | 'lycee'
  ecole_id: string
  actif: boolean
  created_at: string
}

const NIVEAUX_PRIMAIRE = [
  { nom: 'CI', code: 'CI', ordre: 1 },
  { nom: 'CP', code: 'CP', ordre: 2 },
  { nom: 'CE1', code: 'CE1', ordre: 3 },
  { nom: 'CE2', code: 'CE2', ordre: 4 },
  { nom: 'CM1', code: 'CM1', ordre: 5 },
  { nom: 'CM2', code: 'CM2', ordre: 6 },
]

export default function GestionNiveaux() {
  const { profile, loading: profileLoading } = useProfile()
  const [niveaux, setNiveaux] = useState<Niveau[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [niveauModal, setNiveauModal] = useState<{ isOpen: boolean, niveau: Niveau | null }>({ isOpen: false, niveau: null })
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
      const { data } = await (supabase.from('niveaux' as any) as any)
        .select('*')
        .eq('ecole_id', profile.ecole_id)
        .order('ordre', { ascending: true })

      setNiveaux(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  async function initializeNiveauxPrimaire() {
    setConfirmModal({
      isOpen: true,
      title: 'Initialiser les niveaux primaires',
      message: 'Voulez-vous initialiser les niveaux standards du primaire (CI à CM2) pour votre école ?',
      onConfirm: async () => {
        try {
          const niveauxToInsert = NIVEAUX_PRIMAIRE.map(n => ({
            nom: n.nom,
            code: n.code,
            ordre: n.ordre,
            cycle: 'primaire' as const,
            ecole_id: profile?.ecole_id,
            actif: true
          }))

          const { error } = await (supabase.from('niveaux' as any) as any)
            .insert(niveauxToInsert as any)

          if (error) throw error
          
          await loadData()
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: 'info'
    })
  }

  async function toggleNiveauStatut(niveau: Niveau) {
    try {
      const { error } = await (supabase.from('niveaux' as any) as any)
        .update({ actif: !niveau.actif } as any)
        .eq('id', niveau.id)

      if (error) throw error
      
      setNiveaux(niveaux.map(n => n.id === niveau.id ? { ...n, actif: !niveau.actif } : n))
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  async function deleteNiveau(niveau: Niveau) {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer le niveau',
      message: `ATTENTION: La suppression du niveau "${niveau.nom}" est irréversible. Les classes associées devront être réassignées.`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('niveaux' as any) as any).delete().eq('id', niveau.id)
          if (error) throw error
          
          setNiveaux(niveaux.filter(n => n.id !== niveau.id))
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: 'danger'
    })
  }

  async function moveNiveau(niveau: Niveau, direction: 'up' | 'down') {
    const currentIndex = niveaux.findIndex(n => n.id === niveau.id)
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (newIndex < 0 || newIndex >= niveaux.length) return

    const updatedNiveaux = [...niveaux]
    const temp = updatedNiveaux[currentIndex].ordre
    updatedNiveaux[currentIndex].ordre = updatedNiveaux[newIndex].ordre
    updatedNiveaux[newIndex].ordre = temp

    try {
      await Promise.all([
        (supabase.from('niveaux' as any) as any)
          .update({ ordre: updatedNiveaux[currentIndex].ordre } as any)
          .eq('id', updatedNiveaux[currentIndex].id),
        (supabase.from('niveaux' as any) as any)
          .update({ ordre: updatedNiveaux[newIndex].ordre } as any)
          .eq('id', updatedNiveaux[newIndex].id)
      ])

      setNiveaux(updatedNiveaux.sort((a, b) => a.ordre - b.ordre))
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  async function saveNiveau(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const niveauData = {
      nom: formData.get('nom') as string,
      code: formData.get('code') as string,
      ordre: parseInt(formData.get('ordre') as string) || niveaux.length + 1,
      cycle: formData.get('cycle') as 'primaire' | 'college' | 'lycee',
      ecole_id: profile?.ecole_id,
      actif: true
    }

    try {
      if (niveauModal.niveau) {
        const { error } = await (supabase.from('niveaux' as any) as any)
          .update(niveauData as any)
          .eq('id', niveauModal.niveau.id)
        if (error) throw error
        setNiveaux(niveaux.map(n => n.id === niveauModal.niveau!.id ? { ...n, ...niveauData } : n))
      } else {
        const { data, error } = await (supabase.from('niveaux' as any) as any)
          .insert([niveauData] as any)
          .select()
        if (error) throw error
        setNiveaux([...niveaux, data[0]])
      }
      setNiveauModal({ isOpen: false, niveau: null })
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  if (profileLoading || loading) {
    return <div className="p-8 text-slate-400">Chargement des niveaux...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Gestion des Niveaux Scolaires</h1>
        <p className="text-slate-400">Configurez les niveaux de votre établissement (CI à CM2 pour le primaire)</p>
      </div>

      {/* Empty State */}
      {niveaux.length === 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <Layers className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aucun niveau configuré</h3>
          <p className="text-slate-400 mb-6">Commencez par initialiser les niveaux standards du primaire</p>
          <button
            onClick={initializeNiveauxPrimaire}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            Initialiser CI à CM2
          </button>
        </div>
      )}

      {/* Niveaux List */}
      {niveaux.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Niveaux configurés</h2>
            <button
              onClick={() => setNiveauModal({ isOpen: true, niveau: null })}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouveau niveau
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="divide-y divide-slate-800">
              {niveaux.map((niveau, index) => (
                <div key={niveau.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveNiveau(niveau, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => moveNiveau(niveau, 'down')}
                        disabled={index === niveaux.length - 1}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-white font-bold">
                      {niveau.code}
                    </div>
                    <div>
                      <p className="font-medium text-white">{niveau.nom}</p>
                      <p className="text-sm text-slate-400 capitalize">{niveau.cycle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleNiveauStatut(niveau)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        niveau.actif
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                      }`}
                    >
                      {niveau.actif ? 'Actif' : 'Inactif'}
                    </button>
                    <button
                      onClick={() => setNiveauModal({ isOpen: true, niveau })}
                      className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteNiveau(niveau)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Niveau Modal */}
      {niveauModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">
                {niveauModal.niveau ? 'Modifier' : 'Nouveau'} niveau
              </h3>
            </div>
            
            <form onSubmit={saveNiveau} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom</label>
                <input
                  name="nom"
                  type="text"
                  defaultValue={niveauModal.niveau?.nom}
                  placeholder="Ex: CM2"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Code</label>
                <input
                  name="code"
                  type="text"
                  defaultValue={niveauModal.niveau?.code}
                  placeholder="Ex: CM2"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Cycle</label>
                <select
                  name="cycle"
                  defaultValue={niveauModal.niveau?.cycle || 'primaire'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                >
                  <option value="primaire">Primaire</option>
                  <option value="college">Collège</option>
                  <option value="lycee">Lycée</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Ordre</label>
                <input
                  name="ordre"
                  type="number"
                  min="1"
                  defaultValue={niveauModal.niveau?.ordre || niveaux.length + 1}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setNiveauModal({ isOpen: false, niveau: null })}
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
