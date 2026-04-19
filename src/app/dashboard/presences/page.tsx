'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import type { Classe, Profile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AttendanceScanner from '@/components/AttendanceScanner'
import { UserCheck, BookOpen, Clock, AlertCircle, Loader2, QrCode } from 'lucide-react'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { db } from '@/lib/db'
import { addToSyncQueue, syncFromSupabase } from '@/lib/syncService'
import { useNetwork } from '@/hooks/useNetwork'
import { getTodayDate, formatDateLong } from '@/lib/dateUtils'

interface ElevePresence {
  id: string
  prenom: string
  nom: string
  matricule: string | null
  presence_id?: string
  statut?: 'présent' | 'absent' | 'retard'
  heure?: string
}

export default function PresencesPage() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const isTeacher = profile?.role === 'teacher'

  // Pour les profs : charger uniquement leurs classes assignées
  const { classeIds: teacherClasseIds, loading: teacherLoading } = useTeacherClasses(
    isTeacher ? profile?.id : null
  )

  const { isOnline, pendingCount } = useNetwork();

  const [classes, setClasses] = useState<Classe[]>([])
  
  const [loading, setLoading] = useState(true)
  const [selectedClasseId, setSelectedClasseId] = useState('')
  const [eleves, setEleves] = useState<ElevePresence[]>([])
  const [marking, setMarking] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'scanner' | 'list'>('scanner')

  useEffect(() => {
    if (profileLoading) return
    if (!ecoleId) { setLoading(false); return }
    // Pour les profs, attendre que les assignations soient chargées
    if (isTeacher && teacherLoading) return

    if (isTeacher) {
      loadDataForTeacher()
    } else {
      loadData(ecoleId)
    }
  }, [ecoleId, profileLoading, isTeacher, teacherLoading, teacherClasseIds.join(',')])

  useEffect(() => {
    if (selectedClasseId) {
      loadTodayPresences(selectedClasseId)
    }
  }, [selectedClasseId])

  // Directeur / superadmin : toutes les classes de l'école
  async function loadData(schoolId: string) {
    if (!db) return
    try {
      setLoading(true)
      // 1. Lire depuis Dexie
      let cls = await db.classes.where('ecole_id').equals(schoolId).sortBy('nom_classe')
      setClasses(cls as unknown as Classe[])
      if (cls && cls.length > 0) setSelectedClasseId(cls[0].id)

      // 2. Si Online, Sync du fond
      if (isOnline) {
        await syncFromSupabase(schoolId)
        // Refresh local
        const freshCls = await db.classes.where('ecole_id').equals(schoolId).sortBy('nom_classe')
        setClasses(freshCls as unknown as Classe[])
      }
    } finally {
      setLoading(false)
    }
  }

  // Professeur : seulement ses classes assignées
  async function loadDataForTeacher() {
    if (!ecoleId || !db) return
    try {
      setLoading(true)
      if (!teacherClasseIds.length) {
        setClasses([])
        return
      }
      // 1. Lire depuis Dexie
      let cls = await db.classes.where('ecole_id').equals(ecoleId).toArray()
      cls = cls.filter(c => teacherClasseIds.includes(c.id))
      cls.sort((a, b) => a.nom_classe.localeCompare(b.nom_classe))
      
      setClasses(cls as unknown as Classe[])
      if (cls && cls.length > 0) setSelectedClasseId(cls[0].id)

      // 2. Si Online, Sync
      if (isOnline) {
        await syncFromSupabase(ecoleId)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadTodayPresences(cId: string) {
    if (!db) return
    const today = getTodayDate()
    
    // Load all students for the class from Dexie
    const studentsData = await db.eleves.where('classe_id').equals(cId).toArray()
    const sortedStudents = studentsData.sort((a,b) => a.nom.localeCompare(b.nom))

    // Load today's presences from Dexie
    const presencesData = await db.presences
      .where('classe_id').equals(cId)
      .and(p => p.date === today)
      .toArray()

    const presencesMap = new Map()
    if (presencesData) {
      presencesData.forEach((p: any) => presencesMap.set(p.eleve_id, p))
    }

    const combined = sortedStudents.map((s: any) => {
      const p = presencesMap.get(s.id)
      return {
        ...s,
        presence_id: p?.id,
        statut: p?.statut,
        heure: p?.heure
      }
    })

    setEleves(combined as ElevePresence[])
  }

  async function markPresenceManually(eleveId: string, statut: 'présent' | 'absent' | 'retard') {
    setMarking(eleveId)
    try {
      const today = getTodayDate()
      const now = new Date().toTimeString().split(' ')[0]
      const existing = eleves.find(e => e.id === eleveId)
      
      const pId = existing?.presence_id || crypto.randomUUID()

      const presenceData = {
        id: pId,
        ecole_id: ecoleId,
        eleve_id: eleveId,
        classe_id: selectedClasseId,
        date: today,
        heure: now,
        statut
      }

      // 1. Local & Optimistic (avec ecole_id pour Dexie)
      if (db) {
        await db.presences.put(presenceData as any)
        setEleves(prev => prev.map(e => e.id === eleveId ? { ...e, presence_id: pId, statut, heure: now } : e))
      }

      // 2. Queue
      if (ecoleId) {
        await addToSyncQueue('presences', 'INSERT', presenceData as any, ecoleId)
      }
    } finally {
      setMarking(null)
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const filteredEleves = eleves.filter(e => 
    `${e.prenom} ${e.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.matricule?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const statutColors = {
    présent: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    absent: 'bg-red-50 text-red-600 border-red-200',
    retard: 'bg-amber-50 text-amber-600 border-amber-200',
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Feuille de Présence</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            {formatDateLong(new Date())}
          </p>
        </div>

        {classes.length > 0 && (
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm relative group overflow-hidden transition-all hover:border-emerald-200">
            <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/5 rounded-full -mr-4 -mt-4 transition-transform group-hover:scale-150" />
            <div className="flex items-center gap-3 relative z-10">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <select
                value={selectedClasseId}
                onChange={(e) => setSelectedClasseId(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-sm font-black text-slate-900 pr-8 cursor-pointer appearance-none"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.nom_classe}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-500 shadow-sm">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <h2 className="text-lg font-bold text-slate-800 mb-1">Aucune classe disponible</h2>
          <p className="text-sm">Veuillez d'abord créer une classe avant de marquer les présences.</p>
        </div>
      ) : (
        <>
          {/* Tabs for Mobile */}
          <div className="flex lg:hidden bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'scanner' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Scanner
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Liste d&apos;appel
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Col: Scanner */}
            <div className={`lg:col-span-5 ${activeTab === 'scanner' ? 'block' : 'hidden lg:block'}`}>
              <div className="sticky top-24">
                <div onClick={() => loadTodayPresences(selectedClasseId)}>
                  <AttendanceScanner classeId={selectedClasseId} />
                </div>
                <div className="mt-4 text-center">
                   <button 
                    onClick={() => loadTodayPresences(selectedClasseId)} 
                    className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1"
                   >
                     <Clock className="w-3 h-3" />
                     Actualiser la liste
                   </button>
                </div>
              </div>
            </div>

            {/* Right Col: Class List */}
            <div className={`lg:col-span-7 ${activeTab === 'list' ? 'block' : 'hidden lg:block'}`}>
              <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden h-full flex flex-col transition-all duration-500 hover:shadow-xl hover:shadow-emerald-900/5">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-800 leading-tight">Appel de la Classe</h2>
                      </div>
                    </div>
                    <div className="bg-slate-900 text-white font-black px-3 py-1 rounded-lg text-[9px] uppercase tracking-widest shadow-lg shadow-slate-900/10">
                      {eleves.filter(e => e.statut).length} / {eleves.length}
                    </div>
                  </div>
                  
                  {/* Search Bar - More Compact */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">S</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-4 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="p-0 flex-1 overflow-y-auto max-h-[600px] bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
                  {eleves.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                      <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-sm">Aucun élève dans cette classe.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {filteredEleves.map((eleve) => (
                        <li key={eleve.id} className="px-6 py-4 hover:bg-white transition-all duration-300 group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 uppercase border border-slate-200/50 group-hover:scale-110 transition-transform duration-500">
                              {eleve.prenom[0]}{eleve.nom[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors truncate">
                                {eleve.prenom} {eleve.nom}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {eleve.matricule && (
                                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded">
                                    {eleve.matricule}
                                  </span>
                                )}
                                {eleve.statut && (
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-[0.1em] shadow-sm ${statutColors[eleve.statut]}`}>
                                    {eleve.statut}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {marking === eleve.id ? (
                              <div className="px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse bg-slate-50 rounded-xl">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Synced…
                              </div>
                            ) : (
                              <div className="inline-flex p-0.5 bg-slate-50 border border-slate-200/60 rounded-xl gap-0.5">
                                <button
                                  onClick={() => markPresenceManually(eleve.id, 'présent')}
                                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    eleve.statut === 'présent' 
                                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                                      : 'text-slate-400 hover:text-emerald-600 hover:bg-white'
                                  }`}
                                >
                                  P
                                </button>
                                <button
                                  onClick={() => markPresenceManually(eleve.id, 'absent')}
                                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    eleve.statut === 'absent' 
                                      ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' 
                                      : 'text-slate-400 hover:text-red-600 hover:bg-white'
                                  }`}
                                >
                                  A
                                </button>
                                <button
                                  onClick={() => markPresenceManually(eleve.id, 'retard')}
                                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                    eleve.statut === 'retard' 
                                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                                      : 'text-slate-400 hover:text-amber-600 hover:bg-white'
                                  }`}
                                >
                                  R
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
