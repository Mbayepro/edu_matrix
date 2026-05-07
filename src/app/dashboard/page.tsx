'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import type { Profile, Ecole } from '@/lib/supabase'
import {
  Users, BookOpen, AlertCircle, LayoutGrid,
  TrendingUp, UserCheck, Activity, ChevronRight, MessageCircle,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Clock, Sparkles
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { RefreshCw } from 'lucide-react'
import { CalculateurMoyennes } from '@/lib/calculMoyennes'
import { db } from '@/lib/db'
import { syncFromSupabase, flushSyncQueue } from '@/lib/syncService'
import { useNetwork } from '@/hooks/useNetwork'
import { getTodayDate } from '@/lib/dateUtils'

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
  icon: Icon, label, value, color, subtitle, trend
}: {
  icon: React.ElementType
  label: string
  value: number
  color: 'emerald' | 'blue' | 'amber' | 'violet'
  subtitle?: string
  trend?: { val: string, positive: boolean }
}) {
  const c = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-500 bg-blue-500/10 border-blue-500/20',
    amber:   'text-amber-500 bg-amber-500/10 border-amber-500/20',
    violet:  'text-violet-500 bg-violet-500/10 border-violet-500/20',
  }[color]

  return (
    <div className="bg-white rounded-[2.5rem] p-7 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50/50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
      
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${c}`}>
        <Icon className="w-6 h-6" />
      </div>

      <div className="space-y-1 relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value.toLocaleString('fr-FR')}</h3>
          {trend && (
            <div className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-lg ${trend.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {trend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.val}
            </div>
          )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        {subtitle && (
          <div className="flex items-center gap-1.5 mt-3">
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{subtitle}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-3 shadow-2xl border border-white/10">
      <p className="mb-2 text-slate-400 border-b border-white/10 pb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mt-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { isOnline, pendingCount } = useNetwork()
  const { showToast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [stats,         setStats]         = useState<DashboardStats | null>(null)
  const [recentEleves,  setRecentEleves]  = useState<RecentEleve[]>([])
  const [recentEmargements, setRecentEmargements] = useState<any[]>([])
  const [absencesJour, setAbsencesJour] = useState<any[]>([])
  const [presenceChart, setPresenceChart] = useState<{ jour: string; present: number; absent: number }[]>([])
  const [notesChart,    setNotesChart]    = useState<{ classe: string; moyenne: number }[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (profile?.role === 'superadmin') {
      router.push('/dashboard/superadmin')
    } else if (profile?.role === 'teacher') {
      router.push('/dashboard/teacher')
    }
  }, [profile, router])

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
      const today = getTodayDate()
      if (isOnlineSafe) void flushSyncQueue()
      
      if (db) {
        const localElevesIds = new Set((await db.eleves.where('ecole_id').equals(schoolId).toArray()).map(e => e.id))
        const [totalEleves, totalTeach, elevesImpayes, totalClasses, presRawToday] = await Promise.all([
          db.eleves.where('ecole_id').equals(schoolId).count(),
          db.profiles.where('ecole_id').equals(schoolId).and(p => p.role === 'teacher').count(),
          db.eleves.where('ecole_id').equals(schoolId).and(e => e.statut_paiement === 'impayé').count(),
          db.classes.where('ecole_id').equals(schoolId).count(),
          db.presences.where('date').equals(today).toArray(),
        ])
        
        const presencesAujourd = presRawToday.filter(p => localElevesIds.has(p.eleve_id) && (p.statut === 'présent' || p.statut === 'retard')).length

        setStats({
          totalEleves,
          totalEnseignants: totalTeach,
          elevesImpayes,
          totalClasses,
          presencesAujourd,
        })
      }

      if (isOnlineSafe) {
        setIsRefreshing(true)
        const [elRes, profRes, clRes, presRes] = await Promise.all([
          supabase.from('eleves').select('id, statut_paiement').eq('ecole_id', schoolId),
          supabase.from('profiles').select('id').eq('ecole_id', schoolId).eq('role', 'teacher'),
          supabase.from('classes').select('id').eq('ecole_id', schoolId),
          supabase.from('presences').select('id, eleve_id').eq('ecole_id', schoolId).eq('date', today).in('statut', ['présent', 'retard']),
        ])

        if (!elRes.error && !profRes.error && !clRes.error && !presRes.error) {
          const s: DashboardStats = {
            totalEleves: elRes.data?.length || 0,
            totalEnseignants: profRes.data?.length || 0,
            elevesImpayes: elRes.data?.filter((e: any) => e.statut_paiement === 'impayé').length || 0,
            totalClasses: clRes.data?.length || 0,
            presencesAujourd: presRes.data?.length || 0,
          }
          setStats(s)
          void syncFromSupabase(schoolId)
        }
        setIsRefreshing(false)
      }

      if (db) {
        const recents = await db.eleves.where('ecole_id').equals(schoolId).limit(6).toArray()
        const classesMap = new Map((await db.classes.where('ecole_id').equals(schoolId).toArray()).map(c => [c.id, c.nom_classe]))
        setRecentEleves(recents.map(e => ({ ...e, classe: { nom_classe: classesMap.get(e.classe_id) || 'N/A' } })) as unknown as RecentEleve[])

        const emargRaw = await db.emargements.where('ecole_id').equals(schoolId).reverse().limit(5).toArray()
        const [allProfs, allMats] = await Promise.all([db.profiles.where('ecole_id').equals(schoolId).toArray(), db.matieres.where('ecole_id').equals(schoolId).toArray()])
        const profMap = new Map(allProfs.map(p => [p.id, `${p.prenom} ${p.nom}`]))
        const matMap = new Map(allMats.map(m => [m.id, m.nom]))
        setRecentEmargements(emargRaw.map(e => ({ ...e, prof_nom: profMap.get(e.prof_id) || 'Inconnu', classe_nom: classesMap.get(e.classe_id) || 'N/A', matiere_nom: matMap.get(e.matiere_id) || 'N/A' })))

        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        const presRawAll = await db.presences.where('date').between(sevenDaysAgo.toISOString().split('T')[0], today + '\uffff').toArray()
        const allEleves = await db.eleves.where('ecole_id').equals(schoolId).toArray()
        const localElevesIds = new Set(allEleves.map(e => e.id))
        const eleveMap = new Map(allEleves.map(e => [e.id, e]))
        const presRaw = presRawAll.filter(p => localElevesIds.has(p.eleve_id))
        
        setAbsencesJour(presRaw.filter(p => p.date === today && (p.statut === 'absent' || p.statut === 'retard')).map(p => {
          const e = eleveMap.get(p.eleve_id)
          return { ...p, eleve_nom: e ? `${e.prenom} ${e.nom}` : 'Inconnu', telephone: e?.telephone_parent || '', classe_nom: classesMap.get(p.classe_id) || 'N/A' }
        }))

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
        setPresenceChart(Object.entries(presMap).map(([ds, counts]) => ({ jour: new Date(ds).toLocaleDateString('fr-FR', { weekday: 'short' }), ...counts })))

        const classesList = await db.classes.where('ecole_id').equals(schoolId).limit(6).toArray()
        const notesCache = await db.notes.where('ecole_id').equals(schoolId).toArray()
        const evalsCache = await db.evaluations.where('ecole_id').equals(schoolId).toArray()
        const evalsMap = new Map(evalsCache.map(v => [v.id, v]))
        const avgs = classesList.map(cl => {
          const classNotes = notesCache.filter(n => evalsMap.get(n.evaluation_id)?.classe_id === cl.id)
          if (!classNotes.length) return { classe: cl.nom_classe, moyenne: 0 }
          const studentIds = Array.from(new Set(classNotes.map(n => n.eleve_id)))
          const studentAverages = studentIds.map(sid => {
            const sNotes = classNotes.filter(n => n.eleve_id === sid)
            const notesCC = sNotes.filter(n => evalsMap.get(n.evaluation_id)?.type !== 'composition').map(n => (n.note / (evalsMap.get(n.evaluation_id)?.bareme || 20)) * 20)
            const noteCompRaw = sNotes.find(n => evalsMap.get(n.evaluation_id)?.type === 'composition')
            let noteComp = noteCompRaw ? (noteCompRaw.note / (evalsMap.get(noteCompRaw.evaluation_id)?.bareme || 20)) * 20 : null
            return CalculateurMoyennes.calculerMoyenneMatiereBase(notesCC, noteComp, 'BLOCKS', true).moyenne
          })
          return { classe: cl.nom_classe, moyenne: Math.round((studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length) * 100) / 100 }
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
      <div className="space-y-6 max-w-7xl mx-auto p-4">
        <Skeleton className="h-48 w-full rounded-[3rem]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard /> <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-[2.5rem]" />
          <Skeleton className="h-[300px] rounded-[2.5rem]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">

      {/* ── Visual Command Center ── */}
      <div className="relative bg-slate-950 rounded-[3rem] p-10 lg:p-14 text-white overflow-hidden shadow-2xl shadow-emerald-900/20 border border-white/5 group">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] -mr-48 -mt-48 transition-all group-hover:bg-emerald-600/20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/5 rounded-full blur-[100px] -ml-32 -mb-32" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center lg:text-left space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Direction Académique
            </div>
            <h1 className="text-4xl lg:text-6xl font-black tracking-tight leading-none">
              Bonjour, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-200">{profile?.prenom}!</span>
            </h1>
            <p className="text-slate-400 text-lg font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Votre établissement <span className="text-white font-bold">{ecole?.nom}</span> est sous contrôle. Voici les indicateurs clés de ce matin.
            </p>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
               <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Système Sécurisé</span>
               </div>
               <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Sync. Temps Réel</span>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-10 border border-white/10 text-center min-w-[180px] shadow-2xl transition-transform hover:scale-105">
              <p className="text-5xl font-black text-emerald-400 mb-2">{stats?.presencesAujourd ?? 0}</p>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Présences du jour</p>
              <div className="mt-4 flex items-center justify-center gap-1.5">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                 <span className="text-[9px] font-bold text-emerald-500/80 uppercase">En direct</span>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-10 border border-white/10 text-center min-w-[180px] shadow-2xl transition-transform hover:scale-105">
              <p className="text-5xl font-black text-amber-400 mb-2">{stats?.elevesImpayes ?? 0}</p>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Paiements dus</p>
              <div className="mt-4 flex items-center justify-center gap-1.5">
                 <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-tighter">Relances suggérées</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Core Statistics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard icon={Users}       label="Élèves inscrits"  value={stats?.totalEleves      ?? 0} color="emerald" trend={{ val: '+12%', positive: true }} />
        <StatCard icon={BookOpen}    label="Enseignants"      value={stats?.totalEnseignants ?? 0} color="blue"    subtitle="Personnel actif" />
        <StatCard icon={LayoutGrid}  label="Classes"          value={stats?.totalClasses     ?? 0} color="violet"  subtitle="Salles occupées" />
        <StatCard icon={AlertCircle} label="Alertes Frais"    value={stats?.elevesImpayes    ?? 0} color="amber"   trend={{ val: '-4%', positive: true }} />
      </div>

      {/* ── Analytics & Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 hover:shadow-xl transition-all duration-500">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                <Activity className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 text-base uppercase tracking-wider">Activité Présences</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Derniers 7 jours d&apos;appel</p>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
            {presenceChart.every((d) => d.present === 0 && d.absent === 0) ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">Aucune donnée disponible.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={presenceChart} barGap={6} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="jour" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: '900' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="present" name="Présents" fill="#10b981" radius={[8,8,0,0]} />
                  <Bar dataKey="absent"  name="Absents"  fill="#fbbf24" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 hover:shadow-xl transition-all duration-500">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 text-base uppercase tracking-wider">Performance Globale</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Moyennes par classe</p>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
            {notesChart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">Aucune note enregistrée.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={notesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="classe" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: '900' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="#3b82f6" strokeWidth={6}
                    dot={{ fill: '#3b82f6', strokeWidth: 3, r: 8, stroke: '#fff' }} 
                    activeDot={{ r: 10, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Operational Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Enrollments */}
        <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-8 py-7 border-b border-slate-50 bg-slate-50/30">
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
               <Users className="w-4 h-4 text-emerald-600" />
               Derniers inscrits
            </h2>
            <Link href="/dashboard/eleves" className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm">
              Gérer la liste
            </Link>
          </div>
          {recentEleves.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-sm italic">Aucun élève inscrit.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-50">
                  {recentEleves.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center text-white text-base font-black shadow-lg shadow-emerald-500/10 transition-transform group-hover:scale-110">
                            {e.prenom[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors uppercase">{e.prenom} {e.nom}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-0.5">{(e.classe as any)?.nom_classe}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className="text-[10px] font-mono font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg inline-block">{e.matricule}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Real-time Alerts */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-8 py-7 border-b border-slate-50 bg-amber-50/30">
            <h2 className="font-black text-amber-600 text-sm uppercase tracking-widest flex items-center gap-2">
               <AlertCircle className="w-4 h-4" />
               Vigilance Absences
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-200">
            {absencesJour.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-sm italic">Parfait ! Aucune alerte aujourd&apos;hui.</div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {absencesJour.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 px-8 py-5 hover:bg-slate-50 transition-colors group">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 transition-transform group-hover:scale-110 ${a.statut === 'absent' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                      {a.eleve_nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate uppercase group-hover:text-amber-600 transition-colors">{a.eleve_nom}</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{a.classe_nom} • {a.statut}</p>
                    </div>
                    {a.telephone && (
                      <button
                        onClick={() => {
                          const msg = encodeURIComponent(`Bonjour, l'école ${ecole?.nom} vous informe que votre enfant ${a.eleve_nom} a été marqué ${a.statut} aujourd'hui.`);
                          window.open(`https://wa.me/${a.telephone.replace(/\s+/g, '').replace('+', '')}?text=${msg}`, '_blank');
                        }}
                        className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95 shrink-0"
                        title="Informer les parents"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Shortcuts Panel */}
        <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { label: 'Inscrire un élève',  href: '/dashboard/eleves/nouveau', icon: Users, color: 'text-emerald-600 bg-emerald-50' },
             { label: 'Saisir les Notes',   href: '/dashboard/notes',         icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
             { label: 'Feuille d\'Appel',   href: '/dashboard/presences',     icon: UserCheck, color: 'text-amber-600 bg-amber-50' },
             { label: 'Configuration',      href: '/dashboard/parametres',    icon: BookOpen, color: 'text-violet-600 bg-violet-50' },
           ].map((a) => (
             <Link key={a.label} href={a.href} className="group bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col items-center text-center gap-4">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${a.color} shadow-lg shadow-black/5`}>
                   <a.icon className="w-8 h-8" />
                </div>
                <span className="text-xs font-black text-slate-600 group-hover:text-slate-900 uppercase tracking-widest">{a.label}</span>
             </Link>
           ))}
        </div>

      </div>
    </div>
  )
}
