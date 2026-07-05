'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Users, Activity, DollarSign, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AdminStatCard from '@/components/admin/AdminStatCard'

interface EcoleStats {
  id: string
  nom: string
  ville: string
  statut: string
  total_eleves: number
  total_enseignants: number
  total_classes: number
  taux_paiement: number
  active_last_7_days: number
  created_at: string
}

export default function SuperAdminStatistiques() {
  const router = useRouter()
  const [stats, setStats] = useState<EcoleStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEcole, setSelectedEcole] = useState<EcoleStats | null>(null)
  const [filterStatut, setFilterStatut] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const { data: ecoles } = await supabase
        .from('ecoles')
        .select('id, nom, ville, statut, created_at')
        .order('nom')

      if (!ecoles) {
        setStats([])
        setLoading(false)
        return
      }

      const statsData: EcoleStats[] = await Promise.all(
        ecoles.map(async (ecole: any) => {
          const [elevesCount, enseignantsCount, classesCount, paiementsData, activeUsers] = await Promise.all([
            supabase.from('eleves').select('id', { count: 'exact', head: true }).eq('ecole_id', ecole.id),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('ecole_id', ecole.id).eq('role', 'teacher'),
            supabase.from('classes').select('id', { count: 'exact', head: true }).eq('ecole_id', ecole.id),
            (supabase.from('eleves_frais' as any) as any).select('statut_paiement').eq('ecole_id', ecole.id),
            supabase.from('profiles').select('id', { count: 'exact', head: true })
              .eq('ecole_id', ecole.id)
              .gte('last_sign_in_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          ])

          const totalEleves = elevesCount.count || 0
          const totalEnseignants = enseignantsCount.count || 0
          const totalClasses = classesCount.count || 0
          const activeLast7Days = activeUsers.count || 0

          let tauxPaiement = 0
          if (paiementsData.data && paiementsData.data.length > 0) {
            const payes = paiementsData.data.filter((p: any) => p.statut_paiement === 'paye').length
            tauxPaiement = Math.round((payes / paiementsData.data.length) * 100)
          }

          return {
            id: ecole.id,
            nom: ecole.nom,
            ville: ecole.ville || '',
            statut: ecole.statut,
            total_eleves: totalEleves,
            total_enseignants: totalEnseignants,
            total_classes: totalClasses,
            taux_paiement: tauxPaiement,
            active_last_7_days: activeLast7Days,
            created_at: ecole.created_at
          }
        })
      )

      setStats(statsData)
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredStats = stats.filter(s => !filterStatut || s.statut === filterStatut)

  const globalStats = {
    totalEcoles: stats.length,
    totalEleves: stats.reduce((sum, s) => sum + s.total_eleves, 0),
    totalEnseignants: stats.reduce((sum, s) => sum + s.total_enseignants, 0),
    avgTauxPaiement: stats.length > 0 
      ? Math.round(stats.reduce((sum, s) => sum + s.taux_paiement, 0) / stats.length)
      : 0
  }

  if (loading) {
    return <div className="p-8 text-slate-400">Chargement des statistiques...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/superadmin')}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Statistiques par École</h1>
          <p className="text-slate-400">Vue d'ensemble agrégée de toutes les écoles</p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <AdminStatCard
          icon={<Users className="w-6 h-6 text-emerald-400" />}
          label="Total Écoles"
          value={globalStats.totalEcoles}
        />
        <AdminStatCard
          icon={<Users className="w-6 h-6 text-emerald-400" />}
          label="Total Élèves"
          value={globalStats.totalEleves}
        />
        <AdminStatCard
          icon={<Activity className="w-6 h-6 text-emerald-400" />}
          label="Total Enseignants"
          value={globalStats.totalEnseignants}
        />
        <AdminStatCard
          icon={<DollarSign className="w-6 h-6 text-emerald-400" />}
          label="Taux Paiement Moyen (%)"
          value={globalStats.avgTauxPaiement}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          Filtre statut:
        </div>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">Tous</option>
          <option value="actif">Actif</option>
          <option value="suspendu">Suspendu</option>
          <option value="en_attente">En attente</option>
        </select>
      </div>

      {/* Ecoles Stats Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-300 font-medium">
              <tr>
                <th className="px-4 py-3">École</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-center">Élèves</th>
                <th className="px-4 py-3 text-center">Enseignants</th>
                <th className="px-4 py-3 text-center">Classes</th>
                <th className="px-4 py-3 text-center">Taux Paiement</th>
                <th className="px-4 py-3 text-center">Actifs (7j)</th>
                <th className="px-4 py-3">Date création</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStats.map((stat) => (
                <tr 
                  key={stat.id} 
                  className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedEcole(stat)}
                >
                  <td className="px-4 py-3 font-medium text-white">{stat.nom}</td>
                  <td className="px-4 py-3 text-slate-400">{stat.ville}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      stat.statut === 'actif' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : stat.statut === 'suspendu'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {stat.statut}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-white font-medium">{stat.total_eleves}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">{stat.total_enseignants}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{stat.total_classes}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`font-medium ${
                        stat.taux_paiement >= 80 ? 'text-emerald-400' : 
                        stat.taux_paiement >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {stat.taux_paiement}%
                      </span>
                      {stat.taux_paiement >= 50 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">{stat.active_last_7_days}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(stat.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-800">
          {filteredStats.map((stat) => (
            <div 
              key={stat.id}
              className="p-4 space-y-3 hover:bg-slate-800/30 transition-colors cursor-pointer"
              onClick={() => setSelectedEcole(stat)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white">{stat.nom}</h3>
                  <p className="text-sm text-slate-400">{stat.ville}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  stat.statut === 'actif' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : stat.statut === 'suspendu'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {stat.statut}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Élèves</p>
                  <p className="text-white font-bold">{stat.total_eleves}</p>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Enseignants</p>
                  <p className="text-white font-bold">{stat.total_enseignants}</p>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Taux Paiement</p>
                  <p className={`font-bold ${
                    stat.taux_paiement >= 80 ? 'text-emerald-400' : 
                    stat.taux_paiement >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {stat.taux_paiement}%
                  </p>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg">
                  <p className="text-slate-400 text-xs">Actifs (7j)</p>
                  <p className="text-white font-bold">{stat.active_last_7_days}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEcole && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-2xl w-full animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedEcole.nom}</h3>
                <p className="text-sm text-slate-400">{selectedEcole.ville}</p>
              </div>
              <button
                onClick={() => setSelectedEcole(null)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Users className="w-4 h-4" />
                    Élèves
                  </div>
                  <p className="text-2xl font-bold text-white">{selectedEcole.total_eleves}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Users className="w-4 h-4" />
                    Enseignants
                  </div>
                  <p className="text-2xl font-bold text-white">{selectedEcole.total_enseignants}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Calendar className="w-4 h-4" />
                    Classes
                  </div>
                  <p className="text-2xl font-bold text-white">{selectedEcole.total_classes}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Activity className="w-4 h-4" />
                    Actifs (7j)
                  </div>
                  <p className="text-2xl font-bold text-white">{selectedEcole.active_last_7_days}</p>
                </div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <DollarSign className="w-4 h-4" />
                    Taux de paiement
                  </div>
                  <span className={`text-2xl font-bold ${
                    selectedEcole.taux_paiement >= 80 ? 'text-emerald-400' : 
                    selectedEcole.taux_paiement >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {selectedEcole.taux_paiement}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      selectedEcole.taux_paiement >= 80 ? 'bg-emerald-500' : 
                      selectedEcole.taux_paiement >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${selectedEcole.taux_paiement}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl">
                <p className="text-slate-400 text-sm mb-2">Date de création</p>
                <p className="text-white">
                  {new Date(selectedEcole.created_at).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
