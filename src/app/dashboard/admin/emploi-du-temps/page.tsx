'use client'

// src/app/dashboard/admin/emploi-du-temps/page.tsx
// Module Visuel des Emplois du Temps

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Classe, Matiere, EmploiDuTemps } from '@/lib/supabase'
import { Loader2, Plus, Trash2, Calendar, Clock, LayoutGrid, Users, Bell, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const

const COLORS = [
  'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 border-indigo-500/20',
]

interface Slot extends EmploiDuTemps {
  classe?: Classe
  matiere?: Matiere
  enseignant?: Profile
}

const HEURES = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
const ALL_HEURES = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00']

export default function EmploiDuTempsPage() {
  const router = useRouter()
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [selectedClasse, setSelectedClasse] = useState<string>('')
  const { showToast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'live' | 'teacher' | 'classe'>('live')
  const [currentTime, setCurrentTime] = useState(new Date())

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    jour: 1 as number,
    classe_id: '',
    matiere_id: '',
    heure_debut: '08:00',
    heure_fin: '10:00',
    salle: '',
  })

  useEffect(() => { 
    init()
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])
  
  useEffect(() => { 
    if (ecoleId) loadAllSlots() 
  }, [ecoleId])

  async function init() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await (supabase.from('profiles').select('*').eq('user_id', user.id).single() as any)
      if (!prof || (prof.role !== 'director' && prof.role !== 'admin')) { router.push('/dashboard'); return }
      setEcoleId(prof.ecole_id)

      const [{ data: tch }, { data: cls }, { data: mat }] = await Promise.all([
        supabase.from('profiles' as any).select('*').eq('ecole_id', prof.ecole_id).eq('role', 'teacher').order('nom'),
        supabase.from('classes' as any).select('*').eq('ecole_id', prof.ecole_id).order('nom_classe'),
        supabase.from('matieres' as any).select('*').eq('ecole_id', prof.ecole_id).order('nom'),
      ])
      setTeachers((tch ?? []) as Profile[])
      setClasses(cls ?? [])
      setMatieres((mat ?? []) as Matiere[])
      if ((tch as any)?.length) setSelectedTeacher((tch as any)[0].id)
      if ((cls as any)?.length) setSelectedClasse((cls as any)[0].id)
      
    } finally { setLoading(false) }
  }

  async function loadAllSlots() {
    if (!ecoleId) return
    const { data } = await supabase
      .from('emploi_du_temps')
      .select(`*, classe:classes!classe_id(id, nom_classe, niveau), matiere:matieres!matiere_id(id, nom), enseignant:profiles!enseignant_id(id, nom, prenom)`)
      .eq('ecole_id', ecoleId)
      .order('jour').order('heure_debut')
    setAllSlots((data ?? []) as Slot[])
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!ecoleId || !selectedTeacher) return

    // Vérification de chevauchement (Professeur)
    const newStart = form.heure_debut
    const newEnd = form.heure_fin
    const overlapProf = allSlots.find(s =>
      s.enseignant_id === selectedTeacher &&
      s.jour === form.jour &&
      s.heure_debut < newEnd &&
      s.heure_fin > newStart
    )
    if (overlapProf) {
      showToast(`Conflit horaire pour le professeur avec ${overlapProf.matiere?.nom ?? 'un cours'} (${overlapProf.heure_debut.slice(0,5)}–${overlapProf.heure_fin.slice(0,5)})`, 'error')
      return
    }
    
    // Vérification de chevauchement (Classe)
    const overlapClasse = allSlots.find(s =>
      s.classe_id === form.classe_id &&
      s.jour === form.jour &&
      s.heure_debut < newEnd &&
      s.heure_fin > newStart
    )
    if (overlapClasse) {
      showToast(`La classe a déjà un cours de ${overlapClasse.matiere?.nom ?? 'quelque chose'} à cette heure.`, 'error')
      return
    }

    // Vérification de chevauchement (Salle)
    if (form.salle) {
      const overlapSalle = allSlots.find(s =>
        s.salle?.toLowerCase() === form.salle.toLowerCase() &&
        s.jour === form.jour &&
        s.heure_debut < newEnd &&
        s.heure_fin > newStart
      )
      if (overlapSalle) {
        showToast(`La salle ${form.salle} est déjà occupée par la classe ${overlapSalle.classe?.nom_classe || ''} à cette heure.`, 'error')
        return
      }
    }

    setSaving(true)
    try {
      const { error } = await (supabase.from('emploi_du_temps' as any) as any).insert({
        ecole_id: ecoleId,
        enseignant_id: selectedTeacher,
        classe_id: form.classe_id,
        matiere_id: form.matiere_id || null,
        jour: form.jour,
        heure_debut: form.heure_debut + ':00',
        heure_fin: form.heure_fin + ':00',
        salle: form.salle || null,
      })
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Créneau ajouté avec succès !', 'success')
      setShowForm(false)
      setForm({
        jour: 1,
        classe_id: '',
        matiere_id: '',
        heure_debut: '08:00',
        heure_fin: '10:00',
        salle: '',
      })
      await loadAllSlots()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await (supabase.from('emploi_du_temps' as any) as any).delete().eq('id', id)
    showToast('Créneau supprimé.', 'success')
    await loadAllSlots()
  }

  const matiereColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    matieres.forEach((m, i) => { map[m.id] = COLORS[i % COLORS.length] })
    return map
  }, [matieres])

  // Current Live Info
  const currentDay = currentTime.getDay() === 0 ? 7 : currentTime.getDay() // 1=Lundi
  const currentHourString = currentTime.toTimeString().slice(0, 5)
  const liveSlots = allSlots.filter(s => s.jour === currentDay && s.heure_debut.slice(0,5) <= currentHourString && s.heure_fin.slice(0,5) >= currentHourString)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
    </div>
  )

  const renderVisualGrid = (slots: Slot[]) => {
    // Les heures vont de 07:00 à 18:00
    const startHour = 7;
    const endHour = 18;
    const rowHeight = 64; // h-16 = 64px

    return (
      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="min-w-[800px] p-4">
          {/* Header des jours */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            <div className="text-right pr-4 pt-2 text-xs font-bold text-slate-400">Heures</div>
            {[1,2,3,4,5,6].map(jour => (
              <div key={jour} className="text-center font-bold text-slate-700 bg-slate-50 py-2 rounded-xl text-sm">
                {JOURS[jour]}
              </div>
            ))}
          </div>

          {/* Corps du calendrier */}
          <div className="grid grid-cols-7 gap-2 relative" style={{ height: `${(endHour - startHour + 1) * rowHeight}px` }}>
            {/* Colonne des heures */}
            <div className="col-span-1 relative">
              {HEURES.map((h, i) => (
                <div key={h} className="absolute w-full text-right pr-4 text-xs font-bold text-slate-400" style={{ top: `${i * rowHeight}px` }}>
                  <span className="-mt-2 block bg-white px-1 right-0 absolute">{h}</span>
                </div>
              ))}
            </div>

            {/* Grille de fond et Cours */}
            <div className="col-span-6 grid grid-cols-6 gap-2 relative">
              {/* Lignes horizontales de fond */}
              <div className="absolute inset-0 pointer-events-none">
                {HEURES.map((h, i) => (
                  <div key={`line-${h}`} className="w-full border-t border-slate-100" style={{ top: `${i * rowHeight}px`, height: `${rowHeight}px`, position: 'absolute' }} />
                ))}
              </div>

              {[1,2,3,4,5,6].map(jour => {
                const daySlots = slots.filter(s => s.jour === jour)
                return (
                  <div key={`col-${jour}`} className="col-span-1 relative border-l border-slate-100 h-full">
                    {daySlots.map(slot => {
                      const [sh, sm] = slot.heure_debut.split(':').map(Number);
                      const [eh, em] = slot.heure_fin.split(':').map(Number);
                      const startOffset = (sh - startHour) + (sm / 60);
                      const duration = (eh - sh) + ((em - sm) / 60);
                      
                      return (
                        <div 
                          key={slot.id} 
                          className={`absolute left-1 right-1 rounded-xl p-2 text-xs shadow-sm overflow-hidden flex flex-col justify-between group ${slot.matiere_id ? matiereColorMap[slot.matiere_id] : 'bg-slate-100'}`}
                          style={{ 
                            top: `${startOffset * rowHeight}px`, 
                            height: `${duration * rowHeight - 4}px` 
                          }}
                        >
                          <div className="font-bold truncate">{slot.matiere?.nom || 'Cours'}</div>
                          <div className="flex justify-between items-end">
                            <span className="font-mono text-[10px] opacity-75">{slot.heure_debut.slice(0,5)} - {slot.heure_fin.slice(0,5)}</span>
                            <span className="truncate max-w-[60px] opacity-90">{activeTab === 'teacher' ? slot.classe?.nom_classe : slot.enseignant?.prenom}</span>
                          </div>
                          <button onClick={() => handleDelete(slot.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-white/50 rounded transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-3 rounded-2xl shadow-inner">
            <LayoutGrid className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Emplois du Temps</h1>
            <p className="text-sm text-slate-500 font-medium">Planification visuelle et suivi en direct des cours.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          Nouveau Cours
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-3xl border border-emerald-200 shadow-xl shadow-emerald-900/5 p-6 space-y-5 animate-in slide-in-from-top-4">
          <h2 className="font-black text-slate-800 text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Placer un cours
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="xl:col-span-2">
              <label htmlFor="enseignant_id" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Enseignant *</label>
              <select id="enseignant_id" value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors font-medium" required>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
              </select>
            </div>
            <div className="xl:col-span-2">
              <label htmlFor="classe_id" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Classe *</label>
              <select id="classe_id" value={form.classe_id} onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors font-medium" required>
                <option value="">Choisir la classe…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom_classe}</option>)}
              </select>
            </div>
            <div className="xl:col-span-2">
              <label htmlFor="matiere_id" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Matière</label>
              <select id="matiere_id" value={form.matiere_id} onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors font-medium">
                <option value="">(Optionnel)</option>
                {matieres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="jour" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Jour *</label>
              <select id="jour" value={form.jour} onChange={e => setForm(f => ({ ...f, jour: +e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors font-medium" required>
                {[1,2,3,4,5,6].map(j => <option key={j} value={j}>{JOURS[j]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="heure_debut" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Début *</label>
              <select id="heure_debut" value={form.heure_debut} onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors font-medium font-mono" required>
                {ALL_HEURES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="heure_fin" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Fin *</label>
              <select id="heure_fin" value={form.heure_fin} onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors font-medium font-mono" required>
                {ALL_HEURES.filter(h => h > form.heure_debut).map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="salle" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Salle</label>
              <input id="salle" type="text" value={form.salle} onChange={e => setForm(f => ({ ...f, salle: e.target.value }))} placeholder="Ex: S12" className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors font-medium" />
            </div>
            <div className="xl:col-span-2 flex items-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors w-full sm:w-auto">Annuler</button>
              <button type="submit" disabled={saving || !form.classe_id} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors shadow-lg">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Valider
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex border-b-2 border-slate-200 overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab('live')} className={`px-6 py-3 font-black text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'live' ? 'text-rose-600 border-b-2 border-rose-600 -mb-0.5' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
          En Direct (Alertes)
        </button>
        <button onClick={() => setActiveTab('teacher')} className={`px-6 py-3 font-black text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'teacher' ? 'text-indigo-400 border-b-2 border-indigo-600 -mb-0.5' : 'text-slate-400 hover:text-slate-600'}`}>
          <Users className="w-4 h-4" />
          Vue Professeurs
        </button>
        <button onClick={() => setActiveTab('classe')} className={`px-6 py-3 font-black text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'classe' ? 'text-indigo-400 border-b-2 border-indigo-600 -mb-0.5' : 'text-slate-400 hover:text-slate-600'}`}>
          <LayoutGrid className="w-4 h-4" />
          Vue Classes
        </button>
      </div>

      {/* Tab: En Direct */}
      {activeTab === 'live' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-rose-900 flex items-center gap-2 mb-1">
                <Bell className="w-5 h-5" /> Situation actuelle
              </h2>
              <p className="text-rose-700/80 font-medium text-sm">
                Aujourd'hui, {JOURS[currentDay]} à <span className="font-mono font-bold bg-rose-200/50 px-1 rounded">{currentHourString}</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-100 flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-black text-slate-800">{liveSlots.length}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cours en cours</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {liveSlots.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 font-medium">
                Aucun cours n'est planifié à cette heure.
              </div>
            ) : liveSlots.map(slot => (
              <div key={slot.id} className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div>
                    <h3 className="font-black text-slate-800">{slot.enseignant?.prenom} {slot.enseignant?.nom}</h3>
                    <p className="text-xs font-bold text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded mt-1">Professeur censé être présent</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black uppercase text-slate-400">Classe</p>
                    <p className="font-black text-slate-700">{slot.classe?.nom_classe}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center pl-4 border border-slate-100">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{slot.matiere?.nom || 'Cours'}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{slot.heure_debut.slice(0,5)} - {slot.heure_fin.slice(0,5)} {slot.salle ? `• Salle ${slot.salle}` : ''}</p>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition-colors">
                    <AlertTriangle className="w-3 h-3" /> Signaler Retard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Vue Professeurs */}
      {activeTab === 'teacher' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <label className="text-sm font-bold text-slate-600 uppercase tracking-widest shrink-0">Filtrer :</label>
            <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="flex-1 border-none focus:ring-0 text-sm font-bold text-slate-800 bg-transparent cursor-pointer outline-none">
              {teachers.map(t => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
            </select>
          </div>
          {renderVisualGrid(allSlots.filter(s => s.enseignant_id === selectedTeacher))}
        </div>
      )}

      {/* Tab: Vue Classes */}
      {activeTab === 'classe' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <label className="text-sm font-bold text-slate-600 uppercase tracking-widest shrink-0">Classe :</label>
            <select value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)} className="flex-1 border-none focus:ring-0 text-sm font-bold text-slate-800 bg-transparent cursor-pointer outline-none">
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom_classe}</option>)}
            </select>
          </div>
          {renderVisualGrid(allSlots.filter(s => s.classe_id === selectedClasse))}
        </div>
      )}

    </div>
  )
}