'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Lock, Mail, User, School, MapPin, Phone,
  Loader2, CheckCircle2, Clock, GraduationCap,
} from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'

type Step = 'form' | 'success'

export default function SignupForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [prenom, setPrenom]       = useState('')
  const [nom, setNom]             = useState('')
  const [nomEcole, setNomEcole]   = useState('')
  const [ville, setVille]         = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')

  const searchParams = useSearchParams()
  const invitedSchoolId = searchParams.get('school')
  const invitedRole = (searchParams.get('role') as any) || 'director'
  const isInvitation = !!invitedSchoolId

  useEffect(() => {
    if (isInvitation) {
      // Fetch school name if possible or just set a placeholder
      setNomEcole('Invitation en cours...')
    }
  }, [isInvitation])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Pass ALL data (including school info) via user metadata.
      // The SECURITY DEFINER trigger `handle_new_user` will atomically create
      // the school row and the profile row, bypassing RLS entirely.
      // This avoids the race condition where the client tries to INSERT into
      // `ecoles` before the profile exists, causing get_my_role() to return NULL.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom,
            prenom,
            role: isInvitation ? invitedRole : 'director',
            ecole_id: isInvitation ? invitedSchoolId : null,
            nom_ecole: isInvitation ? 'Membre École' : nomEcole,
            ville_ecole: isInvitation ? 'N/A' : ville,
            telephone_ecole: isInvitation ? null : (telephone || null),
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error("Erreur lors de la création du compte.")

      // Show the success / pending screen
      if (isInvitation) {
        setStep('success')
      } else {
        router.push('/inscription-reussie')
      }

    } catch (err: any) {
      console.error(err)
      if (err.message?.includes('already registered')) {
        setError('Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.')
      } else {
        setError(err.message || 'Une erreur est survenue. Réessayez.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ──── Success screen ────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md text-center">
          <div className="bg-slate-900 rounded-2xl p-10 border border-slate-800 shadow-2xl">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/15 rounded-2xl mb-5">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {isInvitation ? 'Bienvenue dans votre équipe !' : 'Demande envoyée !'}
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {isInvitation 
                ? 'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter pour accéder à votre espace de travail.'
                : <>Votre école <strong className="text-white">{nomEcole}</strong> est en attente de validation par le Super Administrateur EduMatrix.<br /><br />Vous recevrez une confirmation dès que votre accès sera activé.</>
              }
            </p>

            {!isInvitation && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-amber-300 text-xs font-semibold">Ce qui se passe ensuite :</p>
                </div>
                <ul className="text-slate-400 text-xs space-y-1.5 ml-6 list-disc">
                  <li>Le Super Admin examine votre demande</li>
                  <li>Votre école est activée (généralement sous 24h)</li>
                  <li>Vous pouvez alors accéder à votre espace directeur</li>
                </ul>
              </div>
            )}

            <Link
              href="/login"
              className="block w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm"
            >
              Aller à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ──── Registration form ─────────────────────────────────────────
  const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
  const labelClass = "block text-sm font-medium text-slate-300 mb-1.5"

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500 rounded-2xl mb-4 shadow-lg shadow-emerald-500/30">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isInvitation ? 'Rejoindre votre établissement' : 'Inscrire votre école'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isInvitation ? `Créez votre compte ${invitedRole === 'teacher' ? 'Enseignant' : 'Admin'}` : 'Créez votre espace directeur sur EduMatrix'}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-2xl">
          <form onSubmit={handleSignup} className="space-y-8">

            {/* Section 1 — Director info */}
            <div>
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> Informations du Directeur
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Prénom</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="signup-prenom"
                      type="text" value={prenom} onChange={e => setPrenom(e.target.value)}
                      required className={inputClass} placeholder="Moussa" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Nom de famille</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="signup-nom"
                      type="text" value={nom} onChange={e => setNom(e.target.value)}
                      required className={inputClass} placeholder="Diop" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 — School info (Hidden if invitation) */}
            {!isInvitation && (
              <div>
                <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <School className="w-4 h-4" /> Informations de l&apos;École
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Nom de l&apos;établissement</label>
                    <div className="relative">
                      <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        id="signup-ecole"
                        type="text" value={nomEcole} onChange={e => setNomEcole(e.target.value)}
                        required className={inputClass} placeholder="Groupe Scolaire Excellence" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Ville</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          id="signup-ville"
                          type="text" value={ville} onChange={e => setVille(e.target.value)}
                          required className={inputClass} placeholder="Dakar" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Téléphone <span className="text-slate-500 font-normal">(optionnel)</span></label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          id="signup-tel"
                          type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
                          className={inputClass} placeholder="77 000 00 00" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3 — Credentials */}
            <div>
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Identifiants de connexion
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Email professionnel</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="signup-email"
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      required autoComplete="email"
                      className={inputClass} placeholder="directeur@ecole.com" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Mot de passe <span className="text-slate-500 font-normal">(min. 6 caractères)</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="signup-password"
                      type="password" value={password} onChange={e => setPassword(e.target.value)}
                      required minLength={6} autoComplete="new-password"
                      className={inputClass} placeholder="••••••••" />
                  </div>
                </div>
              </div>
            </div>

            {/* Info banner */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-slate-400 text-xs leading-relaxed">
                Votre inscription sera examinée par le Super Administrateur EduMatrix avant activation.
                Ce processus prend généralement moins de 24h.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                ⚠️ {error}
              </div>
            )}

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création du compte…
                </>
              ) : (
                'Soumettre ma demande d\'inscription'
              )}
            </button>

            <p className="text-center text-slate-500 text-sm">
              Déjà inscrit ?{' '}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Se connecter
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
