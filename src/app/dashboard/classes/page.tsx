'use client'

// src/app/dashboard/classes/page.tsx
// Gestion des classes de l'école (Directeur/Admin)

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import type { Classe, Profile } from '@/lib/supabase'
import { BookOpen, Plus, Trash2, Loader2, Users, GraduationCap, Edit2, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ClasseAvecEleves extends Classe {
  nb_eleves?: number
}

export default function ClassesPage() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null

  const [classes, setClasses] = useState<ClasseAvecEleves[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const { showToast } = useToast()

  const [form, setForm] = useState({ nom_classe: '', niveau: '' })
  const [editForm, setEditForm] = useState({ nom_classe: '', niveau: '' })

  const NIVEAUX = [
    'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
    '6ème', '5ème', '4ème', '3ème',
    '2nde', '1ère', 'Terminale',
  ]

  useEffect(() => { 
    if (ecoleId) {
      loadClasses(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadClasses(eid: string) {
    try {
      setLoading(true)
      // Single query: fetch all classes + count of students per class
      const { data: cls } = await supabase
        .from('classes')
        .select('*, eleves(count)')
        .eq('ecole_id', eid)
        .order('nom_classe')

      if (!cls) { setClasses([]); return }

      const withCounts: ClasseAvecEleves[] = cls.map((c: any) => ({
        ...c,
        nb_eleves: c.eleves?.[0]?.count ?? 0,
      }))
      setClasses(withCounts)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!ecoleId || !form.nom_classe || !form.niveau) return
    setSaving(true)
    try {
      const { error } = await supabase.from('classes').insert({
        ecole_id: ecoleId,
        nom_classe: form.nom_classe.trim(),
        niveau: form.niveau,
      })
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Classe créée avec succès !', 'success')
      setForm({ nom_classe: '', niveau: '' })
      await loadClasses(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleUpdate(id: string) {
    if (!ecoleId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('classes').update({
        nom_classe: editForm.nom_classe.trim(),
        niveau: editForm.niveau,
      }).eq('id', id)
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Classe mise à jour avec succès !', 'success')
      setEditId(null)
      await loadClasses(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, nb: number) {
    if (nb > 0) {
      showToast(`Impossible de supprimer : ${nb} élève(s) encore dans cette classe.`, 'error')
      return
    }
    if (!confirm('Supprimer cette classe ?')) return
    await supabase.from('classes').delete().eq('id', id)
    showToast('Classe supprimée.', 'success')
    if (ecoleId) await loadClasses(ecoleId)
  }

  function startEdit(c: ClasseAvecEleves) {
    setEditId(c.id)
    setEditForm({ nom_classe: c.nom_classe, niveau: c.niveau })
  }

  const inputCls = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white w-full'
  const isDirector = profile?.role === 'director' || profile?.role === 'superadmin'

  if (loading || profileLoading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-2.5 rounded-xl">
          <BookOpen className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion des classes</h1>
          <p className="text-sm text-slate-500">{classes.length} classe{classes.length > 1 ? 's' : ''} enregistrée{classes.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Create form — directors only */}
      {isDirector && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" /> Créer une nouvelle classe
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={form.nom_classe}
              onChange={e => setForm(f => ({ ...f, nom_classe: e.target.value }))}
              placeholder="Nom de la classe (ex: CM2 A)"
              className={inputCls + ' flex-1'}
              required
            />
            <select
              value={form.niveau}
              onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))}
              className={inputCls + ' sm:w-44'}
              required
            >
              <option value="">Niveau…</option>
              {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button
              type="submit"
              disabled={saving || !form.nom_classe || !form.niveau}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer
            </button>
          </div>
        </form>
      )}

      {/* Classes list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {classes.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune classe créée.</p>
            <p className="text-xs mt-1">Créez votre première classe ci-dessus.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Classe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Niveau</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Élèves</th>
                {isDirector && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {classes.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3">
                    {editId === c.id ? (
                      <input
                        type="text"
                        value={editForm.nom_classe}
                        onChange={e => setEditForm(f => ({ ...f, nom_classe: e.target.value }))}
                        className="border border-emerald-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-40"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-slate-800">{c.nom_classe}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === c.id ? (
                      <select
                        value={editForm.niveau}
                        onChange={e => setEditForm(f => ({ ...f, niveau: e.target.value }))}
                        className="border border-emerald-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
                      >
                        {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">{c.niveau}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
                      <Users className="w-3 h-3" />
                      {c.nb_eleves}
                    </span>
                  </td>
                  {isDirector && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {editId === c.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(c.id)}
                              disabled={saving}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Enregistrer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                              title="Annuler"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id, c.nb_eleves ?? 0)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
