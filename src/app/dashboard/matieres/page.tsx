'use client'

// src/app/dashboard/matieres/page.tsx
// Gestion des matières de l'école (Directeur/Admin)

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import type { Matiere } from '@/lib/supabase'
import {
  BookOpen, Plus, Trash2, Loader2, Edit2, Check, X, BookMarked
} from 'lucide-react'

export default function MatieresPage() {
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [form, setForm] = useState({ nom: '', code: '', coefficient: 1 })
  const [editForm, setEditForm] = useState({ nom: '', code: '', coefficient: 1 })

  useEffect(() => {
    if (ecoleId) {
      loadMatieres(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadMatieres(eid: string) {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('matieres')
        .select('*')
        .eq('ecole_id', eid)
        .order('nom')
      setMatieres(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!ecoleId || !form.nom) return
    setSaving(true)
    try {
      const { error } = await supabase.from('matieres').insert({
        ecole_id: ecoleId,
        nom: form.nom.trim(),
        code: form.code.trim() || null,
        coefficient: form.coefficient,
        is_active: true,
      })
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Matière créée avec succès !', 'success')
      setForm({ nom: '', code: '', coefficient: 1 })
      await loadMatieres(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleUpdate(id: string) {
    if (!ecoleId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('matieres').update({
        nom: editForm.nom.trim(),
        code: editForm.code.trim() || null,
        coefficient: editForm.coefficient,
      }).eq('id', id)
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Matière mise à jour !', 'success')
      setEditId(null)
      await loadMatieres(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleToggleActive(m: Matiere) {
    await supabase.from('matieres').update({ is_active: !m.is_active }).eq('id', m.id)
    showToast(m.is_active ? 'Matière désactivée.' : 'Matière activée.', 'success')
    if (ecoleId) await loadMatieres(ecoleId)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette matière ? Les évaluations associées seront aussi supprimées.')) return
    const { error } = await supabase.from('matieres').delete().eq('id', id)
    if (error) { showToast('Impossible de supprimer : ' + error.message, 'error'); return }
    showToast('Matière supprimée.', 'success')
    if (ecoleId) await loadMatieres(ecoleId)
  }

  function startEdit(m: Matiere) {
    setEditId(m.id)
    setEditForm({ nom: m.nom, code: m.code ?? '', coefficient: m.coefficient })
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
        <div className="bg-purple-100 p-2.5 rounded-xl">
          <BookMarked className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion des matières</h1>
          <p className="text-sm text-slate-500">
            {matieres.filter(m => m.is_active).length} matière{matieres.filter(m => m.is_active).length > 1 ? 's' : ''} active{matieres.filter(m => m.is_active).length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Create form */}
      {isDirector && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" /> Ajouter une matière
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="Nom (ex: Mathématiques)"
              className={inputCls + ' flex-1'}
              required
            />
            <input
              type="text"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="Code (ex: MATH)"
              className={inputCls + ' sm:w-32'}
            />
            <div className="flex items-center gap-2 sm:w-40">
              <label className="text-xs text-slate-500 shrink-0">Coef.</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.coefficient}
                onChange={e => setForm(f => ({ ...f, coefficient: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </button>
          </div>
        </form>
      )}

      {/* Matieres list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {matieres.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucune matière ajoutée.</p>
            <p className="text-xs mt-1">Ajoutez votre première matière ci-dessus.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Matière</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Code</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Coef.</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Statut</th>
                {isDirector && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {matieres.map(m => (
                <tr key={m.id} className={`hover:bg-slate-50/60 transition-colors ${!m.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    {editId === m.id ? (
                      <input
                        type="text"
                        value={editForm.nom}
                        onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
                        className="border border-emerald-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-slate-800">{m.nom}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === m.id ? (
                      <input
                        type="text"
                        value={editForm.code}
                        onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                        className="border border-emerald-300 rounded-lg px-2 py-1 text-sm focus:outline-none w-24"
                        placeholder="Code"
                      />
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{m.code ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editId === m.id ? (
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={editForm.coefficient}
                        onChange={e => setEditForm(f => ({ ...f, coefficient: Number(e.target.value) }))}
                        className="border border-emerald-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none w-16"
                      />
                    ) : (
                      <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{m.coefficient}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isDirector ? (
                      <button
                        onClick={() => handleToggleActive(m)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${m.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600' : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                      >
                        {m.is_active ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  {isDirector && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {editId === m.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(m.id)}
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
                              onClick={() => startEdit(m)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
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
