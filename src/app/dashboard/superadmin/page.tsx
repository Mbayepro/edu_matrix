'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ShieldAlert, Users, School, Activity, 
  Search, MoreVertical, CheckCircle, XCircle, Settings, Edit, Trash2, Power, PowerOff, Building
} from 'lucide-react'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    ecoles: 0,
    attente: 0,
    users: 0,
    activeToday: 0
  })
  const [ecoles, setEcoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ecoles' | 'users' | 'settings'>('ecoles')
  
  // States for actions menu and modal
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<{ isOpen: boolean, ecole: any | null }>({ isOpen: false, ecole: null })
  const [isSaving, setIsSaving] = useState(false)

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActionMenuId(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Load stats
      const [ecolesCount, attenteCount, usersCount] = await Promise.all([
        supabase.from('ecoles').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
        supabase.from('ecoles').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])

      setStats({
        ecoles: ecolesCount.count || 0,
        attente: attenteCount.count || 0,
        users: usersCount.count || 0,
        activeToday: 0 // Placeholder
      })

      // Load schools list
      const { data } = await supabase
        .from('ecoles')
        .select(`
          *,
          profiles(count)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      setEcoles(data || [])
    } finally {
      setLoading(false)
    }
  }

  async function toggleStatut(ecole: any) {
    const nouveauStatut = ecole.statut === 'actif' ? 'suspendu' : 'actif'
    if (!confirm(`Voulez-vous vraiment ${nouveauStatut === 'suspendu' ? 'suspendre' : 'activer'} l'école ${ecole.nom} ?`)) return
    
    try {
      const { error } = await supabase
        .from('ecoles')
        .update({ statut: nouveauStatut })
        .eq('id', ecole.id)

      if (error) throw error
      
      // Update local state
      setEcoles(ecoles.map(e => e.id === ecole.id ? { ...e, statut: nouveauStatut } : e))
      
      // Update stats
      if (nouveauStatut === 'suspendu' && ecole.statut === 'actif') {
        setStats(s => ({ ...s, ecoles: s.ecoles - 1 }))
      } else if (nouveauStatut === 'actif' && ecole.statut !== 'actif') {
        setStats(s => ({ ...s, ecoles: s.ecoles + 1 }))
      }
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error)
      alert("Une erreur est survenue")
    }
  }

  async function handleDelete(ecole: any) {
    const confirmation = window.prompt(`ATTENTION: La suppression est irréversible. Toutes les données liées seront supprimées.\n\nTapez le nom de l'école "${ecole.nom}" pour confirmer:`)
    
    if (confirmation !== ecole.nom) {
      if (confirmation !== null) alert("Le nom saisi ne correspond pas. Annulation de la suppression.")
      return
    }

    try {
      const { error } = await supabase
        .from('ecoles')
        .delete()
        .eq('id', ecole.id)

      if (error) throw error
      
      // Update local state
      setEcoles(ecoles.filter(e => e.id !== ecole.id))
      if (ecole.statut === 'actif') {
        setStats(s => ({ ...s, ecoles: s.ecoles - 1 }))
      }
      alert("École supprimée avec succès")
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
      alert("Erreur lors de la suppression de l'école")
    }
  }

  async function saveEcoleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal.ecole) return
    
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('ecoles')
        .update({ 
          nom: editModal.ecole.nom,
          ville: editModal.ecole.ville
        })
        .eq('id', editModal.ecole.id)

      if (error) throw error
      
      setEcoles(ecoles.map(ec => ec.id === editModal.ecole.id ? editModal.ecole : ec))
      setEditModal({ isOpen: false, ecole: null })
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
      alert("Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-400">Chargement du panneau d'administration...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Super Admin</h1>
          <p className="text-slate-400">Vue d'ensemble de la plateforme</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Zone à accès restreint
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          icon={<School className="w-6 h-6 text-emerald-400" />}
          label="Écoles Actives"
          value={stats.ecoles}
        />
        <a href="/dashboard/admin/validation" className="block">
          <StatCard 
            icon={<ShieldAlert className="w-6 h-6 text-amber-400" />}
            label="En Attente"
            value={stats.attente}
          />
        </a>
        <StatCard 
          icon={<Users className="w-6 h-6 text-blue-400" />}
          label="Utilisateurs totaux"
          value={stats.users}
        />
        <StatCard 
          icon={<Activity className="w-6 h-6 text-purple-400" />}
          label="Actifs aujourd'hui"
          value={stats.activeToday}
        />
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
        <button 
          onClick={() => setActiveTab('ecoles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ecoles' ? 'bg-slate-800 text-white shadow-sm border border-slate-700' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
        >
          <Building className="w-4 h-4" />
          Écoles
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-slate-800 text-white shadow-sm border border-slate-700' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
        >
          <Users className="w-4 h-4" />
          Utilisateurs
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-slate-800 text-white shadow-sm border border-slate-700' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
        >
          <Settings className="w-4 h-4" />
          Paramètres
        </button>
      </div>

      {activeTab === 'ecoles' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className="font-semibold text-white">Dernières écoles inscrites</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              className="bg-slate-900 border border-slate-700 rounded-lg py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-900/50 text-slate-300 font-medium">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Utilisateurs</th>
                <th className="px-4 py-3">Date création</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {ecoles.map((ecole) => (
                <tr key={ecole.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{ecole.nom}</td>
                  <td className="px-4 py-3">{ecole.ville}</td>
                  <td className="px-4 py-3">
                    {ecole.statut === 'actif' ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Actif</span>
                    ) : ecole.statut === 'suspendu' ? (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-xs inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> Suspendu</span>
                    ) : (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-xs inline-flex items-center gap-1">En attente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">
                      {ecole.profiles[0]?.count || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(ecole.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setActionMenuId(actionMenuId === ecole.id ? null : ecole.id)
                      }}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {actionMenuId === ecole.id && (
                      <div className="absolute right-8 top-10 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                        <button 
                          onClick={() => {
                            setEditModal({ isOpen: true, ecole })
                            setActionMenuId(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Modifier infos
                        </button>
                        
                        <button 
                          onClick={() => {
                            toggleStatut(ecole)
                            setActionMenuId(null)
                          }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${ecole.statut === 'actif' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                        >
                          {ecole.statut === 'actif' ? <><PowerOff className="w-4 h-4" /> Suspendre</> : <><Power className="w-4 h-4" /> Activer</>}
                        </button>
                        
                        <div className="h-px bg-slate-700 my-1"></div>
                        
                        <button 
                          onClick={() => {
                            handleDelete(ecole)
                            setActionMenuId(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && editModal.ecole && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">Modifier l'école</h3>
            </div>
            
            <form onSubmit={saveEcoleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom de l'école</label>
                <input 
                  type="text" 
                  value={editModal.ecole.nom}
                  onChange={e => setEditModal({ ...editModal, ecole: { ...editModal.ecole, nom: e.target.value } })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Ville</label>
                <input 
                  type="text" 
                  value={editModal.ecole.ville || ''}
                  onChange={e => setEditModal({ ...editModal, ecole: { ...editModal.ecole, ville: e.target.value } })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditModal({ isOpen: false, ecole: null })}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg transition-colors font-medium flex items-center justify-center"
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: number }) {
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center gap-4">
      <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}
