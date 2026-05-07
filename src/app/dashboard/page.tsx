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
import DailyReport from '@/components/DailyReport'
import AtRiskPanel from '@/components/AtRiskPanel'
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
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/10',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-amber-500/10',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20 shadow-violet-500/10',
  }[color]

  return (
    <div className="premium-glass rounded-[3rem] p-8 transition-all duration-500 group relative overflow-hidden premium-glass-hover">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
      
      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-6 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 shadow-2xl ${c}`}>
        <Icon className="w-8 h-8" />
      </div>

      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-4xl font-black text-white tracking-tighter">{value.toLocaleString('fr-FR')}</h3>
          {trend && (
            <div className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-xl border ${trend.positive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
              {trend.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {trend.val}
            </div>
          )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
        {subtitle && (
          <div className="flex items-center gap-2 mt-4">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{subtitle}</p>
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
        <Skeleton className="h-48 w-full rounded-[4rem]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard /> <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-[3rem]" />
          <Skeleton className="h-[300px] rounded-[3rem]" />
        </div>
      </div>
    )
  }

  // Activity feed items (mock logic for demo if no real logs yet)
  const activityLogs = [
    { time: '15:42', event: 'Émargement validé', details: 'Maths - 3ème B', icon: Activity, color: 'text-emerald-400' },
    { time: '15:30', event: 'Nouveau paiement', details: 'Frais inscription - Diop M.', icon: Sparkles, color: 'text-amber-400' },
    { time: '14:15', event: 'Alerte Absence', details: '5 élèves non signalés', icon: AlertCircle, color: 'text-rose-400' },
    { time: '11:00', event: 'Note saisie', details: 'Français - Terminale S', icon: TrendingUp, color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">

      {/* ── Intelligence Command Center ── */}
      <div className="relative premium-glass rounded-[4rem] p-10 lg:p-16 text-white overflow-hidden shadow-2xl border border-white/5 group transition-all duration-1000 hover:shadow-emerald-500/10">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[150px] -mr-64 -mt-64 animate-pulse pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-400/5 rounded-full blur-[120px] -ml-32 -mb-32 pointer-events-none" />
        
        {/* System Pulse Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
          <div className="flex-1 text-center lg:text-left space-y-10">
            <div className="flex flex-col sm:flex-row items-center gap-4 lg:items-start">
              <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 shadow-2xl">
                <div className="relative w-2.5 h-2.5">
                   <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                   <div className="relative w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                </div>
                Live Systems · Operational
              </div>
              <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-400">
                {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · GMT+0
              </div>
            </div>

            <div className="space-y-4">
               <h1 className="text-6xl lg:text-8xl font-black tracking-tighter leading-[0.8] mb-4">
                 Bonjour, <br/>
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-200 animate-gradient drop-shadow-sm">
                   {profile?.prenom || 'Directeur'}
                 </span>
               </h1>
               <div className="w-20 h-2 bg-emerald-500/30 rounded-full" />
            </div>
            <p className="text-slate-300 text-xl lg:text-2xl font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed tracking-tight">
              L&apos;établissement <span className="text-white font-black border-b-4 border-emerald-500/30 pb-1">{ecole?.nom}</span> est synchronisé. <br/>
              <span className="text-slate-500 text-sm font-black uppercase tracking-[0.2em] mt-4 block">Dashboard de contrôle global</span>
            </p>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4">
               <div className="flex items-center gap-3 bg-white/5 backdrop-blur-3xl px-8 py-4 rounded-[2rem] border border-white/10 transition-all hover:bg-white/10 hover:border-emerald-500/30 hover:scale-105 shadow-xl">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Certifié RLS</span>
               </div>
               <div className="flex items-center gap-3 bg-white/5 backdrop-blur-3xl px-8 py-4 rounded-[2rem] border border-white/10 transition-all hover:bg-white/10 hover:border-amber-500/30 hover:scale-105 shadow-xl">
                  <Activity className="w-6 h-6 text-amber-400 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Flux Local-First</span>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full lg:w-auto">
            <div className="bg-white/5 backdrop-blur-3xl rounded-[3rem] p-12 border text-center shadow-2xl transition-all hover:scale-105 hover:bg-white/10 group/card relative overflow-hidden border-emerald-500/10">
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
              <p className="text-7xl font-black text-emerald-400 mb-2 emerald-glow-text leading-none tracking-tighter">
                {stats?.presencesAujourd ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] relative z-10">Présences</p>
              <div className="mt-6 flex items-center justify-center gap-2 relative z-10">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">En direct</span>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-3xl rounded-[3rem] p-12 border text-center shadow-2xl transition-all hover:scale-105 hover:bg-white/10 group/card relative overflow-hidden border-rose-500/10">
              <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
              <p className="text-7xl font-black text-rose-400 mb-2 leading-none tracking-tighter shadow-rose-500/20 drop-shadow-xl">
                {stats?.elevesImpayes ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] relative z-10">Impayés</p>
              <div className="mt-6 flex items-center justify-center gap-2 relative z-10">
                 <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">Alerte Seuil</span>
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
        <div className="premium-glass rounded-[3rem] p-8 transition-all duration-500">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-sm">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-black text-white text-base uppercase tracking-wider">Activité Présences</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Derniers 7 jours d&apos;appel</p>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
            {presenceChart.every((d) => d.present === 0 && d.absent === 0) ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm italic">Aucune donnée disponible.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={presenceChart} barGap={6} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="jour" tick={{ fontSize: 10, fill: '#64748b', fontWeight: '900' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                  <Bar dataKey="present" name="Présents" fill="#10b981" radius={[8,8,0,0]} />
                  <Bar dataKey="absent"  name="Absents"  fill="#fbbf24" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="premium-glass rounded-[3rem] p-8 transition-all duration-500">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-sm">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="font-black text-white text-base uppercase tracking-wider">Performance Globale</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Moyennes par classe</p>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
            {notesChart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm italic">Aucune note enregistrée.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={notesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="classe" tick={{ fontSize: 10, fill: '#64748b', fontWeight: '900' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="#60a5fa" strokeWidth={6}
                    dot={{ fill: '#60a5fa', strokeWidth: 3, r: 8, stroke: '#050505' }} 
                    activeDot={{ r: 10, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── High-Level Command Center ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <DailyReport ecoleId={ecoleId || ''} />
         <AtRiskPanel ecoleId={ecoleId || ''} />
         
         {/* ── Intelligence Feed ── */}
         <div className="bg-[#0A0A0A] rounded-[4rem] p-10 text-white relative overflow-hidden flex flex-col shadow-2xl border border-white/5 group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] -mr-40 -mt-40 transition-all duration-1000 group-hover:scale-150" />
            
            <div className="flex items-center justify-between mb-10 relative z-10">
               <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">Intelligence Stream</h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Événements en direct</p>
               </div>
               <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
               </div>
            </div>

            <div className="space-y-6 relative z-10 flex-1">
               {activityLogs.map((log, i) => (
                  <div key={i} className="flex gap-5 group/log hover:translate-x-2 transition-transform cursor-default">
                     <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${log.color} group-hover/log:scale-110 transition-transform`}>
                           <log.icon className="w-5 h-5" />
                        </div>
                        {i !== activityLogs.length - 1 && <div className="w-px flex-1 bg-white/5" />}
                     </div>
                     <div className="pb-6">
                        <div className="flex items-center gap-3 mb-1">
                           <span className="text-[10px] font-black text-slate-500">{log.time}</span>
                           <h4 className="text-xs font-black uppercase tracking-widest text-white group-hover/log:text-blue-400 transition-colors">{log.event}</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium tracking-tight">{log.details}</p>
                     </div>
                  </div>
               ))}
            </div>

            <Link href="/dashboard/parametres" className="mt-4 py-5 rounded-[2rem] bg-white/5 border border-white/10 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-white/10 hover:text-white transition-all shadow-xl group/btn overflow-hidden relative">
               <div className="absolute inset-0 bg-blue-500/5 translate-y-full group-hover/btn:translate-y-0 transition-transform" />
               <span className="relative z-10">Historique complet</span>
            </Link>
         </div>
      </div>

      {/* ── Operational Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Enrollments */}
        <div className="lg:col-span-2 premium-glass rounded-[3rem] overflow-hidden">
          <div className="flex items-center justify-between px-8 py-7 border-b border-white/5 bg-white/5">
            <h2 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
               <Users className="w-4 h-4 text-emerald-400" />
               Derniers inscrits
            </h2>
            <Link href="/dashboard/eleves" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shadow-sm">
              Gérer la liste
            </Link>
          </div>
          {recentEleves.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm italic">Aucun élève inscrit.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-white/5">
                  {recentEleves.map((e) => (
                    <tr key={e.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center text-white text-base font-black shadow-lg shadow-emerald-500/10 transition-transform group-hover:scale-110">
                            {e.prenom[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-white truncate group-hover:text-emerald-400 transition-colors uppercase">{e.prenom} {e.nom}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter mt-0.5">{(e.classe as any)?.nom_classe}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className="text-[10px] font-mono font-black text-slate-400 bg-white/5 px-2 py-1 rounded-lg inline-block border border-white/5">{e.matricule}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Real-time Alerts */}
        <div className="premium-glass rounded-[3rem] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-8 py-7 border-b border-white/5 bg-amber-500/5">
            <h2 className="font-black text-amber-400 text-sm uppercase tracking-widest flex items-center gap-2">
               <AlertCircle className="w-4 h-4" />
               Vigilance Absences
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-white/10">
            {absencesJour.length === 0 ? (
              <div className="p-16 text-center text-slate-500 text-sm italic">Parfait ! Aucune alerte aujourd&apos;hui.</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {absencesJour.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 px-8 py-5 hover:bg-white/5 transition-colors group">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 transition-transform group-hover:scale-110 ${a.statut === 'absent' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {a.eleve_nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate uppercase group-hover:text-amber-400 transition-colors">{a.eleve_nom}</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{a.classe_nom} • {a.statut}</p>
                    </div>
                    {a.telephone && (
                      <button
                        onClick={() => {
                          const msg = encodeURIComponent(`Bonjour, l'école ${ecole?.nom} vous informe que votre enfant ${a.eleve_nom} a été marqué ${a.statut} aujourd'hui.`);
                          window.open(`https://wa.me/${a.telephone.replace(/\s+/g, '').replace('+', '')}?text=${msg}`, '_blank');
                        }}
                        className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95 shrink-0 border border-emerald-500/20"
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
             { label: 'Inscrire un élève',  href: '/dashboard/eleves/nouveau', icon: Users, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
             { label: 'Saisir les Notes',   href: '/dashboard/notes',         icon: TrendingUp, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
             { label: 'Feuille d\'Appel',   href: '/dashboard/presences',     icon: UserCheck, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
             { label: 'Configuration',      href: '/dashboard/parametres',    icon: BookOpen, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
           ].map((a) => (
             <Link key={a.label} href={a.href} className="group premium-glass rounded-[3rem] p-8 transition-all duration-700 flex flex-col items-center text-center gap-5 premium-glass-hover border-white/5">
                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 ${a.color} shadow-2xl`}>
                   <a.icon className="w-10 h-10" />
                </div>
                <span className="text-[11px] font-black text-slate-400 group-hover:text-emerald-400 uppercase tracking-[0.2em] transition-colors">{a.label}</span>
             </Link>
           ))}
        </div>

      </div>
    </div>
  )
}
