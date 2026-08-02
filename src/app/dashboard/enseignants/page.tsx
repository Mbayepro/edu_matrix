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
        supabase.from('profiles' as any).select('*').eq('ecole_id', eid).eq('role', 'teacher').order('nom'),
        supabase.from('classes' as any).select('*').eq('ecole_id', eid).order('nom_classe'),
        supabase.from('matieres' as any).select('*').eq('ecole_id', eid).eq('is_active', true).order('nom'),
        supabase
          .from('enseignants_classes' as any)
          .select('*, enseignant:profiles(nom, prenom), classe:classes(nom_classe), matiere:matieres(nom)')
          .eq('ecole_id', eid),
      ] as any[])
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

      const { error } = await (supabase.from('enseignants_classes' as any) as any).insert({
        ecole_id: ecoleId,
        enseignant_id: form.enseignant_id,
        classe_id: form.classe_id,
        matiere_id: form.matiere_id || null,
      } as any)
      if (error) { showToast('Erreur : ' + error.message, 'error'); return }
      showToast('Enseignant affecté avec succès !', 'success')
      await loadAll(ecoleId)
    } finally { setSaving(false) }
  }

  async function handleRemove(id: string) {
    if (!confirm('Retirer cette affectation ?')) return
    await (supabase.from('enseignants_classes' as any) as any).delete().eq('id', id)
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
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <GraduationCap className="w-5 h-5 text-amber-500" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-none">Affectations Staff</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium max-w-2xl tracking-tight">
            Structurez votre équipe pédagogique : associez chaque enseignant à ses classes et disciplines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900 rounded-[1.5rem] border border-slate-700 shadow-sm p-4 flex items-center gap-6 group hover:border-amber-500/50 transition-all duration-500">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Enseignants</span>
              <span className="text-2xl font-black text-white leading-tight group-hover:text-amber-500 transition-colors">{enseignants.length}</span>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cours Actifs</span>
              <span className="text-2xl font-black text-white leading-tight group-hover:text-emerald-400 transition-colors">{assignments.length}</span>
            </div>
          </div>
        </div>
      </div>

      {enseignants.length === 0 ? (
        <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-xl p-12 lg:p-24 animate-in fade-in duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            
            <div className="max-w-2xl mx-auto text-center space-y-8 relative z-10">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700 relative">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-pulse" />
                  <Users className="w-10 h-10 text-amber-500 relative z-10" />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-white tracking-tight">Aucun membre du personnel trouvé</h3>
                <p className="text-lg text-slate-400 font-medium">Pour organiser votre équipe pédagogique, suivez ces étapes :</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mt-12">
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-black mb-4">1</div>
                  <h4 className="text-white font-bold mb-2">Invitez les enseignants</h4>
                  <p className="text-sm text-slate-400">Rendez-vous dans les <span className="text-amber-500">Paramètres École</span> pour créer et inviter les comptes enseignants par email.</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-black mb-4">2</div>
                  <h4 className="text-white font-bold mb-2">Affectez les classes</h4>
                  <p className="text-sm text-slate-400">Revenez ici pour associer chaque enseignant à ses classes et disciplines respectives.</p>
                </div>
              </div>
            </div>
        </div>
      ) : (
        <>
          {/* Assign form */}
          {isDirector && (
            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-xl p-10 group relative overflow-hidden transition-all duration-500 hover:shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                  <Plus className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white leading-none">Nouvelle Affectation</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">DÉFINIR UN NOUVEAU COUPLAGE PÉDAGOGIQUE</p>
                </div>
              </div>

              <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end relative z-10">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Enseignant</label>
                  <select
                    value={form.enseignant_id}
                    onChange={e => setForm(f => ({ ...f, enseignant_id: e.target.value }))}
                    className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-slate-800 transition-all appearance-none cursor-pointer outline-none"
                    required
                  >
                    <option value="" className="text-slate-500">Sélectionner…</option>
                    {enseignants.map(e => (
                      <option key={e.id} value={e.id} className="text-slate-900">{e.prenom} {e.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Classe cible</label>
                  <select
                    value={form.classe_id}
                    onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))}
                    className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-slate-800 transition-all appearance-none cursor-pointer outline-none"
                    required
                  >
                    <option value="" className="text-slate-500">Sélectionner…</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id} className="text-slate-900">{c.nom_classe}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Discipline / Matière</label>
                  <select
                    value={form.matiere_id}
                    onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))}
                    className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-slate-800 transition-all appearance-none cursor-pointer outline-none"
                  >
                    <option value="" className="text-slate-500">Toutes les matières</option>
                    {matieres.map(m => (
                      <option key={m.id} value={m.id} className="text-slate-900">{m.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-4.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-60 flex items-center justify-center gap-3"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Confirmer l&apos;Affectation
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Assignments list */}
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden min-h-[400px]">
            <div className="px-6 md:px-10 py-6 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cartographie des Interventions</h2>
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
            </div>
            {assignments.length === 0 ? (
              <div className="py-24 text-center animate-in fade-in duration-700">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
                  <GraduationCap className="w-10 h-10 text-slate-400" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">Aucune affectation active</p>
              </div>
            ) : (
              <>
                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/10">
                        <th className="text-left px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Membre de l&apos;Équipe</th>
                        <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Classe Attribuée</th>
                        <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Discipline</th>
                        {isDirector && <th className="px-10 py-5" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {assignments.map(a => (
                        <tr key={a.id} className="group hover:bg-slate-800/50 transition-all duration-300">
                          <td className="px-10 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-base font-black group-hover:bg-amber-500/10 group-hover:text-amber-500 group-hover:border-amber-500/30 group-hover:scale-105 transition-all duration-500 shadow-sm">
                                {(a.enseignant as any)?.prenom[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black text-white text-base leading-tight uppercase group-hover:text-amber-400 transition-colors">
                                  {(a.enseignant as any)?.prenom} {(a.enseignant as any)?.nom}
                                </p>
                                <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-1">Personnel Éducatif</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-slate-800/50 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-slate-700 shadow-sm group-hover:bg-slate-800 group-hover:border-emerald-500/30 transition-all">
                              {(a.classe as any)?.nom_classe}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            {(a.matiere as any)?.nom ? (
                              <span className="text-sm font-black text-slate-300 uppercase tracking-tight">{(a.matiere as any)?.nom}</span>
                            ) : (
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic bg-slate-800 px-2 py-0.5 rounded border border-slate-700">GÉNÉRALISTE</span>
                            )}
                          </td>
                          {isDirector && (
                            <td className="px-10 py-5 text-right">
                              <button
                                onClick={() => handleRemove(a.id)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 shadow-sm translate-x-2 group-hover:translate-x-0"
                                title="Retirer l'affectation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Cards */}
                <div className="md:hidden divide-y divide-slate-800">
                  {assignments.map(a => (
                    <div key={a.id} className="p-6 space-y-4 hover:bg-slate-800/50 transition-all duration-300">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 text-base font-black border border-slate-700 shadow-sm shrink-0">
                            {(a.enseignant as any)?.prenom[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-white text-base leading-tight uppercase">
                              {(a.enseignant as any)?.prenom} {(a.enseignant as any)?.nom}
                            </p>
                            <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-1">Personnel Éducatif</p>
                          </div>
                        </div>
                        {isDirector && (
                          <button
                            onClick={() => handleRemove(a.id)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/10 transition-all shadow-sm shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 pt-1">
                        <span className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-slate-800/50 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-slate-700 shadow-sm">
                          {(a.classe as any)?.nom_classe}
                        </span>
                        <div className="flex-1">
                          {(a.matiere as any)?.nom ? (
                            <span className="text-xs font-black text-slate-300 uppercase tracking-tight">{(a.matiere as any)?.nom}</span>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">GÉNÉRALISTE</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
