'use client'

// src/app/dashboard/teacher/page.tsx
// Tableau de bord dédié aux enseignants
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Classe, Profile } from '@/lib/supabase'
import {
  BookOpen, Users, TrendingUp, UserCheck,
  ChevronRight, ClipboardList, Clock,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { getTodayDate } from '@/lib/dateUtils'

const GradesEntry       = dynamic(() => import('@/components/GradesEntry'),       { ssr: false })
const AttendanceScanner = dynamic(() => import('@/components/AttendanceScanner'), { ssr: false })
const TeacherTimetable  = dynamic(() => import('@/components/TeacherTimetable'),  { ssr: false })

type ActiveTab = 'apercu' | 'notes' | 'presences' | 'emploi'

interface ClasseStat {
  classe:       Classe
  nbEleves:     number
  nbNotes:      number
  presAujourd:  number
}

export default function TeacherDashboard() {
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [stats,   setStats]         = useState<ClasseStat[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<ActiveTab>('apercu')
  const [selectedClasse, setSelectedClasse] = useState<string>('')
  const [trimestre, setTrimestre] = useState<number>(1)
  const [isOnline, setIsOnline]     = useState(true)

  useEffect(() => { 
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    loadAll() 

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function loadAll() {
    try {
      if (!navigator.onLine) throw new Error('Offline mode')

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Auth required')

      const { data: prof, error: profError } = await (supabase
        .from('profiles').select('*').eq('user_id', user.id).single() as any)
      if (profError || !prof) throw new Error('Profile not found')
      setProfile(prof)

      // ── Restriction : ne charger que les classes assignées à cet enseignant ──
      const { data: assignations, error: assigError } = await supabase
        .from('enseignants_classes')
        .select('classe_id')
        .eq('enseignant_id', prof.id)

      if (assigError) throw new Error('Assignations failed')
      if (!assignations?.length) { 
        setLoading(false); 
        localStorage.setItem('edumatrix_teacher_stats', JSON.stringify([]))
        localStorage.setItem('edumatrix_teacher_profile', JSON.stringify(prof))
        return 
      }

      const classeIds = assignations.map((a: any) => a.classe_id)

      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .in('id', classeIds)
        .order('nom_classe')
      
      if (classesError || !classes?.length) throw new Error('Classes failed')

      const today = getTodayDate()

      const classStats = await Promise.all(
        classes.map(async (cl: any) => {
          const [{ count: nbEleves }, { count: nbNotes }, { count: presAujourd }] = await Promise.all([
            supabase.from('eleves').select('id', { count: 'exact', head: true }).eq('classe_id', cl.id),
            supabase.from('notes').select('id', { count: 'exact', head: true })
              .in('eleve_id', (await supabase.from('eleves').select('id').eq('classe_id', cl.id)).data?.map((e: any) => e.id) ?? []),
            supabase.from('presences').select('id', { count: 'exact', head: true })
              .eq('ecole_id', prof.ecole_id).eq('classe_id', cl.id).eq('date', today),
          ])
          return { classe: cl, nbEleves: nbEleves ?? 0, nbNotes: nbNotes ?? 0, presAujourd: presAujourd ?? 0 }
        })
      )

      setStats(classStats)
      if (classStats.length > 0) setSelectedClasse(classStats[0].classe.id)
      
      // Save to cache
      localStorage.setItem('edumatrix_teacher_stats', JSON.stringify(classStats))
      localStorage.setItem('edumatrix_teacher_profile', JSON.stringify(prof))
    } catch (e) {
      console.log("Erreur réseau ou chargement, passage en mode cache local", e)
      const cachedStats = localStorage.getItem('edumatrix_teacher_stats')
      const cachedProfile = localStorage.getItem('edumatrix_teacher_profile')
      
      if (cachedStats) {
        const parsedStats = JSON.parse(cachedStats)
        setStats(parsedStats)
        if (parsedStats.length > 0) setSelectedClasse(parsedStats[0].classe.id)
      }
      if (cachedProfile) {
        setProfile(JSON.parse(cachedProfile))
      }
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'apercu',    label: 'Aperçu',    icon: ClipboardList },
    { id: 'notes',     label: 'Notes',     icon: TrendingUp },
    { id: 'presences', label: 'Présences', icon: UserCheck },
    { id: 'emploi',    label: 'Planning',  icon: Clock },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top-4">
          <span className="text-xl">📶</span> 
          <span>Mode Hors-Ligne Actif - Modifications sauvegardées localement</span>
        </div>
      )}

      {/* Welcome Mobile-Optimized */}
      <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-blue-900 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-20" />
        <div className="relative z-10">
          <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm mb-3">
            Espace Enseignant
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Bonjour,<br/>{profile?.prenom} {profile?.nom}
          </h1>
          <p className="text-emerald-50/80 text-sm mt-2 font-medium">
            {stats.length} classe{stats.length > 1 ? 's' : ''} assignée{stats.length > 1 ? 's' : ''} cette année.
          </p>
        </div>
      </div>

      {/* Horizontal Scrollable Tabs */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-100 bg-slate-50/30 p-2 gap-2">
          {tabs.map((tab) => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex-none flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap
                 ${activeTab === tab.id
                   ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                   : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 bg-white border border-slate-100'
                 }`}
             >
               <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
               <span>{tab.label}</span>
             </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">

          {/* ── Aperçu ── */}
          {activeTab === 'apercu' && (
            <div className="space-y-3">
              {stats.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Aucune classe assignée pour le moment.
                </div>
              ) : (
                stats.map(({ classe, nbEleves, nbNotes, presAujourd }) => (
                  <div key={classe.id}
                    className="flex flex-col gap-4 p-5 border border-slate-200/60 rounded-[2rem] hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all group bg-white">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-3 rounded-2xl shrink-0 shadow-inner">
                        <BookOpen className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-black text-slate-900 text-lg truncate leading-tight">{classe.nom_classe}</p>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-widest mt-1 inline-block">
                              {classe.niveau}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats pills */}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex-1 min-w-[30%] bg-slate-50 rounded-xl p-2.5 flex items-center gap-2 border border-slate-100">
                        <div className="bg-white p-1.5 rounded-lg shadow-sm"><Users className="w-3.5 h-3.5 text-slate-400" /></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Élèves</p>
                          <p className="text-xs font-black text-slate-800">{nbEleves}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-[30%] bg-blue-500/10/50 rounded-xl p-2.5 flex items-center gap-2 border border-blue-100/50">
                        <div className="bg-white p-1.5 rounded-lg shadow-sm"><TrendingUp className="w-3.5 h-3.5 text-blue-400" /></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notes</p>
                          <p className="text-xs font-black text-blue-400">{nbNotes}</p>
                        </div>
                      </div>
                      <div className={`flex-1 min-w-[30%] rounded-xl p-2.5 flex items-center gap-2 border ${presAujourd > 0 ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="bg-white p-1.5 rounded-lg shadow-sm"><Clock className={`w-3.5 h-3.5 ${presAujourd > 0 ? 'text-emerald-500' : 'text-slate-400'}`} /></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Présents</p>
                          <p className={`text-xs font-black ${presAujourd > 0 ? 'text-emerald-800' : 'text-slate-800'}`}>{presAujourd}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions row mobile optimized */}
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => { setSelectedClasse(classe.id); setActiveTab('notes') }}
                        className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                      >
                        <TrendingUp className="w-4 h-4" /> Notes
                      </button>
                      <button
                        onClick={() => { setSelectedClasse(classe.id); setActiveTab('presences') }}
                        className="flex-1 py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <UserCheck className="w-4 h-4" /> Présences
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Notes ── */}
          {activeTab === 'notes' && <GradesEntry classeId={selectedClasse} trimestre={trimestre} />}

          {/* ── Présences ── */}
          {activeTab === 'presences' && (
            <div className="space-y-4">
              {/* Classe selector */}
              {stats.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Classe</label>
                  <select
                    value={selectedClasse}
                    onChange={(e) => setSelectedClasse(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {stats.map(({ classe }) => (
                      <option key={classe.id} value={classe.id}>{classe.nom_classe}</option>
                    ))}
                  </select>
                </div>
              )}
              {selectedClasse && <AttendanceScanner classeId={selectedClasse} />}
            </div>
          )}

          {/* ── Emploi du temps ── */}
          {activeTab === 'emploi' && profile && profile.ecole_id && (
            <TeacherTimetable
              enseignantId={profile.id}
              ecoleId={profile.ecole_id}
            />
          )}
        </div>
      </div>
    </div>
  )
}
