'use client'

// src/app/dashboard/classes/page.tsx
// Gestion des classes de l'école (Directeur/Admin)

import { useEffect, useState } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import type { Classe, Profile } from '@/lib/supabase'
import { BookOpen, Plus, Trash2, Loader2, Users, GraduationCap, Edit2, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/lib/db'
import { syncFromSupabase, addToSyncQueue } from '@/lib/syncService'
import { supabase } from '@/lib/supabase'
import type { LocalClasse, LocalEleve } from '@/lib/db'

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

  const { isOnline } = useNetwork()

  useEffect(() => { 
    if (ecoleId) {
      loadClasses(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadClasses(eid: string) {
    if (!db) return
    try {
      setLoading(true)
      // 1. Load from LOCAL (Dexie)
      const cls = await db.classes.where('ecole_id').equals(eid).toArray()
      const eleves = await db.eleves.where('ecole_id').equals(eid).toArray()

      const withCounts: ClasseAvecEleves[] = cls.map((c: LocalClasse) => ({
        ...c,
        nb_eleves: eleves.filter((e: LocalEleve) => e.classe_id === c.id).length,
      }))
      setClasses(withCounts)

      // 2. Background Pull if Online
      if (isOnline) {
        await syncFromSupabase(eid)
        const updatedCls = await db.classes.where('ecole_id').equals(eid).toArray()
        const updatedEleves = await db.eleves.where('ecole_id').equals(eid).toArray()
        setClasses(updatedCls.map((c: LocalClasse) => ({
          ...c,
          nb_eleves: updatedEleves.filter((e: LocalEleve) => e.classe_id === c.id).length,
        })))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!ecoleId || !form.nom_classe || !form.niveau) return
    setSaving(true)
    
    const newClasse: Classe = {
      id: crypto.randomUUID(),
      ecole_id: ecoleId,
      nom_classe: form.nom_classe.trim(),
      niveau: form.niveau,
      created_at: new Date().toISOString()
    }

    try {
      if (isOnline) {
        // 1. Try DIRECT Supabase
        const { error } = await (supabase as any).from('classes').insert({
          id: newClasse.id,
          ecole_id: newClasse.ecole_id,
          nom_classe: newClasse.nom_classe,
          niveau: newClasse.niveau
        })
        
        if (error) throw error
        
        // Success -> Update Dexie
        if (db) await db.classes.add(newClasse)
        showToast('Classe créée (En ligne) !', 'success')
      } else {
        // 2. Offline Fallback
        if (db) {
          await db.classes.add(newClasse)
          await addToSyncQueue('classes', 'INSERT', newClasse as any, ecoleId)
        }
        showToast('Classe créée (Hors-ligne) !', 'success')
      }

      setForm({ nom_classe: '', niveau: '' })
      await loadClasses(ecoleId)
    } catch (err: any) {
      showToast('Erreur : ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  async function handleUpdate(id: string) {
    if (!ecoleId || !db) return
    setSaving(true)
    try {
      const updates = {
        nom_classe: editForm.nom_classe.trim(),
        niveau: editForm.niveau,
      }

      // 1. Update Locally
      await db.classes.update(id, updates)

      // 2. Sync Queue
      await addToSyncQueue('classes', 'UPDATE', { id, ...updates }, ecoleId)

      showToast('Classe mise à jour avec succès !', 'success')
      setEditId(null)
      await loadClasses(ecoleId)
    } catch (err: any) {
      showToast('Erreur : ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, nb: number) {
    if (nb > 0) {
      showToast(`Impossible de supprimer : ${nb} élève(s) encore dans cette classe.`, 'error')
      return
    }
    if (!confirm('Supprimer cette classe ?')) return
    if (!db) return

    try {
      // 1. Delete Locally
      await db.classes.delete(id)

      // 2. Sync Queue
      await addToSyncQueue('classes', 'DELETE', { id }, ecoleId!)

      showToast('Classe supprimée.', 'success')
      await loadClasses(ecoleId!)
    } catch (err: any) {
      showToast('Erreur.', 'error')
    }
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
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-none">Divisions Académiques</h1>
          </div>
          <p className="text-sm text-slate-400 font-medium max-w-2xl tracking-tight leading-relaxed">
            Gérez les structures pédagogiques de votre établissement. Suivez les effectifs et les niveaux d&apos;enseignement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="premium-glass rounded-[1.5rem] p-4 flex items-center gap-6 group hover:border-blue-500/30 transition-all duration-500">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Classes</span>
              <span className="text-2xl font-black text-white leading-tight group-hover:text-blue-400 transition-colors">
                {classes.length}
              </span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Capacité Staff</span>
              <span className="text-2xl font-black text-emerald-400 leading-tight">
                OK
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Create form — directors only */}
      {isDirector && (
        <div className="premium-glass rounded-[2rem] p-8 group overflow-hidden relative border border-emerald-500/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
          
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-white">Nouvelle Division</h2>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end relative z-10">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom de la Classe</label>
              <input
                type="text"
                value={form.nom_classe}
                onChange={e => setForm(f => ({ ...f, nom_classe: e.target.value }))}
                placeholder="Ex: 6ème A, Terminale S1…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all shadow-sm placeholder:text-slate-600"
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Niveau</label>
              <select
                value={form.niveau}
                onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all shadow-sm cursor-pointer appearance-none"
                required
              >
                <option value="" className="bg-slate-900">Sélectionner…</option>
                {NIVEAUX.map(n => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black transition-all shadow-xl shadow-emerald-900/20 disabled:opacity-60 active:scale-95"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classes list */}
      <div className="premium-glass rounded-[2.5rem] overflow-hidden min-h-[400px]">
        <div className="px-6 md:px-10 py-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Cartographie des Classes</h2>
          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
        </div>
        
        {classes.length === 0 ? (
          <div className="py-24 text-center animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-500">Aucune structure créée</h3>
          </div>
        ) : (
          <>
            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="text-left px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Désignation</th>
                    <th className="text-left px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Niveau Académique</th>
                    <th className="text-center px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Effectif Actuel</th>
                    {isDirector && <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Options</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {classes.map(c => (
                    <tr key={c.id} className="group hover:bg-white/5 transition-all duration-300">
                      <td className="px-10 py-5">
                        {editId === c.id ? (
                          <input
                            type="text"
                            value={editForm.nom_classe}
                            onChange={e => setEditForm(f => ({ ...f, nom_classe: e.target.value }))}
                            className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl px-5 py-3 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 transition-all w-full max-w-[250px]"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 text-white flex items-center justify-center group-hover:bg-blue-600/80 group-hover:rotate-3 transition-all duration-500 shadow-sm border border-white/10">
                              <GraduationCap className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="text-base font-black text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">{c.nom_classe}</span>
                              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">Section Scolaire</p>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {editId === c.id ? (
                          <select
                            value={editForm.niveau}
                            onChange={e => setEditForm(f => ({ ...f, niveau: e.target.value }))}
                            className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl px-4 py-3 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none"
                          >
                            {NIVEAUX.map(n => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
                          </select>
                        ) : (
                          <span className="inline-flex items-center px-4 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 group-hover:bg-white/5 transition-all">
                            {c.niveau}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
                          <Users className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                          <span className="text-sm font-black text-slate-300 group-hover:text-emerald-400">{c.nb_eleves} élèves</span>
                        </div>
                      </td>
                      {isDirector && (
                        <td className="px-10 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 transition-all duration-300">
                            {editId === c.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdate(c.id)}
                                  disabled={saving}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                                  title="Sauvegarder"
                                >
                                  <Check className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => setEditId(null)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all shadow-sm"
                                  title="Annuler"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(c)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-blue-400 hover:border-blue-500/30 hover:bg-white/10 transition-all shadow-sm"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(c.id, c.nb_eleves ?? 0)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 hover:bg-white/10 transition-all shadow-sm"
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

            {/* Mobile View: Cards */}
            <div className="md:hidden divide-y divide-white/5">
              {classes.map(c => (
                <div key={c.id} className="p-6 space-y-4 hover:bg-white/5 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 text-white flex items-center justify-center shadow-sm shrink-0 border border-white/10">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div>
                        {editId === c.id ? (
                          <input
                            type="text"
                            value={editForm.nom_classe}
                            onChange={e => setEditForm(f => ({ ...f, nom_classe: e.target.value }))}
                            className="bg-slate-900 border-2 border-emerald-500/50 rounded-xl px-3 py-2 text-sm font-black text-white w-full"
                            autoFocus
                          />
                        ) : (
                          <h3 className="text-base font-black text-white uppercase tracking-tight">{c.nom_classe}</h3>
                        )}
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">Section Scolaire</p>
                      </div>
                    </div>
                    
                    {isDirector && (
                      <div className="flex items-center gap-2 shrink-0">
                        {editId === c.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(c.id)}
                              disabled={saving}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id, c.nb_eleves ?? 0)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <div className="flex-1">
                      {editId === c.id ? (
                        <select
                          value={editForm.niveau}
                          onChange={e => setEditForm(f => ({ ...f, niveau: e.target.value }))}
                          className="w-full bg-slate-900 border-2 border-emerald-500/50 rounded-xl px-3 py-2 text-xs font-black text-white appearance-none"
                        >
                          {NIVEAUX.map(n => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                          {c.niveau}
                        </span>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs font-black text-slate-300">{c.nb_eleves} élèves</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
