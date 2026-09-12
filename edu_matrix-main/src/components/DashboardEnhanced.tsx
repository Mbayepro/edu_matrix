'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import {
  Users, BookOpen, AlertCircle, LayoutGrid,
  TrendingUp, UserCheck, Activity, ChevronRight, MessageCircle,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Clock, Sparkles, FileText, Settings, Minimize2, Maximize2, Eye, EyeOff
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
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

type WidgetId = 'stats' | 'charts' | 'recentEleves' | 'recentEmargements' | 'absences' | 'retardsPaiement' | 'shortcuts'

interface WidgetConfig {
  id: WidgetId
  title: string
  icon: React.ElementType
  defaultVisible: boolean
  priority: 'high' | 'medium' | 'low'
}

const WIDGETS: WidgetConfig[] = [
  { id: 'stats', title: 'Statistiques', icon: LayoutGrid, defaultVisible: true, priority: 'high' },
  { id: 'charts', title: 'Graphiques', icon: TrendingUp, defaultVisible: true, priority: 'medium' },
  { id: 'recentEleves', title: 'Élèves récents', icon: Users, defaultVisible: true, priority: 'medium' },
  { id: 'recentEmargements', title: 'Émargements récents', icon: FileText, defaultVisible: true, priority: 'low' },
  { id: 'absences', title: 'Absences du jour', icon: AlertCircle, defaultVisible: true, priority: 'high' },
  { id: 'retardsPaiement', title: 'Retards Paiement', icon: AlertCircle, defaultVisible: true, priority: 'high' },
  { id: 'shortcuts', title: 'Raccourcis', icon: Sparkles, defaultVisible: true, priority: 'medium' },
]

function StatCard({
  icon: Icon, label, value, color, subtitle, trend, compact
}: {
  icon: React.ElementType
  label: string
  value: number
  color: 'emerald' | 'blue' | 'amber' | 'violet'
  subtitle?: string
  trend?: { val: string, positive: boolean }
  compact?: boolean
}) {
  const c = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  }[color]

  if (compact) {
    return (
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-xl font-bold text-white">{value.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
    )
  }

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

export default function DashboardEnhanced() {
  const router = useRouter()
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { isOnline, pendingCount } = useNetwork()
  const { showToast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Dashboard modes
  const [compactMode, setCompactMode] = useState(false)
  const [visibleWidgets, setVisibleWidgets] = useState<Set<WidgetId>>(
    new Set(WIDGETS.filter(w => w.defaultVisible).map(w => w.id))
  )
  const [showWidgetSettings, setShowWidgetSettings] = useState(false)

  const [stats,         setStats]         = useState<DashboardStats | null>(null)
  const [recentEleves,  setRecentEleves]  = useState<RecentEleve[]>([])
  const [recentEmargements, setRecentEmargements] = useState<any[]>([])
  const [absencesJour, setAbsencesJour] = useState<any[]>([])
  const [retardsPaiement, setRetardsPaiement] = useState<any[]>([])
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
          db.eleves.where('ecole_id').equals(schoolId).and(e => e.statut_paiement === 'impayé' || e.statut_paiement === 'partiel').count(),
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
        
        const localEleves = await db.eleves.where('ecole_id').equals(schoolId).toArray()
        const localElevesIds = new Set(localEleves.map(e => e.id))
        const eleveMap = new Map(localEleves.map(e => [e.id, e]))
        const presRaw = presRawAll.filter(p => localElevesIds.has(p.eleve_id))

        const presencesTodayValid = await db.presences.where('date').equals(today).toArray()
        const absentsIds = new Set(presencesTodayValid.filter(p => p.statut === 'absent' || p.statut === 'retard').map(p => p.eleve_id))
        const elevesAbsents = localEleves.filter(e => absentsIds.has(e.id))
        const absencesData = elevesAbsents.map(e => {
          const pres = presencesTodayValid.find(p => p.eleve_id === e.id)
          return {
            eleve_nom: `${e.prenom} ${e.nom}`,
            classe_nom: classesMap.get(e.classe_id) || 'N/A',
            statut: pres?.statut || 'absent',
            telephone: e.telephone_parent || ''
          }
        })
        setAbsencesJour(absencesData)

        // Calcul des Retards de Paiement
        const impayesFull = localEleves.filter(e => e.statut_paiement === 'impayé' || e.statut_paiement === 'partiel')
        const allElevesFrais = await db.eleves_frais.where('ecole_id').equals(schoolId).toArray()
        const allPaiements = await db.paiements.where('ecole_id').equals(schoolId).toArray()

        const retardsData = impayesFull.map(e => {
          const efs = allElevesFrais.filter(ef => ef.eleve_id === e.id)
          const paims = allPaiements.filter(p => p.eleve_id === e.id)
          const totalDu = efs.reduce((sum, ef) => sum + (Number((ef as any).montant_a_payer) || (Number(ef.montant_du) - Number(ef.montant_remise))), 0)
          const totalPaye = paims.reduce((sum, p) => sum + Number(p.montant), 0)
          const reste = totalDu - totalPaye
          return {
            eleve_nom: `${e.prenom} ${e.nom}`,
            classe_nom: classesMap.get(e.classe_id) || 'N/A',
            reste,
            telephone: e.telephone_parent || ''
          }
        }).filter(r => r.reste > 0).sort((a, b) => b.reste - a.reste)

        setRetardsPaiement(retardsData)

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
    } catch (e) {
      console.error('[DashboardEnhanced] Erreur loadAll:', e)
    } finally {
      setLoading(false)
    }
  }

  const toggleWidget = (widgetId: WidgetId) => {
    setVisibleWidgets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(widgetId)) {
        newSet.delete(widgetId)
      } else {
        newSet.add(widgetId)
      }
      return newSet
    })
  }

  const highPriorityWidgets = WIDGETS.filter(w => w.priority === 'high')
  const visibleHighPriority = highPriorityWidgets.filter(w => visibleWidgets.has(w.id))
  const visibleOtherWidgets = WIDGETS.filter(w => w.priority !== 'high').filter(w => visibleWidgets.has(w.id))

  if (loading) return <div className="flex justify-center p-20"><RefreshCw className="animate-spin text-emerald-600" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de bord</h1>
          <p className="text-slate-400">Bienvenue, {profile?.prenom} {profile?.nom}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCompactMode(!compactMode)}
            className={`p-2 rounded-lg transition-colors ${
              compactMode ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title={compactMode ? 'Mode normal' : 'Mode compact'}
          >
            {compactMode ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowWidgetSettings(!showWidgetSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showWidgetSettings ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title="Personnaliser"
          >
            <Settings className="w-5 h-5" />
          </button>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{pendingCount} en attente</span>
            </div>
          )}
        </div>
      </div>

      {/* Widget Settings Panel */}
      {showWidgetSettings && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 animate-in slide-in-from-top duration-200">
          <h3 className="text-white font-medium mb-3">Personnaliser le tableau de bord</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {WIDGETS.map(widget => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                  visibleWidgets.has(widget.id)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                <widget.icon className="w-4 h-4" />
                <span className="text-sm">{widget.title}</span>
                {visibleWidgets.has(widget.id) ? <Eye className="w-4 h-4 ml-auto" /> : <EyeOff className="w-4 h-4 ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* High Priority Widgets (Always on top in compact mode) */}
      {visibleHighPriority.length > 0 && (
        <div className="space-y-4">
          {visibleHighPriority.map(widget => (
            <div key={widget.id} className="animate-in fade-in duration-300">
              {widget.id === 'stats' && stats && (
                <div className={compactMode ? 'grid grid-cols-2 md:grid-cols-4 gap-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}>
                  <StatCard icon={Users} label="Élèves" value={stats.totalEleves} color="emerald" compact={compactMode} />
                  <StatCard icon={UserCheck} label="Enseignants" value={stats.totalEnseignants} color="blue" compact={compactMode} />
                  <StatCard icon={AlertCircle} label="Impayés" value={stats.elevesImpayes} color="amber" subtitle="Frais scolaires" compact={compactMode} />
                  <StatCard icon={Activity} label="Présents" value={stats.presencesAujourd} color="violet" subtitle="Aujourd'hui" compact={compactMode} />
                </div>
              )}

              {widget.id === 'absences' && absencesJour.length > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-bold text-white">Absences du jour</h3>
                    <span className="ml-auto text-sm text-slate-400">{absencesJour.length} absent(s)</span>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {absencesJour.map((absence, idx) => {
                      const hasPhone = !!absence.telephone
                      const phoneForWa = absence.telephone ? absence.telephone.replace(/\s+/g, '') : ''
                      const waMessage = absence.statut === 'absent'
                        ? `Bonjour, sauf erreur de notre part, nous vous informons que votre enfant ${absence.eleve_nom} est absent(e) ce jour (${getTodayDate()}).`
                        : `Bonjour, nous vous informons que votre enfant ${absence.eleve_nom} est arrivé(e) en retard ce jour (${getTodayDate()}).`

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg group">
                          <div>
                            <p className="font-medium text-white text-sm">{absence.eleve_nom}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-slate-400">{absence.classe_nom}</p>
                              <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                {absence.statut}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            {hasPhone && (
                              <>
                                <a 
                                  href={`tel:${phoneForWa}`}
                                  title="Appeler"
                                  className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                </a>
                                <a 
                                  href={`https://wa.me/${phoneForWa}?text=${encodeURIComponent(waMessage)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="WhatsApp"
                                  className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {widget.id === 'retardsPaiement' && retardsPaiement.length > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <h3 className="text-lg font-bold text-white">Retards de Paiement</h3>
                    <span className="ml-auto text-sm text-slate-400">{retardsPaiement.length} élève(s)</span>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {retardsPaiement.map((retard, idx) => {
                      const hasPhone = !!retard.telephone
                      const phoneForWa = retard.telephone ? retard.telephone.replace(/\s+/g, '') : ''
                      const waMessage = `Bonjour, sauf erreur de notre part, nous vous informons que votre enfant ${retard.eleve_nom} a un reste à payer de ${retard.reste.toLocaleString('fr-FR')} FCFA. Merci de bien vouloir vous rapprocher de l'administration.`

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg group">
                          <div>
                            <p className="font-medium text-white text-sm">{retard.eleve_nom}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-slate-400">{retard.classe_nom}</p>
                              <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                Reste: {retard.reste.toLocaleString('fr-FR')} F
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            {hasPhone && (
                              <>
                                <a 
                                  href={`tel:${phoneForWa}`}
                                  title="Appeler"
                                  className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                </a>
                                <a 
                                  href={`https://wa.me/${phoneForWa}?text=${encodeURIComponent(waMessage)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Rappel WhatsApp"
                                  className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Other Widgets */}
      {visibleOtherWidgets.length > 0 && (
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${compactMode ? 'hidden' : ''}`}>
          {visibleOtherWidgets.map(widget => (
            <div key={widget.id} className="animate-in fade-in duration-300">
              {widget.id === 'charts' && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Activité de présence</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={presenceChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="jour" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {widget.id === 'recentEleves' && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Élèves récents</h3>
                  <div className="space-y-3">
                    {recentEleves.slice(0, 5).map((eleve) => (
                      <Link key={eleve.id} href={`/dashboard/eleves/${eleve.id}`} className="block">
                        <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <span className="text-emerald-400 font-bold">{eleve.prenom[0]}{eleve.nom[0]}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-white">{eleve.prenom} {eleve.nom}</p>
                            <p className="text-sm text-slate-400">{eleve.classe?.nom_classe}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {widget.id === 'recentEmargements' && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Émargements récents</h3>
                  <div className="space-y-3">
                    {recentEmargements.map((emarg, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-white">{emarg.prof_nom}</p>
                          <span className="text-xs text-slate-400">{new Date(emarg.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <p className="text-sm text-slate-400">{emarg.matiere_nom} • {emarg.classe_nom}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {widget.id === 'shortcuts' && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Raccourcis</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Link href="/dashboard/notes" className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                      <BookOpen className="w-6 h-6 text-emerald-400 mb-2" />
                      <p className="font-medium text-white text-sm">Notes</p>
                    </Link>
                    <Link href="/dashboard/presences" className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                      <UserCheck className="w-6 h-6 text-blue-400 mb-2" />
                      <p className="font-medium text-white text-sm">Présences</p>
                    </Link>
                    <Link href="/dashboard/paiements" className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                      <ShieldCheck className="w-6 h-6 text-amber-400 mb-2" />
                      <p className="font-medium text-white text-sm">Paiements</p>
                    </Link>
                    <Link href="/dashboard/bulletins" className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                      <FileText className="w-6 h-6 text-violet-400 mb-2" />
                      <p className="font-medium text-white text-sm">Bulletins</p>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Compact Mode - Show all widgets in single column */}
      {compactMode && visibleOtherWidgets.length > 0 && (
        <div className="space-y-4">
          {visibleOtherWidgets.map(widget => (
            <div key={widget.id} className="animate-in FadeIn duration-300">
              {widget.id === 'charts' && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                  <h3 className="text-sm font-bold text-white mb-3">Présences (7j)</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={presenceChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="jour" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="present" fill="#10b981" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="absent" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {widget.id === 'shortcuts' && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                  <h3 className="text-sm font-bold text-white mb-3">Raccourcis</h3>
                  <div className="grid grid-cols-4 gap-2">
                    <Link href="/dashboard/notes" className="p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-center">
                      <BookOpen className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      <p className="text-xs text-white">Notes</p>
                    </Link>
                    <Link href="/dashboard/presences" className="p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-center">
                      <UserCheck className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                      <p className="text-xs text-white">Présences</p>
                    </Link>
                    <Link href="/dashboard/paiements" className="p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-center">
                      <ShieldCheck className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                      <p className="text-xs text-white">Paiements</p>
                    </Link>
                    <Link href="/dashboard/bulletins" className="p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-center">
                      <FileText className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                      <p className="text-xs text-white">Bulletins</p>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
