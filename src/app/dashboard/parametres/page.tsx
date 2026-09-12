'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase, Ecole, Profile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ImageIcon,
  Stamp,
  PenTool,
  Loader2,
  Save,
  DollarSign,
  Upload,
  Users,
  Settings2,
  GraduationCap,
  Blocks,
  Smartphone,
  MessageSquare
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { compressImage } from '@/lib/imageCompression'

export default function SchoolSettingsPage() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [ecole, setEcole] = useState<Ecole | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'tampon' | 'signature' | null>(null)
  const [form, setForm] = useState({
    nom: '',
    ville: '',
    telephone: '',
    adresse: '',
    logo_url: '',
    tampon_url: '',
    signature_url: '',
    calculation_method: 'BLOCKS',
    type_periode: 'trimestre' as 'trimestre' | 'semestre',
    cycles_couverts: ['primaire'] as string[],
    heure_limite_retard: '08:30',
    seuil_passage_secondaire: 10,
    seuil_redoublement_secondaire: 8.5,
    seuil_passage_primaire: 5,
    seuil_redoublement_primaire: 4,
    seuil_alerte_chute: 2,
    seuil_alerte_absences: 5,
  })

  useEffect(() => {
    if (ecoleId) {
      load(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function load(schoolId: string) {
    try {
      setLoading(true)
      const { data: ec } = await (supabase
        .from('ecoles')
        .select('*')
        .eq('id', schoolId)
        .single() as any)

      if (ec) {
        setEcole(ec as Ecole)
        setForm({
          nom: ec.nom ?? '',
          ville: ec.ville ?? '',
          telephone: ec.telephone ?? '',
          adresse: ec.adresse ?? '',
          logo_url: ec.logo_url ?? '',
          tampon_url: ec.tampon_url ?? '',
          signature_url: ec.signature_url ?? '',
          calculation_method: ec.calculation_method ?? 'BLOCKS',
          type_periode: ec.type_periode ?? 'trimestre',
          cycles_couverts: ec.cycles_couverts ?? ['primaire'],
          heure_limite_retard: ec.heure_limite_retard ?? '08:30',
          seuil_passage_secondaire: ec.seuil_passage_secondaire ?? 10,
          seuil_redoublement_secondaire: ec.seuil_redoublement_secondaire ?? 8.5,
          seuil_passage_primaire: ec.seuil_passage_primaire ?? 5,
          seuil_redoublement_primaire: ec.seuil_redoublement_primaire ?? 4,
          seuil_alerte_chute: ec.seuil_alerte_chute ?? 2,
          seuil_alerte_absences: ec.seuil_alerte_absences ?? 5,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!ecole) return
    setSaving(true)
    try {
      const { error } = await (supabase.from('ecoles' as any) as any)
        .update({
          nom: form.nom,
          ville: form.ville,
          telephone: form.telephone || null,
          adresse: form.adresse || null,
          logo_url: form.logo_url || null,
          tampon_url: form.tampon_url || null,
          signature_url: form.signature_url || null,
          calculation_method: form.calculation_method,
          cycles_couverts: form.cycles_couverts,
          heure_limite_retard: form.heure_limite_retard,
          seuil_passage_secondaire: form.seuil_passage_secondaire,
          seuil_redoublement_secondaire: form.seuil_redoublement_secondaire,
          seuil_passage_primaire: form.seuil_passage_primaire,
          seuil_redoublement_primaire: form.seuil_redoublement_primaire,
          seuil_alerte_chute: form.seuil_alerte_chute,
          seuil_alerte_absences: form.seuil_alerte_absences,
          type_periode: form.type_periode,
        } as any)
        .eq('id', ecole.id)

      if (error) throw error

      await load(ecole.id)
      showToast('Paramètres mis à jour avec succès.', 'success')
    } catch (err: any) {
      showToast('Erreur lors de la sauvegarde : ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'tampon' | 'signature') {
    const file = e.target.files?.[0]
    if (!file || !ecole) return
    
    setUploading(type)
    try {
      // Pour les logos et signatures on autorise une bonne qualité mais on redimensionne si trop grand
      const compressedFile = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 })
      const ext = compressedFile.name.split('.').pop()
      // Utilisation du dossier 'photos/' qui est déjà autorisé par les politiques RLS
      const path = `photos/branding_${ecole.id}_${type}_${Date.now()}.${ext}`
      
      const { error: uploadErr } = await (supabase.storage.from('eleves-photos' as any) as any)
        .upload(path, compressedFile, { cacheControl: '3600', upsert: false })
        
      if (uploadErr) throw uploadErr
      
      const { data: { publicUrl } } = (supabase.storage.from('eleves-photos' as any) as any)
        .getPublicUrl(path)
        
      setForm(prev => ({ ...prev, [`${type}_url`]: publicUrl }))
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} mis à jour dans l'aperçu.`, 'success')
    } catch (err: any) {
      console.error('Upload error:', err)
      showToast(`Erreur d'upload : ${err.message || "Problème de connexion"}`, 'error')
    } finally {
      setUploading(null)
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement des paramètres de l&apos;école…
        </div>
      </div>
    )
  }

  if (!ecole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <p>Aucune école associée à votre compte.</p>
        <Link href="/dashboard" className="mt-4 text-emerald-600 hover:underline">Retour au tableau de bord</Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <PenTool className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Paramètres École</h1>
          </div>
          <p className="text-sm text-slate-400 font-medium tracking-tight">
            Configurez l&apos;identité et les documents officiels de votre établissement.
          </p>
        </div>

        <nav className="flex p-1.5 bg-slate-900/50 rounded-[1.25rem] border border-white/10 shadow-inner backdrop-blur-sm">
          <Link
            href="/dashboard/parametres"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-sm"
          >
            Général
          </Link>
          <Link
            href="/dashboard/parametres/frais"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-200 hover:bg-white/5"
          >
            Frais
          </Link>
          <Link
            href="/dashboard/parametres/equipe"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-200 hover:bg-white/5"
          >
            Équipe
          </Link>
        </nav>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Informations Générales */}
        <div className="bg-slate-900/40 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-sm p-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <ImageIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-white">Informations Générales</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de l&apos;établissement</label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white placeholder-slate-500 focus:ring-4 focus:ring-emerald-500/20 focus:bg-slate-800 transition-all shadow-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ville</label>
              <input
                type="text"
                value={form.ville}
                onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white placeholder-slate-500 focus:ring-4 focus:ring-emerald-500/20 focus:bg-slate-800 transition-all shadow-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Téléphone Contact</label>
              <input
                type="text"
                value={form.telephone}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white placeholder-slate-500 focus:ring-4 focus:ring-emerald-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Adresse Physique</label>
              <input
                type="text"
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white placeholder-slate-500 focus:ring-4 focus:ring-emerald-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Paramètres Pédagogiques */}
        <div className="bg-slate-900/40 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-sm p-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <GraduationCap className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-white">Paramètres Pédagogiques</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Méthode de calcul des moyennes</label>
              <select
                value={form.calculation_method}
                onChange={(e) => setForm((f) => ({ ...f, calculation_method: e.target.value }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-purple-500/20 focus:bg-slate-800 transition-all shadow-sm appearance-none cursor-pointer"
              >
                <option value="BLOCKS" className="bg-slate-900 text-white">Méthode par BLOCKS (Par défaut)</option>
                <option value="WEIGHTED" className="bg-slate-900 text-white">Méthode PONDÉRÉE (Composition compte double)</option>
              </select>
              <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <p className="text-[11px] text-purple-300 font-bold leading-relaxed">
                  💡 La méthode de calcul des moyennes est définie par l’établissement dans les paramètres pédagogiques.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Période</label>
              <select
                value={form.type_periode}
                onChange={(e) => setForm((f) => ({ ...f, type_periode: e.target.value as 'trimestre' | 'semestre' }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-purple-500/20 focus:bg-slate-800 transition-all shadow-sm appearance-none cursor-pointer"
              >
                <option value="trimestre" className="bg-slate-900 text-white">Trimestres (3 périodes)</option>
                <option value="semestre" className="bg-slate-900 text-white">Semestres (2 périodes)</option>
              </select>
              <div className="flex items-center p-6 bg-slate-800/30 rounded-[1.5rem] border border-dashed border-white/10 mt-2">
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  <span className="font-bold text-slate-300 block mb-1">Impact sur les bulletins :</span>
                  Le changement de période modifie l'affichage global de l'application (Saisie des notes, bulletins).
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Heure de retard (Scanner QR)</label>
              <input
                type="time"
                value={form.heure_limite_retard}
                onChange={(e) => setForm((f) => ({ ...f, heure_limite_retard: e.target.value }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-purple-500/20 focus:bg-slate-800 transition-all shadow-sm cursor-text"
              />
              <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <p className="text-[11px] text-purple-300 font-bold leading-relaxed">
                  ⏳ Heure à partir de laquelle un élève est considéré en retard lors du scan de sa carte QR.
                </p>
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cycles Couverts</label>
              <div className="flex flex-wrap gap-4">
                {[
                  { id: 'primaire', label: 'Primaire (CI - CM2)' },
                  { id: 'moyen', label: 'Moyen (6ème - 3ème)' },
                  { id: 'secondaire', label: 'Secondaire (2nde - Tle)' }
                ].map(cycle => (
                  <label key={cycle.id} className={`flex items-center gap-2 cursor-pointer bg-slate-800/50 border ${form.cycles_couverts.includes(cycle.id) ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/10'} px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors`}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500/50 bg-slate-900 border-white/20"
                      checked={form.cycles_couverts.includes(cycle.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm(f => ({ ...f, cycles_couverts: [...f.cycles_couverts, cycle.id] }))
                        } else {
                          setForm(f => ({ ...f, cycles_couverts: f.cycles_couverts.filter(c => c !== cycle.id) }))
                        }
                      }}
                    />
                    <span className="text-sm font-bold text-white">{cycle.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Seuils Pédagogiques */}
        <div className="bg-slate-900/40 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-sm p-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shadow-lg shadow-orange-500/10">
              <Settings2 className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-white">Seuils Pédagogiques</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Seuil de passage (Secondaire)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={form.seuil_passage_secondaire}
                onChange={(e) => setForm((f) => ({ ...f, seuil_passage_secondaire: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-orange-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Seuil de redoublement (Secondaire)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={form.seuil_redoublement_secondaire}
                onChange={(e) => setForm((f) => ({ ...f, seuil_redoublement_secondaire: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-orange-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Seuil de passage (Primaire)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={form.seuil_passage_primaire}
                onChange={(e) => setForm((f) => ({ ...f, seuil_passage_primaire: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-orange-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Seuil de redoublement (Primaire)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={form.seuil_redoublement_primaire}
                onChange={(e) => setForm((f) => ({ ...f, seuil_redoublement_primaire: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-orange-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Alerte chute de moyenne (pts)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={form.seuil_alerte_chute}
                onChange={(e) => setForm((f) => ({ ...f, seuil_alerte_chute: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-orange-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Alerte absentéisme (absences)</label>
              <input
                type="number"
                min="0"
                value={form.seuil_alerte_absences}
                onChange={(e) => setForm((f) => ({ ...f, seuil_alerte_absences: parseInt(e.target.value, 10) || 0 }))}
                className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-orange-500/20 focus:bg-slate-800 transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-sm p-8 space-y-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Stamp className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-white">Identité Visuelle</h2>
          </div>

          <div className="space-y-10">
            {/* Logo */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8 border-b border-white/5 pb-8">
              <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/10 overflow-hidden group">
                {form.logo_url ? (
                  <Image src={form.logo_url} alt="Logo" width={96} height={96} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-sm font-bold text-white uppercase tracking-tight">Logo de l&apos;établissement</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.logo_url}
                    onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                    className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="URL du logo…"
                  />
                  <label className="px-5 py-3 rounded-xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all cursor-pointer border border-white/10 flex items-center gap-2">
                    {uploading === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
            </div>

            {/* Tampon */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8 border-b border-white/5 pb-8">
              <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/10 overflow-hidden group">
                {form.tampon_url ? (
                  <Image src={form.tampon_url} alt="Tampon" width={96} height={96} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500 shadow-inner" />
                ) : (
                  <Stamp className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-sm font-bold text-white uppercase tracking-tight">Tampon Officiel</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.tampon_url}
                    onChange={(e) => setForm((f) => ({ ...f, tampon_url: e.target.value }))}
                    className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="URL du tampon…"
                  />
                  <label className="px-5 py-3 rounded-xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all cursor-pointer border border-white/10 flex items-center gap-2">
                    {uploading === 'tampon' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'tampon')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
            </div>

            {/* Signature */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/10 overflow-hidden group">
                {form.signature_url ? (
                  <Image src={form.signature_url} alt="Signature" width={128} height={64} className="w-full h-full object-contain p-2 group-hover:rotate-6 transition-transform duration-500" />
                ) : (
                  <PenTool className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-sm font-bold text-white uppercase tracking-tight">Signature Direction</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.signature_url}
                    onChange={(e) => setForm((f) => ({ ...f, signature_url: e.target.value }))}
                    className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="URL de la signature…"
                  />
                  <label className="px-5 py-3 rounded-xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all cursor-pointer border border-white/10 flex items-center gap-2">
                    {uploading === 'signature' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Intégrations & Modules (Bientôt Disponible) */}
        <div className="bg-slate-900/40 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-sm p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
                <Blocks className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-base font-black uppercase tracking-widest text-white">Intégrations & Modules</h2>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">En cours de déploiement</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Paiement Mobile */}
            <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-4 right-4">
                <div className="w-10 h-6 bg-slate-700 rounded-full flex items-center p-1 opacity-50 cursor-not-allowed">
                  <div className="w-4 h-4 bg-slate-500 rounded-full"></div>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">Paiement Mobile Money</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Permettez aux parents de payer la scolarité directement via Wave ou Orange Money depuis leur espace parent.
              </p>
            </div>

            {/* Alertes WhatsApp */}
            <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-4 right-4">
                <div className="w-10 h-6 bg-slate-700 rounded-full flex items-center p-1 opacity-50 cursor-not-allowed">
                  <div className="w-4 h-4 bg-slate-500 rounded-full"></div>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">Alertes WhatsApp Automatiques</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Envoyez automatiquement un message WhatsApp aux parents en cas d'absence, de retard à l'école ou de retard de paiement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-3 px-10 py-4 rounded-[1.25rem] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Mettre à jour les paramètres
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

