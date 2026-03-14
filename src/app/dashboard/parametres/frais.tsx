'use client'

import { useEffect, useState } from 'react'
import { supabase, FraisScolaire } from '@/lib/supabase'
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Save,
  X,
} from 'lucide-react'

export default function FraisManagementPage() {
  const [ecoleId, setEcoleId] = useState<string | null>(null)
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
    init()
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('ecole_id')
      .eq('user_id', user.id)
      .single()
    
    if (prof?.ecole_id) {
      setEcoleId(prof.ecole_id)
    }
  }

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
        const { error } = await supabase
          .from('frais_scolaires')
          .update(fraisData)
          .eq('id', editingFrais.id)
        
        if (error) {
          console.error('Error updating frais:', error)
          return
        }
      } else {
        // Create new frais
        const { error } = await supabase
          .from('frais_scolaires')
          .insert(fraisData)
        
        if (error) {
          console.error('Error creating frais:', error)
          return
        }
      }

      await loadFrais()
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(frais: FraisScolaire) {
    if (!ecoleId) return
    
    const { error } = await supabase
      .from('frais_scolaires')
      .update({ is_active: !frais.is_active })
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
    
    const { error } = await supabase
      .from('frais_scolaires')
      .delete()
      .eq('id', frais.id)
    
    if (!error) {
      await loadFrais()
    }
  }

  const niveaux = [
    'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
    '6ème', '5ème', '4ème', '3ème',
    '2nde', '1ère', 'Terminale'
  ]

  if (loading) {
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-bold text-slate-800">Gestion des frais scolaires</h1>
        </div>
        
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau frais
        </button>
      </div>

      {/* Frais List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {frais.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">
              Aucun frais configuré
            </h3>
            <p className="text-sm text-slate-400">
              Commencez par ajouter vos premiers frais scolaires.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Libellé
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Montant
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Fréquence
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Niveau
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Statut
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {frais.map((frais) => (
                  <tr key={frais.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">
                        {frais.libelle}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-emerald-600">
                        {frais.montant.toLocaleString('fr-FR')} F
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        frais.frequence === 'unique' ? 'bg-blue-100 text-blue-700' :
                        frais.frequence === 'mensuel' ? 'bg-amber-100 text-amber-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {frais.frequence}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {frais.niveau || 'Tous niveaux'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(frais)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                          frais.is_active 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {frais.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openModal(frais)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteFrais(frais)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
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
          </div>
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
