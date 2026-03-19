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
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'

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
      const { data: ec } = await supabase
        .from('ecoles')
        .select('*')
        .eq('id', schoolId)
        .single()

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
      const { error } = await supabase
        .from('ecoles')
        .update({
          nom: form.nom,
          ville: form.ville,
          telephone: form.telephone || null,
          adresse: form.adresse || null,
          logo_url: form.logo_url || null,
          tampon_url: form.tampon_url || null,
          signature_url: form.signature_url || null,
        })
        .eq('id', ecole.id)

      if (!error) {
        await load(ecole.id)
        showToast('Paramètres mis à jour avec succès.', 'success')
      }
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
      const ext = file.name.split('.').pop()
      const path = `branding/${ecole.id}_${type}_${Date.now()}.${ext}`
      
      const { error: uploadErr } = await supabase.storage
        .from('eleves-photos') // Reuse existing bucket to avoid missing bucket errors
        .upload(path, file, { upsert: true })
        
      if (uploadErr) throw uploadErr
      
      const { data: { publicUrl } } = supabase.storage
        .from('eleves-photos')
        .getPublicUrl(path)
        
      setForm(prev => ({ ...prev, [`${type}_url`]: publicUrl }))
    } catch (err) {
      console.error('Upload error:', err)
      showToast("Erreur lors de l'upload de l'image.", 'error')
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
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <PenTool className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Paramètres École</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Configurez l&apos;identité et les documents officiels de votre établissement.
          </p>
        </div>

        <nav className="flex p-1.5 bg-slate-100 rounded-[1.25rem] border border-slate-200 shadow-inner">
          <Link
            href="/dashboard/parametres"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white text-emerald-600 shadow-sm"
          >
            Général
          </Link>
          <Link
            href="/dashboard/parametres/frais"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600"
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

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-slate-900">Informations Générales</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de l&apos;établissement</label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ville</label>
              <input
                type="text"
                value={form.ville}
                onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Téléphone Contact</label>
              <input
                type="text"
                value={form.telephone}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Adresse Physique</label>
              <input
                type="text"
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 space-y-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Stamp className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-slate-900">Identité Visuelle</h2>
          </div>

          <div className="space-y-10">
            {/* Logo */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8 border-b border-slate-50 pb-8">
              <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden group">
                {form.logo_url ? (
                  <Image src={form.logo_url} alt="Logo" width={96} height={96} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Logo de l&apos;établissement</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.logo_url}
                    onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-mono text-slate-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="URL du logo…"
                  />
                  <label className="px-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all cursor-pointer shadow-lg shadow-slate-900/10 flex items-center gap-2">
                    {uploading === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
            </div>

            {/* Tampon */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8 border-b border-slate-50 pb-8">
              <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden group">
                {form.tampon_url ? (
                  <Image src={form.tampon_url} alt="Tampon" width={96} height={96} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500 shadow-inner" />
                ) : (
                  <Stamp className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Tampon Officiel</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.tampon_url}
                    onChange={(e) => setForm((f) => ({ ...f, tampon_url: e.target.value }))}
                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-mono text-slate-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="URL du tampon…"
                  />
                  <label className="px-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all cursor-pointer shadow-lg shadow-slate-900/10 flex items-center gap-2">
                    {uploading === 'tampon' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'tampon')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
            </div>

            {/* Signature */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden group">
                {form.signature_url ? (
                  <Image src={form.signature_url} alt="Signature" width={128} height={64} className="w-full h-full object-contain p-2 group-hover:rotate-6 transition-transform duration-500" />
                ) : (
                  <PenTool className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-4">
                <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Signature Direction</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.signature_url}
                    onChange={(e) => setForm((f) => ({ ...f, signature_url: e.target.value }))}
                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-mono text-slate-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="URL de la signature…"
                  />
                  <label className="px-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all cursor-pointer shadow-lg shadow-slate-900/10 flex items-center gap-2">
                    {uploading === 'signature' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
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

