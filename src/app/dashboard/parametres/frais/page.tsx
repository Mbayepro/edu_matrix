'use client'

import { useEffect, useState } from 'react'
import { supabase, FraisScolaire } from '@/lib/supabase'
import Link from 'next/link'
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Save,
  X,
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'

export default function FraisManagementPage() {
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [frais, setFrais] = useState<FraisScolaire[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingFrais, setEditingFrais] = useState<FraisScolaire | null>(null)
  const [formData, setFormData] = useState({
    libelle: '',
    montant: '',
    frequence: 'unique' as 'unique' | 'mensuel' | 'trimestriel',
    niveau: '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (ecoleId) {
      loadFrais()
    }
  }, [ecoleId])

  async function loadFrais() {
    if (!ecoleId) return
    
    setLoading(true)
    try {
      const { data } = await supabase
        .from('frais_scolaires')
        .select('*')
        .eq('ecole_id', ecoleId)
        .order('libelle')
      
      setFrais((data ?? []) as FraisScolaire[])
    } finally {
      setLoading(false)
    }
  }

  function openModal(frais?: FraisScolaire) {
    if (frais) {
      setEditingFrais(frais)
      setFormData({
        libelle: frais.libelle,
        montant: frais.montant.toString(),
        frequence: frais.frequence,
        niveau: frais.niveau || '',
        is_active: frais.is_active,
      })
    } else {
      setEditingFrais(null)
      setFormData({
        libelle: '',
        montant: '',
        frequence: 'unique',
        niveau: '',
        is_active: true,
      })
    }
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingFrais(null)
    setFormData({
      libelle: '',
      montant: '',
      frequence: 'unique',
      niveau: '',
      is_active: true,
    })
  }

  async function saveFrais(e: React.FormEvent) {
    e.preventDefault()
    
    if (!ecoleId) return
    
    setSaving(true)
    try {
      const fraisData = {
        ecole_id: ecoleId,
        libelle: formData.libelle,
        montant: parseFloat(formData.montant),
        frequence: formData.frequence,
        niveau: formData.niveau || null,
        is_active: formData.is_active,
      }

      if (editingFrais) {
        // Update existing frais
        const { error } = await (supabase.from('frais_scolaires' as any) as any).update(fraisData as any).eq('id', editingFrais.id)
        
        if (error) {
          console.error('Error updating frais:', error)
          showToast('Erreur lors de la mise à jour des frais.', 'error')
          return
        }
        showToast('Frais mis à jour avec succès.', 'success')
      } else {
        // Create new frais
        const { error } = await (supabase.from('frais_scolaires' as any) as any).insert(fraisData as any)
        
        if (error) {
          console.error('Error creating frais:', error)
          showToast('Erreur lors de la création des frais.', 'error')
          return
        }
        showToast('Nouveau frais créé avec succès.', 'success')
      }

      await loadFrais()
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(frais: FraisScolaire) {
    if (!ecoleId) return
    
    const { error } = await (supabase.from('frais_scolaires' as any) as any)
      .update({ is_active: !frais.is_active } as any)
      .eq('id', frais.id)
    
    if (!error) {
      await loadFrais()
    }
  }

  async function deleteFrais(frais: FraisScolaire) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le frais "${frais.libelle}" ?`)) {
      return
    }
    
    if (!ecoleId) return
    
    const { error } = await (supabase.from('frais_scolaires' as any) as any)
      .delete()
      .eq('id', frais.id)
    
    if (!error) {
      showToast('Frais supprimé avec succès.', 'success')
      await loadFrais()
    } else {
      showToast('Erreur lors de la suppression du frais.', 'error')
    }
  }

  const niveaux = [
    'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
    '6ème', '5ème', '4ème', '3ème',
    '2nde', '1ère', 'Terminale'
  ]

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Frais Scolaires</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Définissez les différents types de frais (scolarité, transport, cantine) applicables.
          </p>
        </div>

        <nav className="flex p-1.5 bg-slate-100 rounded-[1.25rem] border border-slate-200 shadow-inner">
          <Link
            href="/dashboard/parametres"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600"
          >
            Général
          </Link>
          <Link
            href="/dashboard/parametres/frais"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white text-emerald-600 shadow-sm"
          >
            Frais
          </Link>
          <Link
            href="/dashboard/parametres/equipe"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600"
          >
            Équipe
          </Link>
        </nav>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-emerald-600 text-white text-sm font-black rounded-xl transition-all shadow-xl shadow-slate-900/10"
        >
          <Plus className="w-4 h-4" />
          Nouveau frais
        </button>
      </div>

      {/* Frais List */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Catalogue des Frais</h2>
        </div>
        
        {frais.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <DollarSign className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Aucun frais</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Ajoutez les frais scolaires pour permettre l&apos;enregistrement des paiements.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé</th>
                <th className="text-left px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant</th>
                <th className="text-left px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fréquence</th>
                <th className="text-left px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cible</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {frais.map((f) => (
                <tr key={f.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="px-8 py-5">
                    <span className="text-base font-black text-slate-900">{f.libelle}</span>
                  </td>
                  <td className="px-4 py-5">
                    <span className="text-base font-black text-emerald-600">{f.montant.toLocaleString('fr-FR')} F</span>
                  </td>
                  <td className="px-4 py-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                      f.frequence === 'unique' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      f.frequence === 'mensuel' ? 'bg-amber-50 text-amber-700' :
                      'bg-purple-50 text-purple-700'
                    }`}>
                      {f.frequence}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <span className="text-sm font-bold text-slate-500 italic">
                      {f.niveau || 'Toutes'}
                    </span>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <button
                      onClick={() => toggleActive(f)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                        f.is_active 
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${f.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      {f.is_active ? 'Actif' : 'Off'}
                    </button>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => openModal(f)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-white hover:shadow-sm transition-all"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteFrais(f)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingFrais ? 'Modifier un frais' : 'Nouveau frais'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveFrais} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Libellé du frais *
                </label>
                <input
                  type="text"
                  value={formData.libelle}
                  onChange={(e) => setFormData(prev => ({ ...prev, libelle: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="ex: Scolarité annuelle"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Montant (F) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.montant}
                    onChange={(e) => setFormData(prev => ({ ...prev, montant: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="25000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Fréquence *
                  </label>
                  <select
                    value={formData.frequence}
                    onChange={(e) => setFormData(prev => ({ ...prev, frequence: e.target.value as any }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="unique">Unique</option>
                    <option value="mensuel">Mensuel</option>
                    <option value="trimestriel">Trimestriel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Niveau (optionnel)
                </label>
                <select
                  value={formData.niveau}
                  onChange={(e) => setFormData(prev => ({ ...prev, niveau: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Tous niveaux</option>
                  {niveaux.map(niveau => (
                    <option key={niveau} value={niveau}>{niveau}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700">
                  Frais actif
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingFrais ? 'Mettre à jour' : 'Créer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
