'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { db } from '@/lib/db'
import { addToSyncQueue } from '@/lib/syncService'
import { getTodayDate } from '@/lib/dateUtils'
import {
  UserCheck, X, CheckCircle, Clock, MessageSquare, 
  ChevronLeft, Loader2, Sparkles, BookOpen, Save, AlertTriangle
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

interface EleveSession {
  id: string;
  prenom: string;
  nom: string;
  statut: 'présent' | 'absent' | 'retard';
  observation: string;
  points_merite: number;
}

export default function SessionModePage() {
  const params = useParams()
  const router = useRouter()
  const classeId = params.id as string
  const { profile } = useProfile()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [classe, setClasse] = useState<any>(null)
  const [matieres, setMatieres] = useState<any[]>([])
  const [selectedMatiereId, setSelectedMatiereId] = useState('')
  const [eleves, setEleves] = useState<EleveSession[]>([])
  const [sujetCours, setSujetCours] = useState('')
  const [startTime] = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (classeId) loadSessionData()
  }, [classeId])

  async function loadSessionData() {
    if (!db) return
    setLoading(true)
    try {
      const c = await db.classes.get(classeId)
      setClasse(c)

      // Charger les élèves
      const elData = await db.eleves.where('classe_id').equals(classeId).toArray()
      setEleves(elData.sort((a,b) => a.nom.localeCompare(b.nom)).map(e => ({
        id: e.id,
        prenom: e.prenom,
        nom: e.nom,
        statut: 'présent',
        observation: '',
        points_merite: (e as any).points_merite || 0
      })))

      // Charger les matières assignées au prof pour cette classe
      const { data: aff } = await supabase
        .from('enseignants_classes')
        .select('matiere_id, matiere:matieres(id, nom)')
        .eq('classe_id', classeId)
        .eq('enseignant_id', profile?.id) as { data: any[] }
      
      if (aff && aff.length > 0) {
        setMatieres(aff.map((a: any) => a.matiere))
        setSelectedMatiereId(aff[0].matiere_id)
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function updateStudent(id: string, updates: Partial<EleveSession>) {
    setEleves(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  async function handleFinishSession() {
    if (!selectedMatiereId) {
      showToast('Veuillez sélectionner une matière', 'error')
      return
    }
    if (!sujetCours.trim()) {
      showToast('Veuillez renseigner le sujet du cours', 'error')
      return
    }

    setSaving(true)
    try {
      const today = getTodayDate()
      const nowTime = new Date().toTimeString().split(' ')[0]
      const ecoleId = profile?.ecole_id

      if (!ecoleId) return

      // 1. Enregistrer l'émargement (Cahier de textes)
      const emargementId = crypto.randomUUID()
      const emargementData = {
        id: emargementId,
        ecole_id: ecoleId,
        prof_id: profile.id,
        classe_id: classeId,
        matiere_id: selectedMatiereId,
        date_heure: new Date().toISOString(),
        sujet_cours: sujetCours
      }

      if (db) await db.emargements.put(emargementData)
      await addToSyncQueue('emargements', 'INSERT', emargementData, ecoleId)

      // 2. Enregistrer les présences et observations
      for (const e of eleves) {
        const presenceId = crypto.randomUUID()
        const presenceData = {
          id: presenceId,
          ecole_id: ecoleId,
          eleve_id: e.id,
          classe_id: classeId,
          date: today,
          heure: nowTime,
          statut: e.statut,
          observation: e.observation
        }

        if (db) await db.presences.put(presenceData as any)
        await addToSyncQueue('presences', 'INSERT', presenceData as any, ecoleId)

        // 3. Mettre à jour les points de mérite si modifiés (Gamification)
        // Note: Ici on pourrait ajouter une logique plus fine, mais restons simple
        if (db) {
          await db.eleves.update(e.id, { points_merite: e.points_merite })
          // Pas besoin de sync immédiate ici si on n'a pas de table sync pour points_merite seule
          // On peut sync la table eleves complète
          const fullEleve = await db.eleves.get(e.id)
          if (fullEleve) {
             await addToSyncQueue('eleves', 'UPDATE', fullEleve as any, ecoleId)
          }
        }
      }

      showToast('Session clôturée avec succès !', 'success')
      router.push('/dashboard/prof')

    } catch (err) {
      console.error(err)
      showToast('Erreur lors de la clôture', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Initialisation de la session...</p>
      </div>
    )
  }

  const duration = Math.floor((currentTime.getTime() - startTime.getTime()) / 60000)

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Immersif */}
      <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-emerald-900/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -mr-32 -mt-32" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors mb-4"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Abandonner
            </button>
            <h1 className="text-3xl font-black tracking-tight">{classe?.nom_classe}</h1>
            <div className="flex items-center gap-4 text-emerald-400">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-bold">{duration} min en cours</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Mode Immersif</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-72 space-y-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Matière</label>
               <select 
                value={selectedMatiereId}
                onChange={(e) => setSelectedMatiereId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
               >
                 {matieres.map(m => <option key={m.id} value={m.id} className="bg-slate-900 text-white">{m.nom}</option>)}
               </select>
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Sujet du cours</label>
               <input 
                type="text"
                value={sujetCours}
                onChange={(e) => setSujetCours(e.target.value)}
                placeholder="Ex: Les fractions (Introduction)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-slate-600"
               />
            </div>
          </div>
        </div>
      </div>

      {/* Liste des élèves */}
      <div className="bg-white rounded-[3rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
           <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
             <UserCheck className="w-5 h-5 text-emerald-600" />
             Appel & Observations
           </h2>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{eleves.length} Élèves</span>
        </div>

        <div className="divide-y divide-slate-50">
          {eleves.map((eleve) => (
            <div key={eleve.id} className="p-6 md:p-8 hover:bg-slate-50/50 transition-colors group">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-base font-black shadow-lg shadow-black/10 transition-transform group-hover:scale-110">
                      {eleve.prenom[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 uppercase truncate">{eleve.prenom} {eleve.nom}</p>
                      <div className="flex items-center gap-2 mt-1">
                         <div className="flex items-center gap-1 text-amber-500">
                            <Sparkles className="w-3 h-3" />
                            <span className="text-[10px] font-black">{eleve.points_merite} pts</span>
                         </div>
                      </div>
                    </div>
                 </div>

                 <div className="flex flex-wrap items-center gap-2">
                    {[
                      { val: 'présent', label: 'Présent', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                      { val: 'absent',  label: 'Absent',  color: 'bg-rose-50 text-rose-600 border-rose-100' },
                      { val: 'retard',  label: 'Retard',  color: 'bg-amber-50 text-amber-600 border-amber-100' },
                    ].map(st => (
                      <button
                        key={st.val}
                        onClick={() => updateStudent(eleve.id, { statut: st.val as any })}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${eleve.statut === st.val ? `${st.color} shadow-sm ring-2 ring-offset-1 ring-current` : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                      >
                        {st.label}
                      </button>
                    ))}
                 </div>
               </div>

               {/* Zone d'observation et points */}
               <div className="mt-6 flex flex-col md:flex-row gap-4 items-end md:items-center">
                  <div className="flex-1 w-full relative">
                     <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                     <input 
                      type="text"
                      placeholder="Observation (ex: Très attentif, a oublié son cahier...)"
                      value={eleve.observation}
                      onChange={(e) => updateStudent(eleve.id, { observation: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-medium text-slate-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                     />
                  </div>
                  
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl">
                     <button 
                      onClick={() => updateStudent(eleve.id, { points_merite: Math.max(0, eleve.points_merite - 1) })}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all"
                     >-</button>
                     <span className="text-xs font-black text-slate-700 w-12 text-center">Bonus Pts</span>
                     <button 
                      onClick={() => updateStudent(eleve.id, { points_merite: eleve.points_merite + 1 })}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-all"
                     >+</button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-50">
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-[2rem] p-4 border border-white/10 shadow-2xl flex items-center justify-between gap-4">
           <div className="pl-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progression</p>
              <p className="text-xs font-bold text-white">
                {eleves.filter(e => e.statut !== 'présent').length} absences/retards
              </p>
           </div>
           <button
            onClick={handleFinishSession}
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-4 text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
           >
             {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
             Clôturer la séance
           </button>
        </div>
      </div>

    </div>
  )
}
