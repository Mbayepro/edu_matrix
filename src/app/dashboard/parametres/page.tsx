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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Navigation */}
      <div className="flex gap-2 mb-6 text-sm">
        <Link
          href="/dashboard/parametres"
          className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Général
        </Link>
        <Link
          href="/dashboard/parametres/frais"
          className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <DollarSign className="w-4 h-4 inline mr-2" />
          Frais scolaires
        </Link>
        <Link
          href="/dashboard/parametres/equipe"
          className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Users className="w-4 h-4 inline mr-2" />
          Équipe
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-800">Paramètres de l&apos;établissement</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configurez les informations affichées sur les cartes scolaires et les bulletins (logo, tampon, signature).
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-800 text-sm">Informations générales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Nom de l&apos;école
              </label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Ville
              </label>
              <input
                type="text"
                value={form.ville}
                onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Téléphone
              </label>
              <input
                type="text"
                value={form.telephone}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Adresse
              </label>
              <input
                type="text"
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-800 text-sm">Identité visuelle</h2>
          <p className="text-xs text-slate-400">
            Pour le moment, collez ici les URLs des images stockées dans Supabase Storage (ou un autre CDN accessible).
            Une interface d&apos;upload direct pourra être ajoutée plus tard.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1.5fr,1fr] gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  Logo de l&apos;école (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.logo_url}
                    onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://…/logo.png"
                  />
                  <label className="relative flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer transition-colors">
                    {uploading === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
              {form.logo_url && (
                <div className="flex justify-center">
                  <Image
                    src={form.logo_url}
                    alt="Logo de l'école"
                    width={96}
                    height={96}
                    className="rounded-xl border border-slate-200 bg-slate-50 object-contain p-2"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.5fr,1fr] gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5 text-slate-400" />
                  Tampon (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.tampon_url}
                    onChange={(e) => setForm((f) => ({ ...f, tampon_url: e.target.value }))}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://…/tampon.png"
                  />
                  <label className="relative flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer transition-colors">
                    {uploading === 'tampon' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'tampon')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
              {form.tampon_url && (
                <div className="flex justify-center">
                  <Image
                    src={form.tampon_url}
                    alt="Tampon"
                    width={96}
                    height={96}
                    className="rounded-xl border border-slate-200 bg-slate-50 object-contain p-2"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.5fr,1fr] gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-slate-400" />
                  Signature du directeur (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.signature_url}
                    onChange={(e) => setForm((f) => ({ ...f, signature_url: e.target.value }))}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://…/signature.png"
                  />
                  <label className="relative flex items-center justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer transition-colors">
                    {uploading === 'signature' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature')} disabled={!!uploading} />
                  </label>
                </div>
              </div>
              {form.signature_url && (
                <div className="flex justify-center">
                  <Image
                    src={form.signature_url}
                    alt="Signature"
                    width={128}
                    height={64}
                    className="rounded-xl border border-slate-200 bg-slate-50 object-contain p-2"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Enregistrer les paramètres
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

