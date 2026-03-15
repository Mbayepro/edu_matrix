'use client'

// src/app/dashboard/admin/emploi-du-temps/page.tsx
// Directeur : Gérer l'emploi du temps hebdomadaire de chaque enseignant

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Classe, Matiere, EmploiDuTemps } from '@/lib/supabase'
import { Loader2, Plus, Trash2, Calendar, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const

// Palette de couleurs par index de matière (cycling)
const COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
]

interface Slot extends EmploiDuTemps {
  classe?: Classe
  matiere?: Matiere
  enseignant?: Profile
}

const HEURES = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00']

export default function EmploiDuTempsPage() {
  const router = useRouter()
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    jour: 1 as number,
    classe_id: '',
    matiere_id: '',
    heure_debut: '08:00',
    heure_fin: '10:00',
    salle: '',
  })

  useEffect(() => { init() }, [])
  useEffect(() => { if (ecoleId && selectedTeacher) loadSlots() }, [selectedTeacher, ecoleId])

  async function init() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!prof || (prof.role !== 'director' && prof.role !== 'admin')) { router.push('/dashboard'); return }
      setEcoleId(prof.ecole_id)

      const [{ data: tch }, { data: cls }, { data: mat }] = await Promise.all([
        supabase.from('profiles').select('*').eq('ecole_id', prof.ecole_id).eq('role', 'teacher').order('nom'),
        supabase.from('classes').select('*').eq('ecole_id', prof.ecole_id).order('nom_classe'),
        supabase.from('matieres').select('*').eq('ecole_id', prof.ecole_id).order('nom'),
      ])
      setTeachers((tch ?? []) as Profile[])
      setClasses(cls ?? [])
      setMatieres((mat ?? []) as Matiere[])
      if (tch?.length) {
        setSelectedTeacher(tch[0].id)
        setForm(f => ({ ...f, classe_id: cls?.[0]?.id ?? '', matiere_id: (mat as any[])?.[0]?.id ?? '' }))
      }
    } finally { setLoading(false) }
  }

  async function loadSlots() {
    if (!ecoleId || !selectedTeacher) return
    const { data } = await supabase
      .from('emploi_du_temps')
      .select(`*, classe:classes!classe_id(id, nom_classe, niveau), matiere:matieres!matiere_id(id, nom)`)
      .eq('ecole_id', ecoleId)
      .eq('enseignant_id', selectedTeacher)
      .order('jour').order('heure_debut')
    setSlots((data ?? []) as Slot[])
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!ecoleId || !selectedTeacher) return

    // Vérification de chevauchement côté client
    const newStart = form.heure_debut
    const newEnd = form.heure_fin
    const overlap = slots.find(s =>
      s.jour === form.jour &&
      s.heure_debut < newEnd &&
      s.heure_fin > newStart
    )
    if (overlap) {
      showToast(`⚠️ Conflit horaire avec ${overlap.matiere?.nom ?? 'un cours'} (${overlap.heure_debut.slice(0,5)}–${overlap.heure_fin.slice(0,5)})`, false)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('emploi_du_temps').insert({
        ecole_id: ecoleId,
        enseignant_id: selectedTeacher,
        classe_id: form.classe_id,
        matiere_id: form.matiere_id || null,
        jour: form.jour,
        heure_debut: form.heure_debut + ':00',
        heure_fin: form.heure_fin + ':00',
        salle: form.salle || null,
      })
      if (error) { showToast('Erreur : ' + error.message, false); return }
      showToast('✅ Créneau ajouté !')
      setShowForm(false)
      await loadSlots()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await supabase.from('emploi_du_temps').delete().eq('id', id)
    showToast('Créneau supprimé.')
    await loadSlots()
  }

  const matiereColorMap: Record<string, string> = {}
  matieres.forEach((m, i) => { matiereColorMap[m.id] = COLORS[i % COLORS.length] })

  const selectedTeacherProfile = teachers.find(t => t.id === selectedTeacher)

  const slotsForDay = (jour: number) =>
    slots.filter(s => s.jour === jour).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut))

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 text-sm px-5 py-3 rounded-2xl shadow-lg font-medium ${
          toast.ok ? 'bg-slate-800 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2.5 rounded-xl">
            <Calendar className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Emploi du temps</h1>
            <p className="text-sm text-slate-500">Planifiez les créneaux hebdomadaires de chaque enseignant.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un créneau
        </button>
      </div>

      {/* Teacher selector */}
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <label className="text-sm font-medium text-slate-600 shrink-0">Enseignant :</label>
        <select
          value={selectedTeacher}
          onChange={e => setSelectedTeacher(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {teachers.map(t => (
            <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>
          ))}
        </select>
        {selectedTeacherProfile && (
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
            {slots.length} créneau{slots.length > 1 ? 'x' : ''}
          </span>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Nouveau créneau — {selectedTeacherProfile?.prenom} {selectedTeacherProfile?.nom}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Jour *</label>
              <select value={form.jour} onChange={e => setForm(f => ({ ...f, jour: +e.target.value }))} className={inputCls} required>
                {[1,2,3,4,5,6].map(j => <option key={j} value={j}>{JOURS[j]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Heure début *</label>
              <select value={form.heure_debut} onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))} className={inputCls} required>
                {HEURES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Heure fin *</label>
              <select value={form.heure_fin} onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))} className={inputCls} required>
                {HEURES.filter(h => h > form.heure_debut).map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Classe *</label>
              <select value={form.classe_id} onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))} className={inputCls} required>
                <option value="">Choisir…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom_classe}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Matière</label>
              <select value={form.matiere_id} onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {matieres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Salle</label>
              <input
                type="text"
                value={form.salle}
                onChange={e => setForm(f => ({ ...f, salle: e.target.value }))}
                placeholder="Salle 12, Labo…"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Annuler</button>
            <button
              type="submit"
              disabled={saving || !form.classe_id}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </button>
          </div>
        </form>
      )}

      {/* Weekly grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(jour => {
          const daySlots = slotsForDay(jour)
          return (
            <div key={jour} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className={`px-4 py-2.5 flex items-center justify-between ${daySlots.length ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                <span className="font-bold text-slate-700 text-sm">{JOURS[jour]}</span>
                <span className="text-xs text-slate-400">{daySlots.length} cours</span>
              </div>
              <div className="p-3 space-y-2 min-h-[80px]">
                {daySlots.length === 0 ? (
                  <p className="text-center text-slate-300 text-xs py-4">Aucun cours</p>
                ) : daySlots.map(s => {
                  const color = s.matiere_id ? matiereColorMap[s.matiere_id] ?? COLORS[0] : 'bg-slate-100 text-slate-700 border-slate-200'
                  return (
                    <div key={s.id} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${color}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs truncate">{s.matiere?.nom ?? 'Cours'}</p>
                        <p className="text-[10px] opacity-70">{s.classe?.nom_classe}</p>
                        <p className="text-[10px] opacity-80 font-mono mt-0.5">
                          {s.heure_debut.slice(0,5)} → {s.heure_fin.slice(0,5)}
                          {s.salle ? ` · ${s.salle}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
