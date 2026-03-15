'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Classe, Profile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AttendanceScanner from '@/components/AttendanceScanner'
import { UserCheck, BookOpen, Clock, AlertCircle } from 'lucide-react'

interface PresenceDetail {
  id: string
  eleve_id: string
  statut: 'présent' | 'absent' | 'retard'
  heure: string
  eleve: { prenom: string, nom: string, matricule: string | null }
}

export default function PresencesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [classes, setClasses] = useState<Classe[]>([])
  
  const [loading, setLoading] = useState(true)
  const [selectedClasseId, setSelectedClasseId] = useState('')
  const [todayPresences, setTodayPresences] = useState<PresenceDetail[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedClasseId) {
      loadTodayPresences(selectedClasseId)
    }
  }, [selectedClasseId])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      if (prof.ecole_id) {
        const { data: cls } = await supabase
          .from('classes')
          .select('*')
          .eq('ecole_id', prof.ecole_id)
          .order('nom_classe')
        
        setClasses(cls || [])
        if (cls && cls.length > 0) {
          setSelectedClasseId(cls[0].id)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadTodayPresences(cId: string) {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('presences')
      .select('id, eleve_id, statut, heure, eleve:eleves(prenom, nom, matricule)')
      .eq('classe_id', cId)
      .eq('date', today)
      .order('heure', { ascending: false })
    
    setTodayPresences((data as any[]) || [])
  }

  if (loading) {
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

          {/* Right Col: Today's presences feed */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-slate-800">Historique des scans (Aujourd'hui)</h2>
                </div>
                <div className="bg-slate-100 text-slate-500 font-bold px-3 py-1 rounded-full text-xs">
                  {todayPresences.length}
                </div>
              </div>

              <div className="p-0 flex-1 overflow-y-auto max-h-[600px] bg-slate-50/50">
                {todayPresences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <AlertCircle className="w-8 h-8 mb-2 text-slate-300" />
                    <p className="text-sm">Aucun élève enregistré pour l'instant.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {todayPresences.map((p) => (
                      <li key={p.id} className="p-4 hover:bg-white transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0 uppercase border border-slate-200">
                            {p.eleve.prenom[0]}{p.eleve.nom[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">
                              {p.eleve.prenom} {p.eleve.nom}
                            </p>
                            {p.eleve.matricule && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                {p.eleve.matricule}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statutColors[p.statut]}`}>
                            {p.statut}
                          </span>
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {p.heure.slice(0, 5)}
                          </span>
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
