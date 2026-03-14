'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ShieldAlert, Users, School, Activity, 
  Search, MoreVertical, CheckCircle, XCircle 
} from 'lucide-react'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    ecoles: 0,
    users: 0,
    activeToday: 0
  })
  const [ecoles, setEcoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Load stats
      const [ecolesCount, usersCount] = await Promise.all([
        supabase.from('ecoles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])

      setStats({
        ecoles: ecolesCount.count || 0,
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<School className="w-6 h-6 text-blue-400" />}
          label="Écoles inscrites"
          value={stats.ecoles}
        />
        <StatCard 
          icon={<Users className="w-6 h-6 text-emerald-400" />}
          label="Utilisateurs totaux"
          value={stats.users}
        />
        <StatCard 
          icon={<Activity className="w-6 h-6 text-purple-400" />}
          label="Actifs aujourd'hui"
          value={stats.activeToday}
        />
      </div>

      {/* Schools List */}
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
                <th className="px-4 py-3">Utilisateurs</th>
                <th className="px-4 py-3">Date création</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {ecoles.map((ecole) => (
                <tr key={ecole.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{ecole.nom}</td>
                  <td className="px-4 py-3">{ecole.ville}</td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">
                      {ecole.profiles[0]?.count || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(ecole.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
