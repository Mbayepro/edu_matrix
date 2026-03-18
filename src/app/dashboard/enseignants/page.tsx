'use client'

// src/app/dashboard/enseignants/page.tsx
// Assignation des enseignants aux classes (Directeur)

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import type { Profile, Classe, Matiere, EnseignantClasse } from '@/lib/supabase'
import {
  GraduationCap, Plus, Trash2, Loader2, Users
} from 'lucide-react'

export default function EnseignantsPage() {
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [enseignants, setEnseignants] = useState<Profile[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [assignments, setAssignments] = useState<EnseignantClasse[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    enseignant_id: '',
    classe_id: '',
    matiere_id: '',
  })

  useEffect(() => {
    if (ecoleId) loadAll(ecoleId)
    else if (!profileLoading) setLoading(false)
  }, [ecoleId, profileLoading])

  async function loadAll(eid: string) {
    setLoading(true)
    try {
      const [{ data: ens }, { data: cls }, { data: mat }, { data: asgn }] = await Promise.all([
        supabase.from('profiles').select('*').eq('ecole_id', eid).eq('role', 'teacher').order('nom'),
        supabase.from('classes').select('*').eq('ecole_id', eid).order('nom_classe'),
        supabase.from('matieres').select('*').eq('ecole_id', eid).eq('is_active', true).order('nom'),
        supabase
          .from('enseignants_classes')
          .select('*, enseignant:profiles(nom, prenom), classe:classes(nom_classe), matiere:matieres(nom)')
          .eq('ecole_id', eid),
      ])
      setEnseignants(ens ?? [])
      setClasses(cls ?? [])
      setMatieres(mat ?? [])
      setAssignments(asgn ?? [])

      // Pre-fill form defaults
      if (ens && ens.length > 0) setForm(f => ({ ...f, enseignant_id: ens[0].id }))
      if (cls && cls.length > 0) setForm(f => ({ ...f, classe_id: cls[0].id }))
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!ecoleId || !form.enseignant_id || !form.classe_id) return
    setSaving(true)
    try {
      // Check duplicate
      const exists = assignments.some(
        a => a.enseignant_id === form.enseignant_id &&
             a.classe_id === form.classe_id &&
             (a.matiere_id ?? '') === (form.matiere_id ?? '')
      )
      if (exists) {
        showToast('Cette affectation existe déjà.', 'error')
        return
      }

      const { error } = await supabase.from('enseignants_classes').insert({
        ecole_id: ecoleId,
        enseignant_id: form.enseignant_id,
        classe_id: form.classe_id,
        matiere_id: form.matiere_id || null,
      })
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Enseignant affecté avec succès !', 'success')
      await loadAll(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleRemove(id: string) {
    if (!confirm('Retirer cette affectation ?')) return
    await supabase.from('enseignants_classes').delete().eq('id', id)
    showToast('Affectation retirée.', 'success')
    if (ecoleId) await loadAll(ecoleId)
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
        <div className="bg-amber-100 p-2.5 rounded-xl">
          <GraduationCap className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Enseignants & Affectations</h1>
          <p className="text-sm text-slate-500">
            {enseignants.length} enseignant{enseignants.length > 1 ? 's' : ''} — {assignments.length} affectation{assignments.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {enseignants.length === 0 ? (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
          <Users className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="font-semibold text-amber-800 mb-1">Aucun enseignant trouvé</h3>
          <p className="text-amber-600 text-sm">
            Les comptes enseignants se créent via l'invitation (Paramètres → Équipe).
          </p>
        </div>
      ) : (
        <>
          {/* Assign form */}
          {isDirector && (
            <form onSubmit={handleAssign} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" /> Affecter un enseignant à une classe
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Enseignant</label>
                  <select
                    value={form.enseignant_id}
                    onChange={e => setForm(f => ({ ...f, enseignant_id: e.target.value }))}
                    className={inputCls}
                    required
                  >
                    <option value="">Choisir…</option>
                    {enseignants.map(e => (
                      <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Classe</label>
                  <select
                    value={form.classe_id}
                    onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))}
                    className={inputCls}
                    required
                  >
                    <option value="">Choisir…</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.nom_classe}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Matière <span className="text-slate-400">(optionnel)</span></label>
                  <select
                    value={form.matiere_id}
                    onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Toutes matières</option>
                    {matieres.map(m => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Affecter
                </button>
              </div>
            </form>
          )}

          {/* Assignments list */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Affectations en cours</h2>
            </div>
            {assignments.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune affectation pour le moment.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Enseignant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Classe</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Matière</th>
                    {isDirector && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {assignments.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-800">
                        {(a.enseignant as any)?.prenom} {(a.enseignant as any)?.nom}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                          {(a.classe as any)?.nom_classe}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {(a.matiere as any)?.nom ?? <span className="text-xs italic text-slate-400">Toutes matières</span>}
                      </td>
                      {isDirector && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemove(a.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Retirer l'affectation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
