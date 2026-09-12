'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { computeBilan, formatMontantCFA, getCurrentAnnéeScolaire } from '@/lib/financeEngine'
import type { Paiement, Depense, PaiementStaff, Eleve, EleveFrais, FraisScolaire } from '@/lib/supabase'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  AlertTriangle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  CreditCard,
  Receipt,
  GraduationCap,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Link from 'next/link'

interface EleveWithBalance {
  id: string
  nom: string
  prenom: string
  classe?: { nom_classe: string }
  statut_paiement: string
  reste: number
}

export default function FinanceDashboard() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const { showToast } = useToast()
  const ecoleId = profile?.ecole_id

  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [paiementsStaff, setPaiementsStaff] = useState<PaiementStaff[]>([])
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [elevesFrais, setElevesFrais] = useState<EleveFrais[]>([])
  const [fraisScolaires, setFraisScolaires] = useState<FraisScolaire[]>([])
  const [loading, setLoading] = useState(true)

  const annee = getCurrentAnnéeScolaire()

  useEffect(() => {
    if (ecoleId) loadAll(ecoleId)
    else if (!profileLoading) setLoading(false)
  }, [ecoleId, profileLoading])

  async function loadAll(id: string) {
    setLoading(true)
    try {
      if (!db) return
      
      const [p, d, ps, e, ef, f, classes, profiles] = await Promise.all([
        db.table('paiements').where('ecole_id').equals(id).toArray(),
        db.table('depenses').where('ecole_id').equals(id).toArray(),
        db.table('paiements_staff').where('ecole_id').equals(id).toArray(),
        db.table('eleves').where('ecole_id').equals(id).toArray(),
        db.table('eleves_frais').where('ecole_id').equals(id).toArray(),
        db.table('frais_scolaires').where('ecole_id').equals(id).toArray(),
        db.table('classes').where('ecole_id').equals(id).toArray(),
        db.table('profiles').where('ecole_id').equals(id).toArray(),
      ])

      const elevesWithClasse = e.map(el => ({
        ...el,
        classe: classes.find(c => c.id === el.classe_id)
      }))

      const staffWithProfile = ps.map(staff => ({
        ...staff,
        profile: profiles.find(pr => pr.id === staff.profile_id)
      }))

      setPaiements(p as any)
      setDepenses(d as any)
      setPaiementsStaff(staffWithProfile as any)
      setEleves(elevesWithClasse as any)
      setElevesFrais(ef as any)
      setFraisScolaires(f as any)

    } catch (err) {
      console.error('Erreur chargement local finance:', err)
    } finally {
      setLoading(false)
    }
  }

  const bilan = useMemo(() =>
    computeBilan(paiements, depenses, paiementsStaff, annee),
    [paiements, depenses, paiementsStaff, annee]
  )

  // Calcul des balances élèves
  const balancesMap = useMemo(() => {
    const map = new Map<string, { du: number; paye: number; reste: number }>()

    // Liste des mois écoulés
    const SCHOOL_MONTHS = ['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet']
    const currentMonthStr = new Date().toLocaleString('fr-FR', { month: 'long' }).toLowerCase()
    const currentIndex = SCHOOL_MONTHS.findIndex(m => m.toLowerCase() === currentMonthStr)
    const monthsDue = currentIndex >= 0 ? currentIndex + 1 : 0

    eleves.forEach(e => map.set(e.id, { du: 0, paye: 0, reste: 0 }))

    elevesFrais.forEach(ef => {
      const current = map.get(ef.eleve_id) || { du: 0, paye: 0, reste: 0 }
      const f = fraisScolaires.find(fr => fr.id === ef.frais_id)
      let multiplier = 1
      if (f) {
        const lib = (f.libelle || '').toLowerCase()
        if (f.frequence === 'mensuel' || lib.includes('mensu') || lib.includes('scolarit')) {
           multiplier = monthsDue
        }
      }
      const aPayer = (Number(ef.montant_a_payer) || (Number(ef.montant_du) - (Number(ef.montant_remise) || 0)) || 0) * multiplier
      const newDu = current.du + aPayer
      map.set(ef.eleve_id, { ...current, du: newDu, reste: newDu - current.paye })
    })

    paiements.forEach(p => {
      const current = map.get(p.eleve_id) || { du: 0, paye: 0, reste: 0 }
      const newPaye = current.paye + (Number(p.montant) || 0)
      map.set(p.eleve_id, { ...current, paye: newPaye, reste: current.du - newPaye })
    })

    return map
  }, [eleves, elevesFrais, paiements, fraisScolaires])

  const topImpayes = useMemo((): EleveWithBalance[] => {
    const result: EleveWithBalance[] = []
    eleves.forEach(e => {
      const bal = balancesMap.get(e.id)
      if (bal && bal.reste > 0) {
        result.push({ ...e as any, reste: bal.reste })
      }
    })
    return result.sort((a, b) => b.reste - a.reste).slice(0, 5)
  }, [eleves, balancesMap])

  const totalEleves = eleves.length
  const elevesImpayes = Array.from(balancesMap.values()).filter(b => b.reste > 0).length
  
  // Remplacer par des vrais calculs de bilan
  const totalRestant = Array.from(balancesMap.values()).reduce((sum, bal) => sum + Math.max(0, bal.reste), 0)
  const totalDu = Array.from(balancesMap.values()).reduce((sum, bal) => sum + bal.du, 0)
  const totalEncaisse = Array.from(balancesMap.values()).reduce((sum, bal) => sum + bal.paye, 0)
  
  const tauxRecouvrement = totalDu > 0 ? (totalEncaisse / totalDu) * 100 : 0

  // KPI du mois en cours
  const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const entreesMonth = paiements
    .filter(p => {
      const m = new Date(p.date_paiement).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      return m === currentMonth
    })
    .reduce((s, p) => s + Number(p.montant), 0)

  const chartData = bilan.parMois.slice(-6).map(m => ({
    mois: m.label.split(' ')[0].substring(0, 4),
    'Encaissé': m.entrees,
    'Dépenses': m.sorties,
  }))

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Finance Scolaire</h1>
            <p className="text-sm text-slate-400 font-medium">Année {annee} · {ecole?.nom}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Encaissé ce mois */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Encaissé ce mois</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">{(entreesMonth / 1000).toFixed(0)}k</p>
          <p className="text-[10px] text-emerald-400 font-bold">F CFA</p>
        </div>

        {/* Total encaissé */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total encaissé</p>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">{(bilan.totalEntrees / 1000).toFixed(0)}k</p>
          <p className="text-[10px] text-blue-400 font-bold">F CFA</p>
        </div>

        {/* Dépenses */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total dépenses</p>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <p className="text-2xl font-black text-white">{(bilan.totalSorties / 1000).toFixed(0)}k</p>
          <p className="text-[10px] text-rose-400 font-bold">F CFA</p>
        </div>

        {/* Solde net */}
        <div className={`bg-slate-900 border rounded-2xl p-5 space-y-3 ${bilan.soldeNet >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Solde net</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bilan.soldeNet >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              {bilan.soldeNet >= 0
                ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                : <ArrowDownRight className="w-4 h-4 text-rose-400" />
              }
            </div>
          </div>
          <p className={`text-2xl font-black ${bilan.soldeNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {bilan.soldeNet >= 0 ? '+' : ''}{(bilan.soldeNet / 1000).toFixed(0)}k
          </p>
          <p className={`text-[10px] font-bold ${bilan.soldeNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>F CFA</p>
        </div>
      </div>

      {/* Chart + Top Impayés */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique bilan 6 mois */}
        <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Flux 6 derniers mois
            </h3>
            <BarChart3 className="w-4 h-4 text-slate-500" />
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mois" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: 12 }}
                  formatter={(v: number) => [`${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F`, '']}
                />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="Encaissé" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dépenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Aucune donnée</p>
            </div>
          )}
        </div>

        {/* Top impayés */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Top impayés
            </h3>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="space-y-3">
            {topImpayes.length === 0 && (
              <p className="text-[11px] text-slate-500 font-bold text-center py-8">🎉 Aucun impayé !</p>
            )}
            {topImpayes.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <span className="text-[10px] font-black text-slate-500 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white truncate">{e.prenom} {e.nom}</p>
                  <p className="text-[10px] text-slate-400 truncate">{(e as any).classe?.nom_classe || '—'}</p>
                </div>
                <span className="text-xs font-black text-rose-400 whitespace-nowrap">
                  {(e.reste / 1000).toFixed(0)}k F
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/finance/par-classe"
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-rose-500/10 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all border border-rose-500/20"
          >
            Voir tous les impayés
          </Link>
        </div>
      </div>

      {/* Stats élèves + Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats élèves */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Élèves
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-bold">Total inscrits</span>
              <span className="text-sm font-black text-white">{totalEleves}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-bold">À jour</span>
              <span className="text-sm font-black text-emerald-400">{totalEleves - elevesImpayes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-bold">En retard</span>
              <span className="text-sm font-black text-rose-400">{elevesImpayes}</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                <span>Taux à jour</span>
                <span className="text-emerald-400">{totalEleves > 0 ? Math.round(((totalEleves - elevesImpayes) / totalEleves) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${totalEleves > 0 ? ((totalEleves - elevesImpayes) / totalEleves) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Accès rapides */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {[
            {
              href: '/dashboard/paiements',
              label: 'Enregistrer un paiement',
              desc: 'Saisir un versement élève',
              icon: CreditCard,
              color: 'emerald',
            },
            {
              href: '/dashboard/finance/par-classe',
              label: 'Reçus en masse',
              desc: 'Imprimer tous les reçus d\'une classe',
              icon: Receipt,
              color: 'amber',
            },
            {
              href: '/dashboard/finance/depenses',
              label: 'Ajouter dépense',
              desc: 'Loyer, électricité, fournitures…',
              icon: TrendingDown,
              color: 'rose',
            },
            {
              href: '/dashboard/finance/profs',
              label: 'Payer un prof',
              desc: 'Enregistrer un salaire mensuel',
              icon: GraduationCap,
              color: 'blue',
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group p-5 bg-slate-900 border border-white/5 rounded-2xl hover:border-${item.color}-500/30 hover:bg-${item.color}-500/5 transition-all`}
            >
              <div className={`w-9 h-9 rounded-xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <item.icon className={`w-4 h-4 text-${item.color}-400`} />
              </div>
              <p className="text-sm font-black text-white">{item.label}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
