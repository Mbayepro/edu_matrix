'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldAlert, Users, School, Activity, Search, Settings, Edit, Power, PowerOff, Save, Mail, Globe, Database, Building } from 'lucide-react'
import AdminStatCard from '@/components/admin/AdminStatCard'
import StatutBadge from '@/components/admin/StatutBadge'
import RoleBadge from '@/components/admin/RoleBadge'
import EcoleTable from '@/components/admin/EcoleTable'
import UserTable from '@/components/admin/UserTable'
import ConfirmModal from '@/components/admin/ConfirmModal'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    ecoles: 0,
    attente: 0,
    users: 0,
    activeToday: 0
  })
  const [ecoles, setEcoles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ecoles' | 'users' | 'settings'>('ecoles')
  
  // Search states
  const [ecoleSearch, setEcoleSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  // Modal states
  const [editModal, setEditModal] = useState<{ isOpen: boolean, ecole: any | null }>({ isOpen: false, ecole: null })
  const [isSaving, setIsSaving] = useState(false)
  
  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant: 'danger' | 'warning' | 'info'
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' })
  
  // Settings states
  const [settings, setSystemSettings] = useState({
    allowRegistrations: true,
    maintenanceMode: false,
    systemEmail: 'admin@edumatrix.com',
    maxSchoolsAllowed: 100
  })
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [ecolesCount, attenteCount, usersCount] = await Promise.all([
        supabase.from('ecoles').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
        supabase.from('ecoles').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])

      setStats({
        ecoles: ecolesCount.count || 0,
        attente: attenteCount.count || 0,
        users: usersCount.count || 0,
        activeToday: 0
      })

      const { data } = await supabase
        .from('ecoles')
        .select('*, profiles(count)')
        .order('created_at', { ascending: false })
      setEcoles(data || [])

      const { data: usersData } = await supabase
        .from('profiles')
        .select('*, ecole:ecoles(nom)')
        .order('created_at', { ascending: false })
      setUsers(usersData || [])
    } finally {
      setLoading(false)
    }
  }

  async function toggleStatut(ecole: any) {
    const nouveauStatut = ecole.statut === 'actif' ? 'suspendu' : 'actif'
    
    setConfirmModal({
      isOpen: true,
      title: nouveauStatut === 'suspendu' ? 'Suspendre l\'école' : 'Activer l\'école',
      message: `Voulez-vous vraiment ${nouveauStatut === 'suspendu' ? 'suspendre' : 'activer'} l'école ${ecole.nom} ?`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('ecoles' as any) as any)
            .update({ statut: nouveauStatut } as any)
            .eq('id', ecole.id)

          if (error) throw error
          
          setEcoles(ecoles.map(e => e.id === ecole.id ? { ...e, statut: nouveauStatut } : e))
          
          if (nouveauStatut === 'suspendu' && ecole.statut === 'actif') {
            setStats(s => ({ ...s, ecoles: s.ecoles - 1 }))
          } else if (nouveauStatut === 'actif' && ecole.statut !== 'actif') {
            setStats(s => ({ ...s, ecoles: s.ecoles + 1 }))
          }
        } catch (error) {
          console.error("Erreur:", error)
        }
      },
      variant: nouveauStatut === 'suspendu' ? 'warning' : 'info'
    })
  }

  async function handleDelete(ecole: any) {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer l\'école',
      message: `ATTENTION: La suppression de l'école "${ecole.nom}" est irréversible. Toutes les données liées seront supprimées.`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('ecoles' as any) as any).delete().eq('id', ecole.id)
          if (error) throw error
          
          setEcoles(ecoles.filter(e => e.id !== ecole.id))
          if (ecole.statut === 'actif') {
            setStats(s => ({ ...s, ecoles: s.ecoles - 1 }))
          }
        } catch (error) {
          console.error("Erreur:", error)
        }
      },
      variant: 'danger'
    })
  }

  async function saveEcoleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal.ecole) return
    
    setIsSaving(true)
    try {
      const { error } = await (supabase.from('ecoles' as any) as any)
        .update({ nom: editModal.ecole.nom, ville: editModal.ecole.ville } as any)
        .eq('id', editModal.ecole.id)

      if (error) throw error
      
      setEcoles(ecoles.map(ec => ec.id === editModal.ecole.id ? editModal.ecole : ec))
      setEditModal({ isOpen: false, ecole: null })
    } catch (error) {
      console.error("Erreur:", error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteUser(user: any) {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer l\'utilisateur',
      message: `Voulez-vous vraiment supprimer l'utilisateur ${user.prenom} ${user.nom} ? Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('profiles').delete().eq('id', user.id)
          if (error) throw error
          
          setUsers(users.filter(u => u.id !== user.id))
          setStats(s => ({ ...s, users: s.users - 1 }))
        } catch (error) {
          console.error("Erreur:", error)
        }
      },
      variant: 'danger'
    })
  }

  async function saveSystemSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
    } catch (error) {
      console.error("Erreur:", error)
    } finally {
      setSavingSettings(false)
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
        <AdminStatCard 
          icon={<School className="w-6 h-6 text-emerald-400" />}
          label="Écoles Actives"
          value={stats.ecoles}
        />
        <AdminStatCard 
          icon={<ShieldAlert className="w-6 h-6 text-amber-400" />}
          label="En Attente"
          value={stats.attente}
          href="/dashboard/admin/validation"
        />
        <AdminStatCard 
          icon={<Users className="w-6 h-6 text-emerald-400" />}
          label="Utilisateurs totaux"
          value={stats.users}
        />
        <AdminStatCard 
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
        <div className="space-y-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Rechercher une école..." 
              value={ecoleSearch}
              onChange={(e) => setEcoleSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-600 w-full"
            />
          </div>
          <EcoleTable
            ecoles={ecoles}
            searchQuery={ecoleSearch}
            onEdit={(ecole) => setEditModal({ isOpen: true, ecole })}
            onToggleStatus={toggleStatut}
            onDelete={handleDelete}
          />
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Rechercher par nom ou école..." 
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-600 w-full"
            />
          </div>
          <UserTable
            users={users}
            searchQuery={userSearch}
            onDelete={handleDeleteUser}
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 border-b border-slate-800">
            <h2 className="font-semibold text-white">Paramètres globaux de la plateforme</h2>
            <p className="text-sm text-slate-400 mt-1">Configuration générale pour EduMatrix.</p>
          </div>
          
          <form onSubmit={saveSystemSettings} className="p-6 space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                Sécurité & Accès
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex items-start justify-between gap-4">
                  <div>
                    <label className="font-medium text-white block mb-1">Inscriptions ouvertes</label>
                    <p className="text-xs text-slate-400">Autoriser les nouveaux directeurs à soumettre des demandes.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.allowRegistrations}
                      onChange={(e) => setSystemSettings({...settings, allowRegistrations: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/20 flex items-start justify-between gap-4">
                  <div>
                    <label className="font-medium text-red-400 block mb-1">Mode Maintenance</label>
                    <p className="text-xs text-slate-400">Bloquer l'accès à toute la plateforme.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.maintenanceMode}
                      onChange={(e) => setSystemSettings({...settings, maintenanceMode: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <Database className="w-5 h-5 text-emerald-400" />
                Configuration Technique
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" /> Email système
                  </label>
                  <input 
                    type="email" 
                    value={settings.systemEmail}
                    onChange={(e) => setSystemSettings({...settings, systemEmail: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" /> Limite d'écoles
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    value={settings.maxSchoolsAllowed}
                    onChange={(e) => setSystemSettings({...settings, maxSchoolsAllowed: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex justify-end">
              <button 
                type="submit" 
                disabled={savingSettings}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                {savingSettings ? 'Patientez...' : <><Save className="w-4 h-4" /> Sauvegarder</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && editModal.ecole && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">Modifier l'école</h3>
            </div>
            
            <form onSubmit={saveEcoleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nom de l'école</label>
                <input 
                  type="text" 
                  value={editModal.ecole.nom}
                  onChange={e => setEditModal({ ...editModal, ecole: { ...editModal.ecole, nom: e.target.value } })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Ville</label>
                <input 
                  type="text" 
                  value={editModal.ecole.ville || ''}
                  onChange={e => setEditModal({ ...editModal, ecole: { ...editModal.ecole, ville: e.target.value } })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditModal({ isOpen: false, ecole: null })}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors font-medium"
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
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

