'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Classe, Eleve } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import {
  Save, ArrowLeft, Loader2, User, HelpCircle,
  Calendar, Hash, Briefcase, AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import PhotoInput from '@/components/PhotoInput'

export default function ModifierElevePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const { profile, loading: profileLoading } = useProfile()
  const { showToast } = useToast()
  const ecoleId = profile?.ecole_id || null

  const [classes, setClasses] = useState<Classe[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [matricule, setMatricule] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [classeId, setClasseId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  useEffect(() => {
    if (ecoleId && id) loadData(ecoleId, id)
    else if (!profileLoading && !ecoleId) setLoading(false)
  }, [ecoleId, profileLoading, id])

  async function loadData(schoolId: string, eleveId: string) {
    try {
      setLoading(true)
      const [{ data: cls }, { data: eleveData, error: eleveError }] = await Promise.all([
        supabase.from('classes').select('*').eq('ecole_id', schoolId).order('nom_classe'),
        (supabase.from('eleves').select('*').eq('id', eleveId).single() as any),
      ])
      setClasses(cls || [])

      if (eleveError || !eleveData) { setError("Élève introuvable."); return }

      const eleve = eleveData as Eleve
      setPrenom(eleve.prenom || '')
      setNom(eleve.nom || '')
      setMatricule(eleve.matricule || '')
      setDateNaissance(eleve.date_naissance ? eleve.date_naissance.split('T')[0] : '')
      setClasseId(eleve.classe_id || '')
      setPhotoUrl(eleve.photo_url || '')
    } catch (err: any) {
      setError("Une erreur est survenue lors du chargement.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (!ecoleId || !id) { setError("Erreur : Données manquantes."); setSaving(false); return }

    try {
      const { error: updateError } = await (supabase.from('eleves') as any)
        .update({
          classe_id: classeId,
          prenom, nom,
          matricule: matricule || null,
          date_naissance: dateNaissance || null,
          photo_url: photoUrl || null,
        } as any)
        .eq('id', id)

      if (updateError) throw updateError

      showToast('Élève modifié avec succès !', 'success')
      router.push('/dashboard/eleves')
      router.refresh()
    } catch (err: any) {
      if (err.message?.includes('eleves_matricule_key')) {
        setError("Ce matricule est déjà utilisé par un autre élève.")
      } else {
        setError("Une erreur s'est produite lors de la modification.")
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
        <Link href="/dashboard/eleves"
          className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modifier un élève</h1>
          <p className="text-sm text-slate-500">Mettez à jour les informations de l'élève.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
        {classes.length === 0 ? (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
            <HelpCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <h3 className="font-semibold text-amber-800 mb-1">Aucune classe disponible</h3>
            <Link href="/dashboard/classes"
              className="inline-flex mt-3 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
              Gérer les classes
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Photo — upload ou URL au choix */}
            {/* storageId = id réel de l'élève → upsert propre dans le bucket */}
            <PhotoInput
              value={photoUrl}
              onChange={setPhotoUrl}
              storageId={id ?? 'unknown'}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" required value={prenom} onChange={e => setPrenom(e.target.value)} className={inputCls} placeholder="Ex: Awa" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" required value={nom} onChange={e => setNom(e.target.value)} className={inputCls} placeholder="Ex: Sall" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Classe <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select required value={classeId} onChange={e => setClasseId(e.target.value)} className={inputCls + ' appearance-none'}>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom_classe}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Matricule <span className="text-slate-400 font-normal">(Optionnel)</span></label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" value={matricule} onChange={e => setMatricule(e.target.value)} className={inputCls + ' font-mono'} placeholder="Ex: EL-20260316-AB12" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date de naissance <span className="text-slate-400 font-normal">(Optionnel)</span></label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} className={inputCls} />
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
              <button type="submit" disabled={saving || classes.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : <><Save className="w-4 h-4" /> Mettre à jour</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
