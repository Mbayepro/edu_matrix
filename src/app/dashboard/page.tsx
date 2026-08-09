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
  ShieldCheck, ArrowUpRight, ArrowDownRight, Clock, Sparkles, FileText, UsersRound, Settings, Zap
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
import FlashReportModal from '@/components/FlashReportModal'

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
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  }[color]

  return (
    <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 transition-colors hover:border-slate-700">
      
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${c}`}>
        <Icon className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-3xl font-bold text-white">{value.toLocaleString('fr-FR')}</h3>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trend.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {trend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.val}
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-slate-400">{label}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
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
  const [isFlashOpen,   setIsFlashOpen]   = useState(false)

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
        const [totalEleves, totalTeach, totalClasses, presRawToday] = await Promise.all([
          db.eleves.where('ecole_id').equals(schoolId).count(),
          db.profiles.where('ecole_id').equals(schoolId).and(p => p.role === 'teacher').count(),
          db.classes.where('ecole_id').equals(schoolId).count(),
          db.presences.where('date').equals(today).toArray(),
        ])
        
        const [fraisRaw, elevesFraisRaw, paiementsRaw] = await Promise.all([
          db.frais_scolaires.where('ecole_id').equals(schoolId).toArray(),
          db.eleves_frais.where('ecole_id').equals(schoolId).toArray(),
          db.paiements.where('ecole_id').equals(schoolId).toArray(),
        ])
        
        const isEleveEnRetard = (eleveId: string) => {
          const efs = elevesFraisRaw.filter(ef => ef.eleve_id === eleveId)
          let isLate = false
          
          for (const ef of efs) {
            const f = fraisRaw.find(fr => fr.id === ef.frais_id)
            if (f) {
              const lib = (f.libelle || '').toLowerCase()
              if (f.frequence === 'mensuel' || lib.includes('mensu') || lib.includes('scolarit')) {
                const SCHOOL_MONTHS = ['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet']
                const currentMonth = new Date().toLocaleString('fr-FR', { month: 'long' }).toLowerCase()
                let currentIndex = SCHOOL_MONTHS.findIndex(m => m.toLowerCase() === currentMonth)
                if (currentIndex === -1) {
                  const m = new Date().getMonth()
                  if (m === 7 || m === 8) currentIndex = SCHOOL_MONTHS.length - 1
                  else currentIndex = 0
                }
                
                const pastMonths = SCHOOL_MONTHS.slice(0, currentIndex + 1)
                const moisPayes = paiementsRaw.filter(p => p.eleve_id === eleveId && p.frais_id === ef.frais_id).map(p => p.mois).filter(Boolean)
                const retards = pastMonths.filter(m => !moisPayes.includes(m))
                if (retards.length > 0) isLate = true
              } else {
                const aPayer = Number(ef.montant_a_payer) || (Number(ef.montant_du) - (Number(ef.montant_remise) || 0)) || 0
                const paye = paiementsRaw.filter(p => p.eleve_id === eleveId && p.frais_id === ef.frais_id).reduce((s, p) => s + Number(p.montant), 0)
                if (aPayer > paye) isLate = true
              }
            }
          }
          return isLate
        }

        const elevesIdsArr = Array.from(localElevesIds)
        const elevesImpayes = elevesIdsArr.filter(id => isEleveEnRetard(id)).length

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
            elevesImpayes: stats?.elevesImpayes || 0, // Fallback on local indexeddb calculation
            totalClasses: clRes.data?.length || 0,
            presencesAujourd: presRes.data?.length || 0,
          }
          setStats(s)
          void syncFromSupabase(schoolId)
        }
        setIsRefreshing(false)
      }

      if (db) {
        const ecoleData = await db.ecoles.get(schoolId) as any
        const calculationMethod = ecoleData?.calculation_method || 'BLOCKS'

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
            const subjectIds = Array.from(new Set(sNotes.map(n => evalsMap.get(n.evaluation_id)?.matiere_id).filter(Boolean)))
            
            let totalAvg = 0;
            let validSubjects = 0;
            
            subjectIds.forEach(subId => {
              const subjectNotes = sNotes.filter(n => evalsMap.get(n.evaluation_id)?.matiere_id === subId)
              const notesCC = subjectNotes.filter(n => evalsMap.get(n.evaluation_id)?.type !== 'composition').map(n => (n.note / (evalsMap.get(n.evaluation_id)?.bareme || 20)) * 20)
              const noteCompRaw = subjectNotes.find(n => evalsMap.get(n.evaluation_id)?.type === 'composition')
              let noteComp = noteCompRaw ? (noteCompRaw.note / (evalsMap.get(noteCompRaw.evaluation_id)?.bareme || 20)) * 20 : null
              
              const avgObj = CalculateurMoyennes.calculerMoyenneMatiereBase(notesCC, noteComp, calculationMethod as any, true)
              if (avgObj.moyenne > 0) {
                 totalAvg += avgObj.moyenne
                 validSubjects++
              }
            })
            
            return validSubjects > 0 ? (totalAvg / validSubjects) : 0
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

  // Activity feed items (dynamic derivation)
  const activityLogs = [
    ...recentEmargements.map(e => ({
      time: e.created_at ? new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--',
      event: 'Émargement validé',
      details: `${e.matiere_nom} - ${e.classe_nom}`,
      icon: Activity,
      color: 'text-emerald-400'
    })),
    ...absencesJour.slice(0, 5).map(a => ({
      time: 'Aujourd\'hui',
      event: 'Absence signalée',
      details: `${a.eleve_nom} (${a.classe_nom})`,
      icon: AlertCircle,
      color: 'text-rose-400'
    }))
  ].sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 5)

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">

      {/* ── Intelligence Command Center ── */}
      <div className="relative bg-slate-900 rounded-[2rem] p-8 lg:p-12 text-white overflow-hidden shadow-lg border border-slate-800">
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex-1 text-center lg:text-left space-y-8">
            <div className="flex flex-col sm:flex-row items-center gap-4 lg:items-start">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Système Opérationnel
              </div>
              <div className="px-4 py-2 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="space-y-4">
               <h1 className="text-4xl lg:text-6xl font-bold tracking-tight mb-2">
                 Bonjour, <br/>
                 <span className="text-emerald-400">
                   {profile?.prenom || 'Directeur'}
                 </span>
               </h1>
            </div>
            <p className="text-slate-300 text-lg font-medium max-w-xl mx-auto lg:mx-0">
              L&apos;établissement <span className="text-white font-bold">{ecole?.nom}</span> est synchronisé. <br/>
              <span className="text-slate-400 text-sm mt-2 block">Tableau de bord de direction</span>
            </p>
            <div className="pt-4 flex justify-center lg:justify-start">
              <button 
                onClick={() => setIsFlashOpen(true)}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500 hover:text-slate-900 border border-amber-500/50 text-amber-400 font-black transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
              >
                <Zap className="w-5 h-5" />
                BILAN DU JOUR
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full lg:w-auto">
            <Link href="/dashboard/presences" className="bg-slate-800 rounded-[2rem] p-8 text-center border border-slate-700 hover:bg-slate-700/50 hover:border-emerald-500/50 transition-all block group">
              <p className="text-5xl font-bold text-emerald-400 mb-2 group-hover:scale-105 transition-transform">
                {stats?.presencesAujourd ?? 0}
              </p>
              <p className="text-sm text-slate-400 font-bold uppercase group-hover:text-slate-300">Présences</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-xs font-bold text-emerald-500">Aujourd'hui</span>
              </div>
            </Link>
            <Link href="/dashboard/paiements?tab=impayes" className="bg-slate-800 rounded-[2rem] p-8 text-center border border-slate-700 hover:bg-slate-700/50 hover:border-rose-500/50 transition-all block group">
              <p className="text-5xl font-bold text-rose-400 mb-2 group-hover:scale-105 transition-transform">
                {stats?.elevesImpayes ?? 0}
              </p>
              <p className="text-sm text-slate-400 font-bold uppercase group-hover:text-slate-300">Impayés</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                 <span className="text-xs font-bold text-rose-400 group-hover:text-rose-300">À vérifier</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Core Statistics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard icon={Users}       label="Élèves inscrits"  value={stats?.totalEleves      ?? 0} color="emerald" />
        <StatCard icon={BookOpen}    label="Enseignants"      value={stats?.totalEnseignants ?? 0} color="blue"    subtitle="Personnel actif" />
        <StatCard icon={LayoutGrid}  label="Classes"          value={stats?.totalClasses     ?? 0} color="violet"  subtitle="Salles occupées" />
        <StatCard icon={AlertCircle} label="Alertes Frais"    value={stats?.elevesImpayes    ?? 0} color="amber" />
      </div>

      {/* ── Analytics & Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-[2rem] p-6 lg:p-8 border border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base uppercase">Activité Présences</h2>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Derniers 7 jours d&apos;appel</p>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
            {presenceChart.every((d) => d.present === 0 && d.absent === 0) ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm italic">Aucune donnée disponible.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={presenceChart} barGap={6} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="jour" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="present" name="Présents" fill="#10b981" radius={[8,8,0,0]} />
                  <Bar dataKey="absent"  name="Absents"  fill="#fbbf24" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2rem] p-6 lg:p-8 border border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base uppercase">Performance Globale</h2>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Moyennes par classe</p>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
            {notesChart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm italic">Aucune note enregistrée.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={notesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="classe" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="#10b981" strokeWidth={4}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 6, stroke: '#0f172a' }} 
                    activeDot={{ r: 8, strokeWidth: 0 }} />
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
         <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden flex flex-col shadow-lg border border-slate-800">
            
            <div className="flex items-center justify-between mb-8 relative z-10">
               <div>
                  <h2 className="text-xl font-bold uppercase">Flux d'Activité</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase mt-1">Événements récents</p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-400" />
               </div>
            </div>

            <div className="space-y-6 relative z-10 flex-1">
               {activityLogs.map((log, i) => (
                  <div key={i} className="flex gap-4 group/log">
                     <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center ${log.color}`}>
                           <log.icon className="w-5 h-5" />
                        </div>
                        {i !== activityLogs.length - 1 && <div className="w-px flex-1 bg-slate-700" />}
                     </div>
                     <div className="pb-6">
                        <div className="flex items-center gap-3 mb-1">
                           <span className="text-xs font-bold text-slate-400">{log.time}</span>
                           <h4 className="text-sm font-bold text-white">{log.event}</h4>
                        </div>
                        <p className="text-sm text-slate-300 font-medium">{log.details}</p>
                     </div>
                  </div>
               ))}
            </div>

            <Link href="/dashboard/parametres" className="mt-4 py-4 rounded-xl bg-slate-800 border border-slate-700 text-center text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-sm">
               Historique complet
            </Link>
         </div>
      </div>

      {/* ── Operational Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        
        {/* Recent Enrollments */}
        <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-800/50">
            <h2 className="font-bold text-white text-base flex items-center gap-2">
               <Users className="w-5 h-5 text-emerald-400" />
               Derniers inscrits
            </h2>
            <Link href="/dashboard/eleves" className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
              Gérer la liste
            </Link>
          </div>
          {recentEleves.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm italic">Aucun élève inscrit.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-800">
                  {recentEleves.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center text-base font-bold transition-transform group-hover:scale-105">
                            {e.prenom[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors uppercase">{e.prenom} {e.nom}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">{(e.classe as any)?.nom_classe}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700 inline-block">{e.matricule}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Real-time Alerts */}
        <div className="bg-slate-900 rounded-[2rem] overflow-hidden flex flex-col border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-amber-500/10">
            <h2 className="font-bold text-amber-400 text-base flex items-center gap-2">
               <AlertCircle className="w-5 h-5" />
               Vigilance Absences
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-700">
            {absencesJour.length === 0 ? (
              <div className="p-16 text-center text-slate-500 text-sm italic">Parfait ! Aucune alerte aujourd&apos;hui.</div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {absencesJour.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/50 transition-colors group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${a.statut === 'absent' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {a.eleve_nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors uppercase">{a.eleve_nom}</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{a.classe_nom} • {a.statut}</p>
                    </div>
                    {a.telephone && (
                      <button
                        onClick={() => {
                          const msg = encodeURIComponent(`Bonjour, l'école ${ecole?.nom} vous informe que votre enfant ${a.eleve_nom} a été marqué ${a.statut} aujourd'hui.`);
                          window.open(`https://wa.me/${a.telephone.replace(/\s+/g, '').replace('+', '')}?text=${msg}`, '_blank');
                        }}
                        className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20 shrink-0"
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
        <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-6 gap-6">
           {[
             { label: 'Inscrire un élève',  href: '/dashboard/eleves/nouveau', icon: Users, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
             { label: 'Saisir les Notes',   href: '/dashboard/notes',         icon: TrendingUp, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
             { label: 'Feuille d\'Appel',   href: '/dashboard/presences',     icon: UserCheck, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
             { label: 'Imprimer Bulletins', href: '/dashboard/bulletins',     icon: FileText,   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
             { label: 'Conseil de Classe',  href: '/dashboard/conseil-classe', icon: UsersRound, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
             { label: 'Configuration',      href: '/dashboard/parametres',    icon: Settings,   color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
           ].map((a) => (
             <Link key={a.label} href={a.href} className="group bg-slate-900 rounded-[2rem] p-6 border border-slate-800 transition-all flex flex-col items-center text-center gap-4 hover:border-slate-700">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${a.color}`}>
                   <a.icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-300 group-hover:text-emerald-400 transition-colors">{a.label}</span>
             </Link>
           ))}
        </div>

      </div>

      <FlashReportModal 
        isOpen={isFlashOpen} 
        onClose={() => setIsFlashOpen(false)} 
        ecoleId={ecoleId || ''} 
        ecoleNom={ecole?.nom} 
      />
    </div>
  )
}
