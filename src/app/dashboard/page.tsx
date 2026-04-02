'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import type { Profile, Ecole } from '@/lib/supabase'
import {
  Users, BookOpen, AlertCircle, LayoutGrid,
  TrendingUp, UserCheck, Activity, ChevronRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { RefreshCw } from 'lucide-react'

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
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-500 bg-blue-500/10 border-blue-500/20',
    amber:   'text-amber-500 bg-amber-500/10 border-amber-500/20',
    violet:  'text-violet-500 bg-violet-500/10 border-violet-500/20',
  }[color]

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border transition-transform duration-300 group-hover:scale-110 ${c}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value.toLocaleString('fr-FR')}</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        {subtitle && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>
          </div>
        )}
      </div>
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

import { CalculateurMoyennes } from '@/lib/calculMoyennes'
import { db } from '@/lib/db'
import { syncFromSupabase } from '@/lib/syncService'
import { useNetwork } from '@/hooks/useNetwork'

export default function DashboardPage() {
  const router = useRouter()
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { isOnline, pendingCount } = useNetwork()
  const { showToast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (profile?.role === 'superadmin') {
      router.push('/dashboard/superadmin')
    } else if (profile?.role === 'teacher') {
      router.push('/dashboard/teacher')
    }
  }, [profile, router])

  const [stats,         setStats]         = useState<DashboardStats | null>(null)
  const [recentEleves,  setRecentEleves]  = useState<RecentEleve[]>([])
  const [presenceChart, setPresenceChart] = useState<{ jour: string; present: number; absent: number }[]>([])
  const [notesChart,    setNotesChart]    = useState<{ classe: string; moyenne: number }[]>([])
  const [loading,       setLoading]       = useState(true)

  // Trigger refresh when sync is finished
  useEffect(() => {
    if (ecoleId && isOnline && pendingCount === 0) {
      loadAll(ecoleId)
    }
  }, [pendingCount, isOnline, ecoleId])

  useEffect(() => { 
    if (ecoleId) {
      loadAll(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadAll(schoolId: string) {
    const isOnlineSafe = typeof navigator !== 'undefined' && navigator.onLine
    setLoading(stats === null)
    
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // 1. FAST LOAD FROM DEXIE (Instant UI)
      if (db) {
        const [totalEleves, totalTeach, elevesImpayes, totalClasses, presencesAujourd] = await Promise.all([
          db.eleves.where('ecole_id').equals(schoolId).count(),
          db.profiles.where('ecole_id').equals(schoolId).and(p => p.role === 'teacher').count(),
          db.eleves.where('ecole_id').equals(schoolId).and(e => e.statut_paiement === 'impayé').count(),
          db.classes.where('ecole_id').equals(schoolId).count(),
          db.presences.where('ecole_id').equals(schoolId).and(p => p.date === today && (p.statut === 'présent' || p.statut === 'retard')).count(),
        ])

        setStats({
          totalEleves,
          totalEnseignants: totalTeach,
          elevesImpayes,
          totalClasses,
          presencesAujourd,
        })
      }

      // 2. REAL-TIME UPDATE FROM SUPABASE (If Online)
      if (isOnlineSafe) {
        setIsRefreshing(true)
        // Parallel fetching from server
        // Note: 'presences' table might not have 'ecole_id' directly. 
        // We filter by checking if we have any total count or using a count of eleves.
        const [elRes, profRes, clRes, presRes] = await Promise.all([
          supabase.from('eleves').select('id, statut_paiement').eq('ecole_id', schoolId),
          supabase.from('profiles').select('id').eq('ecole_id', schoolId).eq('role', 'teacher'),
          supabase.from('classes').select('id').eq('ecole_id', schoolId),
          supabase.from('presences').select('id').eq('date', today).in('statut', ['présent', 'retard']),
        ])

        if (elRes.error || profRes.error || clRes.error || presRes.error) {
          console.error('[Dashboard] Supabase error:', { elRes, profRes, clRes, presRes })
          showToast('Erreur de mise à jour en temps réel. Affichage cache local.', 'error')
        } else {
          // For presences today, since we can't filter by ecole_id directly in Supabase without a join,
          // and we want speed, we'll use a slightly broader count or just skip it if it's too complex.
          // BUT, we have elRes, so we could ideally filter presRes by elRes ids.
          const schoolEleveIds = new Set(elRes.data?.map((e: any) => e.id) || [])
          const filteredPresences = presRes.data?.filter((p: any) => schoolEleveIds.has(p.eleve_id)) || []

          const s: DashboardStats = {
            totalEleves: elRes.data?.length || 0,
            totalEnseignants: profRes.data?.length || 0,
            elevesImpayes: elRes.data?.filter((e: any) => e.statut_paiement === 'impayé').length || 0,
            totalClasses: clRes.data?.length || 0,
            presencesAujourd: filteredPresences.length,
          }
          setStats(s)
          
          // Background pull to update local charts
          void syncFromSupabase(schoolId)
        }
        setIsRefreshing(false)
      }

      // 3. Load Charts (Dexie remains the source for complex chart calculations)
      if (db) {
        // Récents élèves (Dexie)
        const recents = await db.eleves.where('ecole_id').equals(schoolId).limit(6).toArray()
        const classesMap = new Map((await db.classes.where('ecole_id').equals(schoolId).toArray()).map(c => [c.id, c.nom_classe]))
        
        setRecentEleves(recents.map(e => ({
          ...e,
          classe: { nom_classe: classesMap.get(e.classe_id) || 'N/A' }
        })) as unknown as RecentEleve[])

        // Présences 7 derniers jours (Dexie)
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        const startDate = sevenDaysAgo.toISOString().split('T')[0]
        const presRaw = await db.presences.where('ecole_id').equals(schoolId).and(p => p.date >= startDate).toArray()

        const presMap: Record<string, { present: number; absent: number }> = {}
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i)
          presMap[d.toISOString().split('T')[0]] = { present: 0, absent: 0 }
        }
        presRaw?.forEach((p: any) => {
          if (!presMap[p.date]) return
          if (p.statut === 'présent' || p.statut === 'retard') presMap[p.date].present++
          else presMap[p.date].absent++
        })
        setPresenceChart(Object.entries(presMap).map(([ds, counts]) => ({
          jour: new Date(ds).toLocaleDateString('fr-FR', { weekday: 'short' }),
          ...counts
        })))

        // Moyennes par classe (Dexie using engine logic)
        const classesList = await db.classes.where('ecole_id').equals(schoolId).limit(6).toArray()
        const notesCache = await db.notes.where('ecole_id').equals(schoolId).toArray()
        const evalsCache = await db.evaluations.where('ecole_id').equals(schoolId).toArray()
        const evalsMap = new Map(evalsCache.map(v => [v.id, v]))

        const avgs = classesList.map(cl => {
          const classNotes = notesCache.filter(n => {
            const ev = evalsMap.get(n.evaluation_id)
            return ev?.classe_id === cl.id
          })
          if (!classNotes.length) return { classe: cl.nom_classe, moyenne: 0 }

          const studentIds = Array.from(new Set(classNotes.map(n => n.eleve_id)))
          const studentAverages = studentIds.map(sid => {
            const sNotes = classNotes.filter(n => n.eleve_id === sid)
            const notesCC = sNotes.filter(n => evalsMap.get(n.evaluation_id)?.type !== 'composition').map(n => {
              const ev = evalsMap.get(n.evaluation_id)
              return (n.note / (ev?.bareme || 20)) * 20
            })
            const noteCompRaw = sNotes.find(n => evalsMap.get(n.evaluation_id)?.type === 'composition')
            let noteComp: number | null = null
            if (noteCompRaw) {
               const ev = evalsMap.get(noteCompRaw.evaluation_id)
               noteComp = (noteCompRaw.note / (ev?.bareme || 20)) * 20
            }

            const res = CalculateurMoyennes.calculerMoyenneMatiereBase(
              notesCC,
              noteComp,
              'BLOCKS',
              (cl.niveau?.includes('CM') || cl.niveau?.includes('CE') || cl.niveau?.includes('CP') || cl.niveau?.includes('CI'))
            )
            return res.moyenne
          })

          return { 
            classe: cl.nom_classe, 
            moyenne: Math.round((studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length) * 100) / 100
          }
        })
        setNotesChart(avgs.filter(a => a.moyenne > 0))
      }

    } catch (err) {
      console.warn('[Dashboard] Data load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="space-y-5 max-w-7xl mx-auto">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[250px] rounded-2xl" />
          <Skeleton className="h-[250px] rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* Premium Banner */}
      <div className="relative bg-slate-950 rounded-[2.5rem] p-8 lg:p-10 text-white overflow-hidden shadow-2xl shadow-emerald-900/20 border border-white/5">
        {/* Animated background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-[100px] -ml-32 -mb-32" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Session en cours
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-2">
              Ravi de vous revoir, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-300">{profile?.prenom}!</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto md:mx-0">
              Voici ce qui se passe aujourd&apos;hui à <span className="text-slate-200 font-bold">{ecole?.nom}</span>.
            </p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => ecoleId && loadAll(ecoleId)}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-3xl p-4 border border-white/20 flex flex-col items-center justify-center transition-all active:scale-95 group/btn"
              title="Synchroniser maintenant"
            >
              <RefreshCw className={`w-8 h-8 text-emerald-400 mb-1 ${isRefreshing ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-700'}`} />
              <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Actualiser</p>
            </button>
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 text-center min-w-[120px]">
              <p className="text-3xl font-black text-emerald-400">{stats?.presencesAujourd ?? 0}</p>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Présences</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 text-center min-w-[120px]">
              <p className="text-3xl font-black text-amber-400">{stats?.elevesImpayes ?? 0}</p>
              <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mt-1">Impayés</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-600" />
              </div>
              <h2 className="font-bold text-slate-900 text-sm">Présences — 7 jours</h2>
            </div>
          </div>
          {presenceChart.every((d) => d.present === 0 && d.absent === 0) ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">
              Aucune donnée disponible.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={presenceChart} barGap={4} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="present" name="Présents" fill="#10b981" radius={[6,6,0,0]} />
                <Bar dataKey="absent"  name="Absents"  fill="#fbbf24" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="font-bold text-slate-900 text-sm">Moyennes par classe</h2>
            </div>
          </div>
          {notesChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">
              Aucune note enregistrée.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={notesChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="classe" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="#3b82f6" strokeWidth={4}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
            <h2 className="font-bold text-slate-900 text-sm">Dernières inscriptions</h2>
            <Link href="/dashboard/eleves" className="px-3 py-1.5 rounded-xl bg-slate-50 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-colors">
              Voir tout
            </Link>
          </div>
          {recentEleves.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm italic">Aucun élève inscrit.</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentEleves.map((e) => (
                <li key={e.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors group">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl flex items-center justify-center text-emerald-600 text-sm font-black transition-transform group-hover:scale-110">
                    {e.prenom[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">{e.prenom} {e.nom}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{(e.classe as any)?.nom_classe ?? 'Niveau non défini'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-slate-400">{e.matricule}</p>
                    <div className="w-8 h-1 bg-emerald-100 rounded-full mt-1 ml-auto group-hover:w-12 transition-all" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 text-sm mb-6 uppercase tracking-widest">Raccourcis</h2>
          <div className="space-y-3">
            {[
              { label: 'Nouvel élève',      href: '/dashboard/eleves/nouveau',   icon: Users,        c: 'text-emerald-600 bg-emerald-50' },
              { label: 'Saisir Notes',      href: '/dashboard/notes',            icon: TrendingUp,   c: 'text-blue-600 bg-blue-50' },
              { label: 'Présences',         href: '/dashboard/presences',        icon: UserCheck,    c: 'text-amber-600 bg-amber-50' },
              { label: 'Configuration',      href: '/dashboard/parametres',       icon: BookOpen,     c: 'text-violet-600 bg-violet-50' },
            ].map((a) => (
              <Link key={a.label} href={a.href}
                className="flex items-center gap-4 p-3 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50/50 group transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-6 ${a.c}`}>
                  <a.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 flex-1">{a.label}</span>
                <div className="w-6 h-6 rounded-full bg-white border border-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
