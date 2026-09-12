'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, Save, Users, GraduationCap, Layers, Search } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import ConfirmModal from '@/components/admin/ConfirmModal'

interface Classe {
  id: string
  nom: string
  niveau_id: string
  niveau_nom: string
  annee_scolaire_id: string
  ecole_id?: string | null
  titulaire_id?: string | null
  titulaire_nom?: string
  eleves_count: number
  enseignants_count: number
  actif: boolean
  created_at: string
}

interface Niveau {
  id: string
  nom: string
  code: string
}

interface Enseignant {
  id: string
  prenom: string
  nom: string
}

interface AnneeScolaire {
  id: string
  nom: string
  statut: string
}

export default function GestionClasses() {
  const { profile, loading: profileLoading } = useProfile()
  const [classes, setClasses] = useState<Classe[]>([])
  const [niveaux, setNiveaux] = useState<Niveau[]>([])
  const [enseignants, setEnseignants] = useState<Enseignant[]>([])
  const [annees, setAnnees] = useState<AnneeScolaire[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal states
  const [classeModal, setClasseModal] = useState<{ isOpen: boolean, classe: Classe | null }>({ isOpen: false, classe: null })
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
      const [classesData, niveauxData, enseignantsData, anneesData] = await Promise.all([
        (supabase.from('classes' as any) as any)
          .select(`
            *,
            niveau:niveaux(nom, code),
            titulaire:profiles(prenom, nom)
          `)
          .eq('ecole_id', profile.ecole_id)
          .order('nom'),
        (supabase.from('niveaux' as any) as any)
          .select('id, nom, code')
          .eq('ecole_id', profile.ecole_id)
          .eq('actif', true)
          .order('ordre'),
        (supabase.from('profiles' as any) as any)
          .select('id, prenom, nom')
          .eq('ecole_id', profile.ecole_id)
          .eq('role', 'teacher')
          .order('nom'),
        (supabase.from('annees_scolaires' as any) as any)
          .select('id, nom, statut')
          .eq('ecole_id', profile.ecole_id)
          .order('created_at', { ascending: false })
      ])

      const formattedClasses = (classesData?.data || []).map((c: any) => ({
        id: c.id,
        nom: c.nom,
        niveau_id: c.niveau_id,
        niveau_nom: c.niveau?.nom || '',
        annee_scolaire_id: c.annee_scolaire_id,
        ecole_id: c.ecole_id,
        titulaire_id: c.titulaire_id,
        titulaire_nom: c.titulaire ? `${c.titulaire.prenom} ${c.titulaire.nom}` : undefined,
        eleves_count: c.eleves_count || 0,
        enseignants_count: c.enseignants_count || 0,
        actif: c.actif ?? true,
        created_at: c.created_at
      }))

      setClasses(formattedClasses)
      setNiveaux(niveauxData?.data || [])
      setEnseignants(enseignantsData?.data || [])
      setAnnees(anneesData?.data || [])
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleClasseStatut(classe: Classe) {
    try {
      const { error } = await (supabase.from('classes' as any) as any)
        .update({ actif: !classe.actif } as any)
        .eq('id', classe.id)

      if (error) throw error
      
      setClasses(classes.map(c => c.id === classe.id ? { ...c, actif: !classe.actif } : c))
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  async function deleteClasse(classe: Classe) {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer la classe',
      message: `ATTENTION: La suppression de la classe "${classe.nom}" est irréversible. Les élèves devront être réassignés.`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('classes' as any) as any).delete().eq('id', classe.id)
          if (error) throw error
          
          setClasses(classes.filter(c => c.id !== classe.id))
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: 'danger'
    })
  }

  async function saveClasse(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const classeData = {
      nom: formData.get('nom') as string,
      niveau_id: formData.get('niveau_id') as string,
      annee_scolaire_id: formData.get('annee_scolaire_id') as string,
      titulaire_id: formData.get('titulaire_id') as string || null,
      ecole_id: profile?.ecole_id,
      actif: true
    }

    try {
      if (classeModal.classe) {
        const { error } = await (supabase.from('classes' as any) as any)
          .update(classeData as any)
          .eq('id', classeModal.classe.id)
        if (error) throw error
        setClasses(classes.map(c => c.id === classeModal.classe!.id ? { ...c, ...classeData } : c))
      } else {
        const { data, error } = await (supabase.from('classes' as any) as any)
          .insert([classeData] as any)
          .select()
        if (error) throw error
        setClasses([...classes, data[0]])
      }
      setClasseModal({ isOpen: false, classe: null })
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const activeAnnee = annees.find(a => a.statut === 'active')
  const filteredClasses = classes.filter(c =>
    c.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.niveau_nom.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (profileLoading || loading) {
    return <div className="p-8 text-slate-400">Chargement des classes...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Gestion des Classes</h1>
        <p className="text-slate-400">Créez et gérez les classes de votre établissement</p>
      </div>

      {!activeAnnee && (
        <div className="bg-amber-600/10 border border-amber-600/20 rounded-xl p-4 flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-amber-400" />
          <p className="text-amber-400">Aucune année scolaire active. Veuillez en activer une dans la configuration.</p>
        </div>
      )}

      <div className="flex justify-between items-center gap-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher une classe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-full"
          />
        </div>
        <button
          onClick={() => setClasseModal({ isOpen: true, classe: null })}
          disabled={!activeAnnee}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouvelle classe
        </button>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-300 font-medium">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3">Titulaire</th>
                <th className="px-4 py-3 text-center">Élèves</th>
                <th className="px-4 py-3 text-center">Enseignants</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredClasses.map((classe) => (
                <tr key={classe.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{classe.nom}</td>
                  <td className="px-4 py-3 text-slate-400">{classe.niveau_nom}</td>
                  <td className="px-4 py-3 text-slate-400">{classe.titulaire_nom || 'Non assigné'}</td>
                  <td className="px-4 py-3 text-center text-white">{classe.eleves_count}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{classe.enseignants_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      classe.actif
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {classe.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleClasseStatut(classe)}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                      >
                        {classe.actif ? <Users className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setClasseModal({ isOpen: true, classe })}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteClasse(classe)}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-800">
          {filteredClasses.map((classe) => (
            <div key={classe.id} className="p-4 space-y-3 hover:bg-slate-800/30 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white">{classe.nom}</h3>
                  <p className="text-sm text-slate-400">{classe.niveau_nom}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  classe.actif
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  {classe.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Élèves</p>
                  <p className="text-white font-bold">{classe.eleves_count}</p>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Enseignants</p>
                  <p className="text-white font-bold">{classe.enseignants_count}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-400">
                  Titulaire: <span className="text-white">{classe.titulaire_nom || 'Non assigné'}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setClasseModal({ isOpen: true, classe })}
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteClasse(classe)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Classe Modal */}
      {classeModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">
                {classeModal.classe ? 'Modifier' : 'Nouvelle'} classe
              </h3>
            </div>
            
            <form onSubmit={saveClasse} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom</label>
                <input
                  name="nom"
                  type="text"
                  defaultValue={classeModal.classe?.nom}
                  placeholder="Ex: CM2 A"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Niveau</label>
                <select
                  name="niveau_id"
                  defaultValue={classeModal.classe?.niveau_id}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                >
                  <option value="">Sélectionner un niveau</option>
                  {niveaux.map((niveau) => (
                    <option key={niveau.id} value={niveau.id}>
                      {niveau.nom} ({niveau.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Année scolaire</label>
                <select
                  name="annee_scolaire_id"
                  defaultValue={classeModal.classe?.annee_scolaire_id || activeAnnee?.id}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                >
                  <option value="">Sélectionner une année</option>
                  {annees.map((annee) => (
                    <option key={annee.id} value={annee.id}>
                      {annee.nom} {annee.statut === 'active' ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Titulaire (optionnel)</label>
                <select
                  name="titulaire_id"
                  defaultValue={classeModal.classe?.titulaire_id || ''}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Non assigné</option>
                  {enseignants.map((ens) => (
                    <option key={ens.id} value={ens.id}>
                      {ens.prenom} {ens.nom}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setClasseModal({ isOpen: false, classe: null })}
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
