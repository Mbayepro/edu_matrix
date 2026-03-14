'use client'

// src/app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Ecole } from '@/lib/supabase'
import {
  Users, BookOpen, AlertCircle, LayoutGrid,
  TrendingUp, UserCheck, Activity, ChevronRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

interface DashboardStats {
  totalEleves:      number
  totalEnseignants: number
  elevesImpayes:    number
  totalClasses:     number
  presencesAujourd: number
}

interface RecentEleve {
  id:        string
  prenom:    string
  nom:       string
  matricule: string | null
  classe:    { nom_classe: string } | null
}

function StatCard({
  icon: Icon, label, value, color, subtitle,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: 'emerald' | 'blue' | 'amber' | 'violet'
  subtitle?: string
}) {
  const c = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
    violet:  'bg-violet-50 text-violet-600',
  }[color]

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className={`inline-flex p-2.5 rounded-xl mb-3 ${c}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value.toLocaleString('fr-FR')}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name} : {p.value}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [ecole,         setEcole]         = useState<Ecole | null>(null)
  const [stats,         setStats]         = useState<DashboardStats | null>(null)
  const [recentEleves,  setRecentEleves]  = useState<RecentEleve[]>([])
  const [presenceChart, setPresenceChart] = useState<{ jour: string; present: number; absent: number }[]>([])
  const [notesChart,    setNotesChart]    = useState<{ classe: string; moyenne: number }[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('user_id', user.id).single()
      if (!prof) { window.location.href = '/login'; return }
      setProfile(prof)
      if (!prof.ecole_id) { setLoading(false); return }

      const { data: ec } = await supabase
        .from('ecoles').select('*').eq('id', prof.ecole_id).single()
      setEcole(ec)

      const today = new Date().toISOString().split('T')[0]

      const [elevesR, teachR, impayR, classR, presR] = await Promise.all([
        supabase.from('eleves').select('id',  { count: 'exact', head: true }).eq('ecole_id', prof.ecole_id),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('ecole_id', prof.ecole_id).eq('role', 'teacher'),
        supabase.from('eleves').select('id',  { count: 'exact', head: true }).eq('ecole_id', prof.ecole_id).eq('statut_paiement', 'impayé'),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('ecole_id', prof.ecole_id),
        supabase.from('presences').select('id', { count: 'exact', head: true }).eq('date', today),
      ])

      setStats({
        totalEleves:      elevesR.count ?? 0,
        totalEnseignants: teachR.count  ?? 0,
        elevesImpayes:    impayR.count  ?? 0,
        totalClasses:     classR.count  ?? 0,
        presencesAujourd: presR.count   ?? 0,
      })

      // Récents élèves
      const { data: recents } = await supabase
        .from('eleves')
        .select('id, prenom, nom, matricule, classe:classes(nom_classe)')
        .eq('ecole_id', prof.ecole_id)
        .order('created_at', { ascending: false })
        .limit(6)
      setRecentEleves((recents ?? []) as RecentEleve[])

      // Présences 7 derniers jours
      const days: typeof presenceChart = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const ds    = d.toISOString().split('T')[0]
        const label = d.toLocaleDateString('fr-FR', { weekday: 'short' })
        const [pR, aR] = await Promise.all([
          supabase.from('presences').select('id', { count: 'exact', head: true }).eq('date', ds).eq('statut', 'présent'),
          supabase.from('presences').select('id', { count: 'exact', head: true }).eq('date', ds).eq('statut', 'absent'),
        ])
        days.push({ jour: label, present: pR.count ?? 0, absent: aR.count ?? 0 })
      }
      setPresenceChart(days)

      // Moyennes par classe
      const { data: classes } = await supabase
        .from('classes').select('id, nom_classe').eq('ecole_id', prof.ecole_id).limit(6)

      if (classes) {
        const avgs = await Promise.all(
          classes.map(async (cl) => {
            const { data: ids } = await supabase.from('eleves').select('id').eq('classe_id', cl.id)
            if (!ids?.length) return { classe: cl.nom_classe, moyenne: 0 }
            const { data: notes } = await supabase
              .from('notes').select('note, coefficient').in('eleve_id', ids.map((e) => e.id))
            if (!notes?.length) return { classe: cl.nom_classe, moyenne: 0 }
            const sum = notes.reduce((a, n) => a + n.note * n.coefficient, 0)
            const div = notes.reduce((a, n) => a + n.coefficient, 0)
            return { classe: cl.nom_classe, moyenne: div > 0 ? Math.round(sum / div * 10) / 10 : 0 }
          })
        )
        setNotesChart(avgs.filter((a) => a.moyenne > 0))
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Banner */}
      <div className="relative bg-gradient-to-r from-slate-900 to-emerald-900 rounded-2xl p-5 lg:p-6 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '32px 32px' }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-slate-400 text-sm">Bonjour,</p>
            <h1 className="text-xl lg:text-2xl font-bold">{profile?.prenom} {profile?.nom}</h1>
            <p className="text-slate-400 text-sm mt-1">{ecole?.nom} · {ecole?.ville}</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center backdrop-blur-sm border border-white/10">
              <p className="text-xl font-bold">{stats?.presencesAujourd ?? 0}</p>
              <p className="text-[10px] text-slate-300 mt-0.5">présences<br/>aujourd'hui</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center backdrop-blur-sm border border-white/10">
              <p className="text-xl font-bold text-amber-300">{stats?.elevesImpayes ?? 0}</p>
              <p className="text-[10px] text-slate-300 mt-0.5">impayés</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={Users}       label="Élèves inscrits"  value={stats?.totalEleves      ?? 0} color="emerald" />
        <StatCard icon={BookOpen}    label="Enseignants"      value={stats?.totalEnseignants ?? 0} color="blue"    />
        <StatCard icon={LayoutGrid}  label="Classes"          value={stats?.totalClasses     ?? 0} color="violet"  />
        <StatCard icon={AlertCircle} label="Frais impayés"    value={stats?.elevesImpayes    ?? 0} color="amber" subtitle="élèves" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-800 text-sm">Présences — 7 derniers jours</h2>
          </div>
          {presenceChart.every((d) => d.present === 0 && d.absent === 0) ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              Aucune donnée disponible.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={presenceChart} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="present" name="Présents" fill="#059669" radius={[4,4,0,0]} />
                <Bar dataKey="absent"  name="Absents"  fill="#fca5a5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-800 text-sm">Moyennes par classe</h2>
          </div>
          {notesChart.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              Aucune note enregistrée.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={notesChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="classe" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="#3b82f6" strokeWidth={2.5}
                  dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-800 text-sm">Derniers élèves inscrits</h2>
            <a href="/dashboard/eleves" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Voir tous <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          {recentEleves.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aucun élève inscrit.</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentEleves.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {e.prenom[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{e.prenom} {e.nom}</p>
                    <p className="text-xs text-slate-400">{(e.classe as any)?.nom_classe ?? '—'}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 shrink-0">{e.matricule}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 text-sm mb-4">Accès rapide</h2>
          <div className="space-y-1">
            {[
              { label: 'Inscrire un élève',    href: '/dashboard/eleves/nouveau',   icon: Users },
              { label: 'Saisir des notes',      href: '/dashboard/notes',            icon: TrendingUp },
              { label: 'Marquer les présences', href: '/dashboard/presences',        icon: UserCheck },
              { label: 'Créer une classe',      href: '/dashboard/classes/nouvelle', icon: BookOpen },
            ].map((a) => (
              <a key={a.label} href={a.href}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 group transition-colors">
                <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                  <a.icon className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                </div>
                <span className="text-sm text-slate-600 group-hover:text-slate-900 flex-1">{a.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-400 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
