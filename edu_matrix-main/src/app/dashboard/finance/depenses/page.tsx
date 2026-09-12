'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { CATEGORIES_DEPENSES, formatMontantCFA, getCurrentAnnéeScolaire } from '@/lib/financeEngine'
import type { Depense } from '@/lib/supabase'
import {
  Plus,
  Wallet,
  Trash2,
  Loader2,
  X,
  Save,
  TrendingDown,
  Calendar,
} from 'lucide-react'

const MOIS = ['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet']

export default function DepensesPage() {
  const { profile } = useProfile()
  const { showToast } = useToast()
  const ecoleId = profile?.ecole_id

  const [depenses, setDepenses] = useState<Depense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterCategorie, setFilterCategorie] = useState<string>('all')
  const [filterMois, setFilterMois] = useState<string>('all')

  const [form, setForm] = useState({
    libelle: '',
    montant: '',
    categorie: 'autre' as Depense['categorie'],
    date_depense: new Date().toISOString().split('T')[0],
    description: '',
  })

  useEffect(() => {
    if (ecoleId) load(ecoleId)
  }, [ecoleId])

  async function load(id: string) {
    setLoading(true)
    try {
      if (!db) return
      const d = await db.table('depenses').where('ecole_id').equals(id).toArray()
      const valid = d.filter(x => !x.deleted_at).sort((a, b) => new Date(b.date_depense).getTime() - new Date(a.date_depense).getTime())
      setDepenses(valid as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!ecoleId || !form.libelle.trim() || !form.montant) return
    setSaving(true)
    try {
      if (!db) throw new Error('DB locale indisponible')
      
      const newDepense = {
        id: crypto.randomUUID(),
        ecole_id: ecoleId,
        libelle: form.libelle.trim(),
        montant: parseFloat(form.montant),
        categorie: form.categorie,
        date_depense: form.date_depense,
        description: form.description.trim() || null,
        created_by: profile?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await db.table('depenses').add(newDepense)
      
      ;(supabase as any).from('depenses').insert(newDepense).then(({error}: any) => {
         if (error) console.error("Erreur insertion depense en ligne", error)
      })

      showToast('Dépense enregistrée !', 'success')
      setShowModal(false)
      setForm({ libelle: '', montant: '', categorie: 'autre', date_depense: new Date().toISOString().split('T')[0], description: '' })
      await load(ecoleId)
    } catch (e: any) {
      showToast('Erreur : ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette dépense ?')) return
    if (!db) return
    
    await db.table('depenses').update(id, { deleted_at: new Date().toISOString() })
    
    ;(supabase as any).from('depenses').update({ deleted_at: new Date().toISOString() }).eq('id', id).then(({error}: any) => {
      if (error) console.error("Erreur suppression depense en ligne", error)
    })
    
    setDepenses(prev => prev.filter(d => d.id !== id))
    showToast('Dépense supprimée', 'success')
  }

  const filteredDepenses = useMemo(() => {
    return depenses.filter(d => {
      if (filterCategorie !== 'all' && d.categorie !== filterCategorie) return false
      if (filterMois !== 'all') {
        const moisDepense = new Date(d.date_depense).toLocaleDateString('fr-FR', { month: 'long' })
        if (!moisDepense.toLowerCase().includes(filterMois.toLowerCase())) return false
      }
      return true
    })
  }, [depenses, filterCategorie, filterMois])

  const totalFiltre = filteredDepenses.reduce((s, d) => s + Number(d.montant), 0)

  // Groupement par catégorie pour les stats
  const parCategorie = useMemo(() => {
    const map: Record<string, number> = {}
    depenses.forEach(d => {
      map[d.categorie] = (map[d.categorie] || 0) + Number(d.montant)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [depenses])

  const totalGeneral = depenses.reduce((s, d) => s + Number(d.montant), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Dépenses</h1>
            <p className="text-sm text-slate-400 font-medium">Charges et dépenses de l'école</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/20"
        >
          <Plus className="w-4 h-4" />
          Nouvelle dépense
        </button>
      </div>

      {/* Stats catégories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {parCategorie.slice(0, 4).map(([cat, montant]) => {
          const info = CATEGORIES_DEPENSES[cat]
          return (
            <div key={cat} className="bg-slate-900 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{info?.emoji}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${info?.color}`}>{info?.label}</span>
              </div>
              <p className="text-sm font-black text-white">{(montant / 1000).toFixed(0)}k F</p>
              <p className="text-[10px] text-slate-500 font-bold">
                {totalGeneral > 0 ? Math.round((montant / totalGeneral) * 100) : 0}% du total
              </p>
            </div>
          )
        })}
      </div>

      {/* Filtres + total */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategorie}
          onChange={e => setFilterCategorie(e.target.value)}
          className="px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 appearance-none cursor-pointer"
        >
          <option value="all">Toutes catégories</option>
          {Object.entries(CATEGORIES_DEPENSES).map(([key, val]) => (
            <option key={key} value={key}>{val.emoji} {val.label}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <TrendingDown className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-black text-rose-400">{formatMontantCFA(totalFiltre)}</span>
          <span className="text-[10px] text-slate-500 font-bold">{filteredDepenses.length} dépense(s)</span>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
          </div>
        ) : filteredDepenses.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Aucune dépense</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-500 transition-all"
            >
              Ajouter la première
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredDepenses.map(d => {
              const info = CATEGORIES_DEPENSES[d.categorie]
              return (
                <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-white/3 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0">
                    {info?.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white">{d.libelle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-black uppercase tracking-wide ${info?.color}`}>{info?.label}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(d.date_depense).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {d.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{d.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-rose-400">{d.montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F</p>
                  </div>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal ajout dépense */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">Nouvelle dépense</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 hover:text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Catégorie */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Catégorie</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(CATEGORIES_DEPENSES).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, categorie: key as any }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl text-[10px] font-black transition-all border ${
                        form.categorie === key
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                          : 'bg-white/5 border-transparent text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className="text-lg">{val.emoji}</span>
                      <span className="uppercase tracking-widest">{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Libellé */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Libellé *</label>
                <input
                  type="text"
                  value={form.libelle}
                  onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                  placeholder="Ex: Loyer mois d'octobre"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                />
              </div>

              {/* Montant + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Montant (F CFA) *</label>
                  <input
                    type="number"
                    value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="Ex: 150000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Date *</label>
                  <input
                    type="date"
                    value={form.date_depense}
                    onChange={e => setForm(f => ({ ...f, date_depense: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-rose-500/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Note (optionnel)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Détails supplémentaires…"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-rose-500/30 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 text-sm font-black hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.libelle.trim() || !form.montant}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
