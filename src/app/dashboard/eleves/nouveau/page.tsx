'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Classe } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  UserPlus, ArrowLeft, Loader2, User, HelpCircle,
  Calendar, Hash, Briefcase, AlertCircle, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import PhotoInput from '@/components/PhotoInput'

/** Génère un matricule unique : format EL-YYYYMMDD-XXXX */
function generateMatricule(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `EL-${date}-${rand}`
}

export default function NouveauElevePage() {
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const { showToast } = useToast()
  const ecoleId = profile?.ecole_id || null

  const [classes, setClasses] = useState<Classe[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable id for storage path (generated once so upload and save are in sync)
  const [tempId] = useState(() => `new-${Date.now()}`)

  // Form fields
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [matricule, setMatricule] = useState(() => generateMatricule())
  const [dateNaissance, setDateNaissance] = useState('')
  const [classeId, setClasseId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  useEffect(() => {
    if (ecoleId) {
      loadClasses(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadClasses(schoolId: string) {
    try {
      setLoading(true)
      const { data: cls } = await supabase
        .from('classes')
        .select('*')
        .eq('ecole_id', schoolId)
        .order('nom_classe')
      
      setClasses(cls || [])
      if (cls && cls.length > 0) setClasseId(cls[0].id)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!profile?.ecole_id) {
      setError("Erreur : Impossible d'identifier l'école.")
      setSaving(false)
      return
    }

    try {
      const { error: insertError } = await supabase.from('eleves').insert({
        ecole_id: profile.ecole_id,
        classe_id: classeId,
        prenom,
        nom,
        matricule: matricule.trim() || null,
        date_naissance: dateNaissance || null,
        photo_url: photoUrl || null,
      })

      if (insertError) throw insertError

      showToast('Élève inscrit avec succès !', 'success')
      router.push('/dashboard/eleves')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      if (err.message?.includes('eleves_matricule_key')) {
        setError("Ce matricule est déjà utilisé. Cliquez sur ↺ pour en générer un nouveau.")
      } else {
        setError("Une erreur s'est produite lors de l'inscription.")
      }
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm'

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/eleves"
            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-slate-400 hover:text-emerald-600 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                <UserPlus className="w-3.5 h-4 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inscrire un Élève</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium tracking-tight">
              Constituez le dossier académique du nouvel apprenant.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm p-10 relative overflow-hidden group transition-all duration-500 hover:shadow-xl hover:shadow-emerald-900/5">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full -mr-24 -mt-24 transition-transform group-hover:scale-110" />

        {classes.length === 0 ? (
          <div className="bg-slate-50/50 rounded-3xl p-16 text-center animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
              <HelpCircle className="w-10 h-10 text-amber-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Configuration Requise</h3>
            <p className="text-base text-slate-400 font-medium max-w-sm mx-auto mb-8">
              Vous devez d&apos;abord définir vos classes avant de pouvoir inscrire des élèves.
            </p>
            <Link 
              href="/dashboard/classes" 
              className="inline-flex items-center gap-3 bg-slate-900 hover:bg-emerald-600 text-white font-black py-4 px-8 rounded-2xl transition-all shadow-xl shadow-slate-900/10"
            >
              Paramétrer les Classes
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-10 relative z-10">

            {/* Photo Section */}
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Portrait de l&apos;élève</p>
              <PhotoInput
                value={photoUrl}
                onChange={setPhotoUrl}
                storageId={tempId}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">

              {/* Prénom */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="text" required value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all" 
                    placeholder="Ex: Babacar" />
                </div>
              </div>

              {/* Nom */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="text" required value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all" 
                    placeholder="Ex: Diop" />
                </div>
              </div>

              {/* Classe */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Structure / Classe <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <select required value={classeId} onChange={(e) => setClasseId(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all appearance-none cursor-pointer">
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.nom_classe}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Matricule */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Matricule Unique <span className="text-slate-300 font-bold">(Automatique)</span>
                </label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="text" value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm font-black text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all tracking-wider"
                    placeholder="Auto-généré" />
                  <button type="button"
                    onClick={() => setMatricule(generateMatricule())}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    title="Regénérer le matricule">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Date de naissance */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Date de naissance <span className="text-slate-300 font-bold">(Optionnel)</span>
                </label>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="date" value={dateNaissance}
                    onChange={(e) => setDateNaissance(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all" />
                </div>
              </div>

            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-6 rounded-[2rem] text-sm font-bold flex items-start gap-4 border border-red-100 animate-in shake duration-500">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
              <Link 
                href="/dashboard/eleves"
                className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest text-center transition-all"
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={saving || classes.length === 0}
                className="flex-[2] py-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Finalisation…</>
                ) : (
                  <><UserPlus className="w-5 h-5 mr-1" /> Confirmer l&apos;Inscription</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
