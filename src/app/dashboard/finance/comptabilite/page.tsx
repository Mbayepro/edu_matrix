'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useProfile } from '@/hooks/useProfile'
import { computeBilan, CATEGORIES_DEPENSES, formatMontantCFA, getCurrentAnnéeScolaire } from '@/lib/financeEngine'
import type { Paiement, Depense, PaiementStaff } from '@/lib/supabase'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'

const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#94a3b8']

export default function ComptabilitePage() {
  const { profile } = useProfile()
  const ecoleId = profile?.ecole_id

  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [paiementsStaff, setPaiementsStaff] = useState<PaiementStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'mensuel' | 'annuel' | 'detail'>('mensuel')

  const annee = getCurrentAnnéeScolaire()

  useEffect(() => {
    if (ecoleId) loadAll(ecoleId)
  }, [ecoleId])

  async function loadAll(id: string) {
    setLoading(true)
    try {
      if (!db) return
      const [p, d, ps] = await Promise.all([
        db.table('paiements').where('ecole_id').equals(id).toArray(),
        db.table('depenses').where('ecole_id').equals(id).toArray(),
        db.table('paiements_staff').where('ecole_id').equals(id).toArray(),
      ])
      setPaiements(p as any)
      setDepenses(d as any)
      setPaiementsStaff(ps as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const bilan = useMemo(() => computeBilan(paiements, depenses, paiementsStaff, annee), [paiements, depenses, paiementsStaff, annee])

  const chartData = bilan.parMois.map(m => ({
    name: m.label.split(' ')[0].substring(0, 5),
    'Encaissé': Math.round(m.entrees),
    'Dépenses': Math.round(m.sorties),
    'Solde': Math.round(m.solde),
  }))

  const pieData = Object.entries(bilan.parCategorie)
    .filter(([, v]) => v > 0)
    .map(([key, val]) => ({
      name: key === 'salaires' ? 'Salaires' : (CATEGORIES_DEPENSES[key]?.label || key),
      value: Math.round(val),
      emoji: key === 'salaires' ? '👩‍🏫' : (CATEGORIES_DEPENSES[key]?.emoji || '📌'),
    }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Bilan Comptable</h1>
          <p className="text-sm text-slate-400 font-medium">Année scolaire {annee}</p>
        </div>
      </div>

      {/* KPI Bilan */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Entrées</p>
          </div>
          <p className="text-2xl font-black text-emerald-400">{formatMontantCFA(bilan.totalEntrees)}</p>
          <p className="text-[10px] text-slate-500 mt-1">Paiements élèves encaissés</p>
        </div>

        <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownRight className="w-5 h-5 text-rose-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Sorties</p>
          </div>
          <p className="text-2xl font-black text-rose-400">{formatMontantCFA(bilan.totalSorties)}</p>
          <p className="text-[10px] text-slate-500 mt-1">Dépenses + Salaires</p>
        </div>

        <div className={`bg-slate-900 rounded-2xl p-5 border ${bilan.soldeNet >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
          <div className="flex items-center gap-2 mb-3">
            {bilan.soldeNet >= 0
              ? <TrendingUp className="w-5 h-5 text-emerald-400" />
              : <TrendingDown className="w-5 h-5 text-rose-400" />
            }
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Solde Net</p>
          </div>
          <p className={`text-2xl font-black ${bilan.soldeNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {bilan.soldeNet >= 0 ? '+' : ''}{formatMontantCFA(bilan.soldeNet)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {bilan.soldeNet >= 0 ? 'Excédent de trésorerie' : 'Déficit de trésorerie'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 border border-white/5 rounded-xl p-1 w-fit">
        {[
          { key: 'mensuel', label: 'Par mois' },
          { key: 'annuel', label: 'Synthèse' },
          { key: 'detail', label: 'Répartition' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.key ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Graphique par mois */}
      {activeTab === 'mensuel' && (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Flux financiers par mois
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
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
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Aucune donnée pour cette année</p>
            </div>
          )}
        </div>
      )}

      {/* Synthèse annuelle */}
      {activeTab === 'annuel' && (
        <div className="space-y-4">
          {bilan.parMois.map(m => (
            <div key={m.label} className="bg-slate-900 border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-black text-white capitalize">{m.label}</p>
                <span className={`text-sm font-black ${m.solde >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {m.solde >= 0 ? '+' : ''}{m.solde.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                <div className="flex items-center gap-1 text-emerald-400">
                  <ArrowUpRight className="w-3 h-3" />
                  Entrées: {m.entrees.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                </div>
                <div className="flex items-center gap-1 text-rose-400">
                  <ArrowDownRight className="w-3 h-3" />
                  Sorties: {m.sorties.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                </div>
              </div>
            </div>
          ))}
          {bilan.parMois.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Aucune donnée</p>
            </div>
          )}
        </div>
      )}

      {/* Répartition des dépenses */}
      {activeTab === 'detail' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Répartition des sorties
            </h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: 12 }}
                    formatter={(v: number) => [`${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Aucune dépense</p>
              </div>
            )}
          </div>

          {/* Détail liste */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Détail par catégorie
            </h3>
            <div className="space-y-3">
              {pieData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-black text-white">{item.name}</span>
                      <span className="text-xs font-black" style={{ color: COLORS[i % COLORS.length] }}>
                        {item.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${bilan.totalSorties > 0 ? (item.value / bilan.totalSorties) * 100 : 0}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold shrink-0">
                    {bilan.totalSorties > 0 ? Math.round((item.value / bilan.totalSorties) * 100) : 0}%
                  </span>
                </div>
              ))}
              {pieData.length === 0 && (
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 py-8 text-center">
                  Aucune dépense enregistrée
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
