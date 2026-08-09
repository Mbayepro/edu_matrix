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
  CreditCard,
  Briefcase,
  Calendar,
  Settings2,
  Users
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
        .order('montant', { ascending: false })
      
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
        const { error } = await (supabase.from('frais_scolaires' as any) as any).update(fraisData as any).eq('id', editingFrais.id)
        if (error) throw error
        showToast('Frais mis à jour avec succès.', 'success')
      } else {
        const { error } = await (supabase.from('frais_scolaires' as any) as any).insert(fraisData as any)
        if (error) throw error
        showToast('Nouveau frais créé avec succès.', 'success')
      }

      await loadFrais()
      closeModal()
    } catch (err: any) {
      console.error(err)
      showToast('Erreur lors de la sauvegarde.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(frais: FraisScolaire) {
    if (!ecoleId) return
    const { error } = await (supabase.from('frais_scolaires' as any) as any)
      .update({ is_active: !frais.is_active } as any)
      .eq('id', frais.id)
    if (!error) await loadFrais()
  }

  async function deleteFrais(frais: FraisScolaire) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le frais "${frais.libelle}" ?`)) return
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

  const fraisMensuels = frais.filter(f => f.frequence === 'mensuel')
  const fraisUniques = frais.filter(f => f.frequence === 'unique')
  const fraisTrimestriels = frais.filter(f => f.frequence === 'trimestriel')

  const renderFraisCard = (f: FraisScolaire, typeColor: string, Icon: any) => (
    <div key={f.id} className="relative group bg-white/50 backdrop-blur-xl border border-slate-200/60 rounded-[1.5rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      {/* Glow Effect */}
      <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 bg-gradient-to-br ${typeColor} blur-2xl rounded-full translate-x-10 -translate-y-10 group-hover:opacity-30 transition-all`} />
      
      <div className="relative flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${
            f.is_active ? `bg-white ${typeColor.replace('from-', 'border-').split(' ')[0]}` : 'bg-slate-100 border-slate-200'
          }`}>
            <Icon className={`w-6 h-6 ${f.is_active ? typeColor.replace('from-', 'text-').split(' ')[0] : 'text-slate-400'}`} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight leading-none mb-1.5">{f.libelle}</h3>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                f.niveau ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
              }`}>
                <Users className="w-3 h-3" />
                {f.niveau || 'Tous Niveaux'}
              </span>
            </div>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={() => toggleActive(f)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${
            f.is_active ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${
            f.is_active ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      <div className="flex items-end justify-between mt-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Montant</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 tracking-tighter">
              {f.montant.toLocaleString('fr-FR')}
            </span>
            <span className="text-sm font-bold text-slate-500">FCFA</span>
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => openModal(f)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 flex items-center justify-center transition-all shadow-sm"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => deleteFrais(f)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center transition-all shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {!f.is_active && (
        <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] pointer-events-none rounded-[1.5rem]" />
      )}
    </div>
  )

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          Chargement du catalogue...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Catalogue des Frais</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Structurez et gérez les tarifs de votre établissement scolaire.
          </p>
        </div>

        <nav className="flex p-1.5 bg-white/50 backdrop-blur-md rounded-[1.25rem] border border-slate-200 shadow-sm">
          <Link
            href="/dashboard/parametres"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600"
          >
            Général
          </Link>
          <Link
            href="/dashboard/parametres/frais"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-slate-900 text-white shadow-md"
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
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Ajouter un tarif
        </button>
      </div>

      {frais.length === 0 ? (
        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-[2rem] py-32 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-100">
            <Settings2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Catalogue vide</h3>
          <p className="text-slate-500 font-medium max-w-sm mb-8">
            Commencez par ajouter vos frais de scolarité et d'inscription pour pouvoir enregistrer des paiements.
          </p>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-black rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer le premier frais
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* MENSUEL */}
          {fraisMensuels.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Mensualités (Scolarité)</h2>
                <div className="h-px bg-slate-200 flex-1 ml-4" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fraisMensuels.map(f => renderFraisCard(f, 'from-amber-400 to-orange-500', Calendar))}
              </div>
            </section>
          )}

          {/* UNIQUE */}
          {fraisUniques.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Frais Uniques (Inscription, Tenue...)</h2>
                <div className="h-px bg-slate-200 flex-1 ml-4" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fraisUniques.map(f => renderFraisCard(f, 'from-indigo-400 to-blue-500', Briefcase))}
              </div>
            </section>
          )}

          {/* TRIMESTRIEL */}
          {fraisTrimestriels.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Frais Trimestriels / Autres</h2>
                <div className="h-px bg-slate-200 flex-1 ml-4" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fraisTrimestriels.map(f => renderFraisCard(f, 'from-purple-400 to-pink-500', CreditCard))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modern Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {editingFrais ? 'Modifier le tarif' : 'Nouveau tarif'}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">Configurez les détails du frais scolaire.</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveFrais} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                  Libellé du frais
                </label>
                <input
                  type="text"
                  value={formData.libelle}
                  onChange={(e) => setFormData(prev => ({ ...prev, libelle: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all placeholder:text-slate-300 placeholder:font-normal"
                  placeholder="ex: Scolarité mensuelle 6ème..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Montant (FCFA)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.montant}
                      onChange={(e) => setFormData(prev => ({ ...prev, montant: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-5 pr-12 py-4 text-base font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all placeholder:text-slate-300 placeholder:font-normal"
                      placeholder="25000"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">F</div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                    Niveau concerné
                  </label>
                  <select
                    value={formData.niveau}
                    onChange={(e) => setFormData(prev => ({ ...prev, niveau: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Tous les niveaux</option>
                    {niveaux.map(niveau => (
                      <option key={niveau} value={niveau}>{niveau}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                  Type de prélèvement
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'unique', label: 'Unique', icon: Briefcase },
                    { id: 'mensuel', label: 'Mensuel', icon: Calendar },
                    { id: 'trimestriel', label: 'Trimestriel', icon: CreditCard }
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, frequence: type.id as any }))}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        formData.frequence === type.id
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-sm'
                          : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <type.icon className={`w-5 h-5 mb-2 ${formData.frequence === type.id ? 'text-emerald-500' : 'text-slate-300'}`} />
                      <span className="text-[11px] font-black uppercase tracking-widest">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${formData.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">
                    Frais actif et visible
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {editingFrais ? 'Mettre à jour' : 'Ajouter le tarif'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
