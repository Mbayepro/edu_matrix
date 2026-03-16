'use client'

// src/app/dashboard/admin/enseignants/page.tsx
// Page Directeur : Assigner classes & matières aux enseignants
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Classe, Matiere, EnseignantClasse } from '@/lib/supabase'
import { Users, Plus, Trash2, Loader2, BookOpen, GraduationCap, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'

interface AssignmentRow extends EnseignantClasse {
  enseignant: Profile
  classe: Classe
  matiere?: Matiere
}

export default function EnseignantsAdminPage() {
  const router = useRouter()
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const [form, setForm] = useState({
    enseignant_id: '',
    classe_id: '',
    matiere_id: '',
  })

  useEffect(() => { init() }, [])

  async function init() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('user_id', user.id).single()
      if (!prof || (prof.role !== 'director' && prof.role !== 'admin')) {
        router.push('/dashboard')
        return
      }
      setEcoleId(prof.ecole_id)

      await Promise.all([
        loadTeachers(prof.ecole_id),
        loadClasses(prof.ecole_id),
        loadMatieres(prof.ecole_id),
        loadAssignments(prof.ecole_id),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadTeachers(eid: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('ecole_id', eid)
      .eq('role', 'teacher')
      .order('nom')
    setTeachers((data ?? []) as Profile[])
  }

  async function loadClasses(eid: string) {
    const { data } = await supabase
      .from('classes').select('*').eq('ecole_id', eid).order('nom_classe')
    setClasses(data ?? [])
  }

  async function loadMatieres(eid: string) {
    const { data } = await supabase
      .from('matieres').select('*').eq('ecole_id', eid).order('nom')
    setMatieres((data ?? []) as Matiere[])
  }

  async function loadAssignments(eid: string) {
    const { data } = await supabase
      .from('enseignants_classes')
      .select(`
        *,
        enseignant:profiles!enseignant_id(id, nom, prenom, role),
        classe:classes!classe_id(id, nom_classe, niveau),
        matiere:matieres!matiere_id(id, nom)
      `)
      .eq('ecole_id', eid)
      .order('created_at', { ascending: false })
    setAssignments((data ?? []) as AssignmentRow[])
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!ecoleId || !form.enseignant_id || !form.classe_id) return
    setSaving(true)
    try {
      const { error } = await supabase.from('enseignants_classes').insert({
        ecole_id: ecoleId,
        enseignant_id: form.enseignant_id,
        classe_id: form.classe_id,
        matiere_id: form.matiere_id || null,
      })
      if (error) {
        if (error.code === '23505') {
          showToast('Cette assignation existe déjà.', 'error')
        } else {
          showToast('Erreur : ' + error.message, 'error')
        }
        return
      }
      showToast('Assignation enregistrée !', 'success')
      setForm({ enseignant_id: '', classe_id: '', matiere_id: '' })
      await loadAssignments(ecoleId)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!ecoleId) return
    await supabase.from('enseignants_classes').delete().eq('id', id)
    showToast('Assignation supprimée.', 'success')
    await loadAssignments(ecoleId)
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-2.5 rounded-xl">
          <GraduationCap className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion des enseignants</h1>
          <p className="text-sm text-slate-500">Assignez les classes et matières à chaque professeur.</p>
        </div>
      </div>

      {/* Assign form */}
      <form onSubmit={handleAssign} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" />
          Nouvelle assignation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Enseignant *</label>
            <select value={form.enseignant_id} onChange={e => setForm(f => ({ ...f, enseignant_id: e.target.value }))} className={inputCls} required>
              <option value="">Choisir…</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Classe *</label>
            <select value={form.classe_id} onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))} className={inputCls} required>
              <option value="">Choisir…</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.nom_classe} ({c.niveau})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Matière (optionnel)</label>
            <select value={form.matiere_id} onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))} className={inputCls}>
              <option value="">Toutes matières</option>
              {matieres.map(m => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Assigner
        </button>
      </form>

      {/* Current assignments */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-700 text-sm">Assignations actuelles ({assignments.length})</h2>
        </div>
        {assignments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
            Aucune assignation pour le moment.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase">Enseignant</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Classe</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Matière</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assignments.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {a.enseignant?.prenom} {a.enseignant?.nom}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.classe?.nom_classe}</td>
                  <td className="px-4 py-3">
                    {a.matiere ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{a.matiere.nom}</span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Toutes matières</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
