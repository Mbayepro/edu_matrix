'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CreditCard, Users, Calendar, CheckCircle, XCircle, Clock, Plus, Edit, Trash2, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AdminStatCard from '@/components/admin/AdminStatCard'
import StatutBadge from '@/components/admin/StatutBadge'
import ConfirmModal from '@/components/admin/ConfirmModal'

interface SubscriptionPlan {
  id: string
  nom: string
  prix_mensuel: number
  prix_annuel: number
  max_eleves: number
  max_enseignants: number
  max_classes: number
  fonctionnalites: string[]
  actif: boolean
  created_at: string
}

interface EcoleSubscription {
  id: string
  ecole_id: string
  ecole_nom: string
  plan_id: string
  plan_nom: string
  statut: 'actif' | 'suspendu' | 'expiré' | 'en_attente'
  date_debut: string
  date_fin: string
  eleves_count: number
  enseignants_count: number
  classes_count: number
}

export default function SuperAdminAbonnements() {
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<EcoleSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans')
  
  // Modal states
  const [planModal, setPlanModal] = useState<{ isOpen: boolean, plan: SubscriptionPlan | null }>({ isOpen: false, plan: null })
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant: 'danger' | 'warning' | 'info'
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Load subscription plans
      const { data: plansData } = await (supabase.from('subscription_plans' as any) as any)
        .select('*')
        .order('prix_mensuel', { ascending: true })
      
      setPlans(plansData || [])

      // Load active subscriptions
      const { data: subsData } = await (supabase.from('ecole_subscriptions' as any) as any)
        .select(`
          *,
          ecole:ecoles(nom)
        `)
        .order('date_debut', { ascending: false })

      const formattedSubs = (subsData || []).map((sub: any) => ({
        id: sub.id,
        ecole_id: sub.ecole_id,
        ecole_nom: sub.ecole?.nom || 'Inconnu',
        plan_id: sub.plan_id,
        plan_nom: sub.plan_nom || 'Standard',
        statut: sub.statut,
        date_debut: sub.date_debut,
        date_fin: sub.date_fin,
        eleves_count: sub.eleves_count || 0,
        enseignants_count: sub.enseignants_count || 0,
        classes_count: sub.classes_count || 0
      }))

      setSubscriptions(formattedSubs)
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  async function togglePlanStatut(plan: SubscriptionPlan) {
    setConfirmModal({
      isOpen: true,
      title: plan.actif ? 'Désactiver le plan' : 'Activer le plan',
      message: `Voulez-vous vraiment ${plan.actif ? 'désactiver' : 'activer'} le plan "${plan.nom}" ?`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('subscription_plans' as any) as any)
            .update({ actif: !plan.actif } as any)
            .eq('id', plan.id)

          if (error) throw error
          
          setPlans(plans.map(p => p.id === plan.id ? { ...p, actif: !p.actif } : p))
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: plan.actif ? 'warning' : 'info'
    })
  }

  async function deletePlan(plan: SubscriptionPlan) {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer le plan',
      message: `ATTENTION: La suppression du plan "${plan.nom}" est irréversible. Les écoles utilisant ce plan devront être réassignées.`,
      onConfirm: async () => {
        try {
          const { error } = await (supabase.from('subscription_plans' as any) as any).delete().eq('id', plan.id)
          if (error) throw error
          
          setPlans(plans.filter(p => p.id !== plan.id))
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Erreur:', error)
        }
      },
      variant: 'danger'
    })
  }

  const globalStats = {
    totalPlans: plans.filter(p => p.actif).length,
    totalSubscriptions: subscriptions.filter(s => s.statut === 'actif').length,
    totalRevenue: subscriptions
      .filter(s => s.statut === 'actif')
      .reduce((sum, s) => {
        const plan = plans.find(p => p.id === s.plan_id)
        return sum + (plan?.prix_mensuel || 0)
      }, 0),
    expiringSoon: subscriptions.filter(s => {
      const daysUntilExpiry = Math.ceil((new Date(s.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0
    }).length
  }

  if (loading) {
    return <div className="p-8 text-slate-400">Chargement des abonnements...</div>
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
          <h1 className="text-2xl font-bold text-white">Gestion des Abonnements</h1>
          <p className="text-slate-400">Plans SaaS et abonnements des écoles</p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <AdminStatCard
          icon={<CreditCard className="w-6 h-6 text-emerald-400" />}
          label="Plans Actifs"
          value={globalStats.totalPlans}
        />
        <AdminStatCard
          icon={<Users className="w-6 h-6 text-emerald-400" />}
          label="Abonnements Actifs"
          value={globalStats.totalSubscriptions}
        />
        <AdminStatCard
          icon={<DollarSign className="w-6 h-6 text-emerald-400" />}
          label="Revenu Mensuel (FCFA)"
          value={globalStats.totalRevenue}
        />
        <AdminStatCard
          icon={<Clock className="w-6 h-6 text-amber-400" />}
          label="Expirant (30j)"
          value={globalStats.expiringSoon}
        />
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'plans' ? 'bg-slate-800 text-white shadow-sm border border-slate-700' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
        >
          <CreditCard className="w-4 h-4" />
          Plans d'abonnement
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'subscriptions' ? 'bg-slate-800 text-white shadow-sm border border-slate-700' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
        >
          <Users className="w-4 h-4" />
          Abonnements écoles
        </button>
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Plans disponibles</h2>
            <button
              onClick={() => setPlanModal({ isOpen: true, plan: null })}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouveau plan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className={`bg-slate-900 rounded-2xl border ${plan.actif ? 'border-slate-800' : 'border-slate-800/50 opacity-60'} overflow-hidden`}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">{plan.nom}</h3>
                    {plan.actif ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Mensuel</span>
                      <span className="text-white font-bold">{plan.prix_mensuel.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Annuel</span>
                      <span className="text-white font-bold">{plan.prix_annuel.toLocaleString()} FCFA</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users className="w-4 h-4" />
                      <span>Max {plan.max_eleves} élèves</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users className="w-4 h-4" />
                      <span>Max {plan.max_enseignants} enseignants</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>Max {plan.max_classes} classes</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {plan.fonctionnalites.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        {feat}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-800">
                    <button
                      onClick={() => setPlanModal({ isOpen: true, plan })}
                      className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center justify-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Modifier
                    </button>
                    <button
                      onClick={() => togglePlanStatut(plan)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-1 ${
                        plan.actif
                          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {plan.actif ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => deletePlan(plan)}
                      className="px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-slate-300 font-medium">
                <tr>
                  <th className="px-4 py-3">École</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-center">Élèves</th>
                  <th className="px-4 py-3 text-center">Enseignants</th>
                  <th className="px-4 py-3 text-center">Classes</th>
                  <th className="px-4 py-3">Date début</th>
                  <th className="px-4 py-3">Date fin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{sub.ecole_nom}</td>
                    <td className="px-4 py-3 text-slate-400">{sub.plan_nom}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        sub.statut === 'actif'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : sub.statut === 'suspendu'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : sub.statut === 'expiré'
                          ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {sub.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">{sub.eleves_count}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{sub.enseignants_count}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{sub.classes_count}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(sub.date_debut).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(sub.date_fin).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
