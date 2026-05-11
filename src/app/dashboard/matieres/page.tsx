'use client'

// src/app/dashboard/matieres/page.tsx
// Gestion des matières de l'école (Directeur/Admin)

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import Link from 'next/link'
import type { Matiere } from '@/lib/supabase'
import {
  BookOpen, Plus, Trash2, Loader2, Edit2, Check, X, BookMarked, Settings2
} from 'lucide-react'

export default function MatieresPage() {
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [form, setForm] = useState({ nom: '', code: '', coefficient: 1, est_bonus: false })
  const [editForm, setEditForm] = useState({ nom: '', code: '', coefficient: 1, est_bonus: false })

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
      const { data } = await (supabase.from('matieres' as any) as any)
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
      const { error } = await (supabase.from('matieres' as any) as any).insert({
        ecole_id: ecoleId,
        nom: form.nom.trim(),
        code: form.code.trim() || null,
        coefficient: form.coefficient,
        est_bonus: form.est_bonus,
        is_active: true,
      })
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Matière créée avec succès !', 'success')
      setForm({ nom: '', code: '', coefficient: 1, est_bonus: false })
      await loadMatieres(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleUpdate(id: string) {
    if (!ecoleId) return
    setSaving(true)
    try {
      const { error } = await (supabase.from('matieres' as any) as any).update({
        nom: editForm.nom.trim(),
        code: editForm.code.trim() || null,
        coefficient: editForm.coefficient,
        est_bonus: editForm.est_bonus,
      }).eq('id', id)
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Matière mise à jour !', 'success')
      setEditId(null)
      await loadMatieres(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleToggleActive(m: Matiere) {
    await (supabase.from('matieres' as any) as any).update({ is_active: !m.is_active } as any).eq('id', m.id)
    showToast(m.is_active ? 'Matière désactivée.' : 'Matière activée.', 'success')
    if (ecoleId) await loadMatieres(ecoleId)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette matière ? Les évaluations associées seront aussi supprimées.')) return
    const { error } = await (supabase.from('matieres' as any) as any).delete().eq('id', id)
    if (error) { showToast('Impossible de supprimer : ' + error.message, 'error'); return }
    showToast('Matière supprimée.', 'success')
    if (ecoleId) await loadMatieres(ecoleId)
  }

  function startEdit(m: Matiere) {
    setEditId(m.id)
    setEditForm({ nom: m.nom, code: m.code ?? '', coefficient: m.coefficient, est_bonus: m.est_bonus ?? false })
  }

  const inputCls = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white w-full'
  const isDirector = profile?.role === 'director' || profile?.role === 'superadmin'

  if (loading || profileLoading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
    </div>
  )

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center">
              <BookMarked className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Référentiel Matières</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium max-w-2xl tracking-tight leading-relaxed">
            Configurez le socle pédagogique de votre établissement. Définissez les disciplines et leurs coefficients de pondération.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link 
            href="/dashboard/matieres/coefficients"
            className="flex items-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group"
          >
            <Settings2 className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            <span className="text-xs font-black uppercase tracking-widest">Coefficients par Niveau</span>
          </Link>

          <div className="bg-white rounded-[1.5rem] border border-slate-200/60 shadow-sm p-4 flex items-center gap-6 group hover:border-emerald-200 transition-all duration-500">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Matières</span>
              <span className="text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors">
                {matieres.length}
              </span>
            </div>
            <div className="w-px h-10 bg-slate-100" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actives</span>
              <span className="text-2xl font-black text-emerald-600 leading-tight">
                {matieres.filter(m => m.is_active).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Create form */}
      {isDirector && (
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-slate-900">Nouvelle Matière</h2>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3 lg:col-span-4">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Nom du cours</label>
              <input
                type="text"
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Ex: Mathématiques, Français…"
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
                required
              />
            </div>
            <div className="md:col-span-1 lg:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="MATH, SVT…"
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <div className="md:col-span-1 lg:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Type</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, est_bonus: !f.est_bonus }))}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest ${form.est_bonus ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-transparent text-slate-400'}`}
              >
                {form.est_bonus ? '★ Bonus' : 'Classique'}
              </button>
            </div>
            <div className="md:col-span-1 lg:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Coef</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.coefficient}
                onChange={e => setForm(f => ({ ...f, coefficient: Number(e.target.value) }))}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <div className="md:col-span-6 lg:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white text-sm font-black transition-all shadow-xl shadow-slate-900/10 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Matieres list */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/50 shadow-sm overflow-hidden min-h-[400px]">
        <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Catalogue Académique</h2>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
        </div>
        
        {matieres.length === 0 ? (
          <div className="py-24 text-center animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">Aucune matière répertoriée</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/10">
                  <th className="text-left px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Discipline</th>
                  <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code Identification</th>
                  <th className="text-center px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coefficient</th>
                  <th className="text-center px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visibilité</th>
                  {isDirector && <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {matieres.map(m => (
                  <tr key={m.id} className={`group hover:bg-slate-50/80 transition-all duration-300 ${!m.is_active ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                    <td className="px-10 py-5">
                      {editId === m.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editForm.nom}
                            onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
                            className="bg-white border-2 border-emerald-500 rounded-2xl px-5 py-3 text-sm font-black focus:ring-4 focus:ring-emerald-500/10 transition-all w-full max-w-[300px]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setEditForm(f => ({ ...f, est_bonus: !f.est_bonus }))}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest ${editForm.est_bonus ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-transparent text-slate-400'}`}
                          >
                            {editForm.est_bonus ? '★ Bonus' : 'Classique'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-500 group-hover:scale-105 shadow-sm ${m.is_active ? 'bg-slate-900 text-white group-hover:bg-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {m.nom[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-slate-900 uppercase group-hover:text-emerald-700 transition-colors">{m.nom}</span>
                              {m.est_bonus && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-500 text-[8px] font-black border border-indigo-100 uppercase tracking-tighter">Bonus</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">Enseignement Général</p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {editId === m.id ? (
                        <input
                          type="text"
                          value={editForm.code}
                          onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                          className="bg-white border-2 border-emerald-500 rounded-2xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-emerald-500/10 transition-all w-32 uppercase"
                        />
                      ) : (
                        <span className="inline-flex items-center px-4 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200/50 group-hover:bg-white group-hover:border-emerald-200 transition-all">
                          {m.code ?? 'NON DÉFINI'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {editId === m.id ? (
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={editForm.coefficient}
                          onChange={e => setEditForm(f => ({ ...f, coefficient: Number(e.target.value) }))}
                          className="bg-white border-2 border-emerald-500 rounded-2xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-emerald-500/10 transition-all w-20 text-center"
                        />
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-50 text-slate-900 text-sm font-black border border-slate-100 shadow-sm group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-100 transition-all ${m.est_bonus ? 'text-indigo-400' : ''}`}>
                            {m.coefficient}
                          </div>
                          {m.est_bonus && <span className="text-[8px] font-black text-indigo-400 uppercase mt-1">Pts seuls</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {isDirector ? (
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                            m.is_active 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white' 
                              : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-emerald-50'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${m.is_active ? 'bg-emerald-500 group-hover:bg-white animate-pulse' : 'bg-slate-300'}`} />
                          {m.is_active ? 'Actif' : 'Veille'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${m.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          {m.is_active ? 'Actif' : 'Veille'}
                        </span>
                      )}
                    </td>
                    {isDirector && (
                      <td className="px-10 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                          {editId === m.id ? (
                            <>
                              <button
                                onClick={() => handleUpdate(m.id)}
                                disabled={saving}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
                                title="Sauvegarder"
                              >
                                <Check className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 transition-all shadow-sm"
                                title="Annuler"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(m)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm"
                                title="Modifier"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
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
          </div>
        )}
      </div>
    </div>
  )
}
