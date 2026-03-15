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

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('user_id', user.id).single()
      if (!prof) return
      setProfile(prof)

      // ── Restriction : ne charger que les classes assignées à cet enseignant ──
      const { data: assignations } = await supabase
        .from('enseignants_classes')
        .select('classe_id')
        .eq('enseignant_id', prof.id)

      // Si aucune assignation → tableau vide (pas toutes les classes de l'école)
      if (!assignations?.length) { setLoading(false); return }

      const classeIds = assignations.map((a: any) => a.classe_id)

      const { data: classes } = await supabase
        .from('classes')
        .select('*')
        .in('id', classeIds)
        .order('nom_classe')
      if (!classes?.length) { setLoading(false); return }

      const today = new Date().toISOString().split('T')[0]

      const classStats = await Promise.all(
        classes.map(async (cl: any) => {
          const [{ count: nbEleves }, { count: nbNotes }, { count: presAujourd }] = await Promise.all([
            supabase.from('eleves').select('id', { count: 'exact', head: true }).eq('classe_id', cl.id),
            supabase.from('notes').select('id', { count: 'exact', head: true })
              .in('eleve_id', (await supabase.from('eleves').select('id').eq('classe_id', cl.id)).data?.map((e: any) => e.id) ?? []),
            supabase.from('presences').select('id', { count: 'exact', head: true })
              .eq('classe_id', cl.id).eq('date', today),
          ])
          return { classe: cl, nbEleves: nbEleves ?? 0, nbNotes: nbNotes ?? 0, presAujourd: presAujourd ?? 0 }
        })
      )

      setStats(classStats)
      if (classStats.length > 0) setSelectedClasse(classStats[0].classe.id)
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

      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-900 to-teal-900 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '28px 28px' }} />
        <div className="relative">
          <p className="text-blue-300 text-sm">Espace enseignant</p>
          <h1 className="text-xl font-bold mt-0.5">{profile?.prenom} {profile?.nom}</h1>
          <p className="text-blue-300 text-sm mt-1">
            {stats.length} classe{stats.length > 1 ? 's' : ''} assignée{stats.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-5">

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
                    className="flex items-start gap-4 p-4 border border-slate-100 rounded-xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group">
                    <div className="bg-blue-100 p-2.5 rounded-xl shrink-0">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800">{classe.nom_classe}</p>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          {classe.niveau}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="w-3 h-3" />
                          {nbEleves} élève{nbEleves > 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <TrendingUp className="w-3 h-3" />
                          {nbNotes} note{nbNotes > 1 ? 's' : ''} saisies
                        </span>
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${presAujourd > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          <Clock className="w-3 h-3" />
                          {presAujourd} présence{presAujourd > 1 ? 's' : ''} aujourd'hui
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => { setSelectedClasse(classe.id); setActiveTab('notes') }}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                      >
                        Notes <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setSelectedClasse(classe.id); setActiveTab('presences') }}
                        className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium"
                      >
                        Présences <ChevronRight className="w-3 h-3" />
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
