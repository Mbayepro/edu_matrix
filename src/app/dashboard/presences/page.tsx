'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import type { Classe, Profile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AttendanceScanner from '@/components/AttendanceScanner'
import { UserCheck, BookOpen, Clock, AlertCircle } from 'lucide-react'

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

  const [classes, setClasses] = useState<Classe[]>([])
  
  const [loading, setLoading] = useState(true)
  const [selectedClasseId, setSelectedClasseId] = useState('')
  const [eleves, setEleves] = useState<ElevePresence[]>([])
  const [marking, setMarking] = useState<string | null>(null)

  useEffect(() => {
    if (ecoleId) {
      loadData(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  useEffect(() => {
    if (selectedClasseId) {
      loadTodayPresences(selectedClasseId)
    }
  }, [selectedClasseId])

  async function loadData(schoolId: string) {
    try {
      setLoading(true)
      const { data: cls } = await supabase
        .from('classes')
        .select('*')
        .eq('ecole_id', schoolId)
        .order('nom_classe')
      
      setClasses(cls || [])
      if (cls && cls.length > 0) {
        setSelectedClasseId(cls[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadTodayPresences(cId: string) {
    const today = new Date().toISOString().split('T')[0]
    
    // Load all students for the class
    const { data: studentsData } = await supabase
      .from('eleves')
      .select('id, prenom, nom, matricule')
      .eq('classe_id', cId)
      .order('nom')

    // Load today's presences
    const { data: presencesData } = await supabase
      .from('presences')
      .select('id, eleve_id, statut, heure')
      .eq('classe_id', cId)
      .eq('date', today)

    const presencesMap = new Map()
    if (presencesData) {
      presencesData.forEach((p: any) => presencesMap.set(p.eleve_id, p))
    }

    const combined = (studentsData || []).map((s: any) => {
      const p = presencesMap.get(s.id)
      return {
        ...s,
        presence_id: p?.id,
        statut: p?.statut,
        heure: p?.heure
      }
    })

    setEleves(combined)
  }

  async function markPresenceManually(eleveId: string, statut: 'présent' | 'absent' | 'retard') {
    setMarking(eleveId)
    try {
      const today = new Date().toISOString().split('T')[0]
      const now = new Date().toTimeString().split(' ')[0]

      // Check if already exists
      const existing = eleves.find(e => e.id === eleveId)

      if (existing?.presence_id) {
        // Update
        await supabase
          .from('presences')
          .update({ statut, heure: now })
          .eq('id', existing.presence_id)
      } else {
        // Insert
        await supabase
          .from('presences')
          .insert({
            eleve_id: eleveId,
            classe_id: selectedClasseId,
            date: today,
            heure: now,
            statut
          })
      }
      // Reload
      await loadTodayPresences(selectedClasseId)
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

  const statutColors = {
    présent: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    absent: 'bg-red-50 text-red-600 border-red-200',
    retard: 'bg-amber-50 text-amber-600 border-amber-200',
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Présences</h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        
        {classes.length > 0 && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClasseId}
              onChange={(e) => setSelectedClasseId(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm font-semibold text-slate-700 pr-4 cursor-pointer"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.nom_classe}</option>
              ))}
            </select>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Col: Scanner */}
          <div className="lg:col-span-5">
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
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-slate-800">Appel de la classe</h2>
                </div>
                <div className="bg-slate-100 text-slate-500 font-bold px-3 py-1 rounded-full text-xs">
                  {eleves.filter(e => e.statut).length} / {eleves.length}
                </div>
              </div>

              <div className="p-0 flex-1 overflow-y-auto max-h-[600px] bg-slate-50/50">
                {eleves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
                    <p className="text-sm">Aucun élève dans cette classe.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {eleves.map((eleve) => (
                      <li key={eleve.id} className="p-4 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0 uppercase border border-slate-200">
                            {eleve.prenom[0]}{eleve.nom[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">
                              {eleve.prenom} {eleve.nom}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {eleve.matricule && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {eleve.matricule}
                                </span>
                              )}
                              {eleve.statut && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statutColors[eleve.statut]}`}>
                                  {eleve.statut}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {marking === eleve.id ? (
                            <div className="px-4 py-1 flex items-center text-xs text-slate-500">
                              Enregistrement...
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => markPresenceManually(eleve.id, 'présent')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  eleve.statut === 'présent' 
                                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-inner' 
                                    : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                }`}
                              >
                                Présent
                              </button>
                              <button
                                onClick={() => markPresenceManually(eleve.id, 'absent')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  eleve.statut === 'absent' 
                                    ? 'bg-red-500 text-white border-red-600 shadow-inner' 
                                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                }`}
                              >
                                Absent
                              </button>
                              <button
                                onClick={() => markPresenceManually(eleve.id, 'retard')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  eleve.statut === 'retard' 
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-inner' 
                                    : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                                }`}
                              >
                                Retard
                              </button>
                            </>
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
      )}
    </div>
  )
}
