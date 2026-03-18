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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/eleves"
          className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inscrire un élève</h1>
          <p className="text-sm text-slate-500">Ajoutez un nouvel élève à votre établissement.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
        {classes.length === 0 ? (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
            <HelpCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <h3 className="font-semibold text-amber-800 mb-1">Aucune classe disponible</h3>
            <p className="text-amber-600 text-sm mb-4">
              Veuillez d'abord configurer vos classes avant d'inscrire des élèves.
            </p>
            <Link 
              href="/dashboard/classes" 
              className="inline-flex bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Gérer les classes
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Photo — upload ou URL au choix */}
            <PhotoInput
              value={photoUrl}
              onChange={setPhotoUrl}
              storageId={tempId}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Prénom */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" required value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className={inputCls} placeholder="Ex: Awa" />
                </div>
              </div>

              {/* Nom */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nom <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" required value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className={inputCls} placeholder="Ex: Sall" />
                </div>
              </div>

              {/* Classe */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Classe <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select required value={classeId} onChange={(e) => setClasseId(e.target.value)}
                    className={inputCls + ' appearance-none'}>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.nom_classe}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Matricule auto-généré */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Matricule <span className="text-slate-400 font-normal text-xs">(généré automatiquement)</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    className={inputCls + ' pr-10 font-mono'}
                    placeholder="Ex: EL-20260316-AB12" />
                  <button type="button"
                    onClick={() => setMatricule(generateMatricule())}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                    title="Regénérer">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Modifiable manuellement.</p>
              </div>

              {/* Date de naissance */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Date de naissance <span className="text-slate-400 font-normal">(Optionnel)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="date" value={dateNaissance}
                    onChange={(e) => setDateNaissance(e.target.value)}
                    className={inputCls} />
                </div>
              </div>

            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2 border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving || classes.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Inscrire l'élève</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
