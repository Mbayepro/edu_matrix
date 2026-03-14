'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, User, School, MapPin, Phone, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function SignupForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nomEcole, setNomEcole] = useState('')
  const [ville, setVille] = useState('')
  const [telephone, setTelephone] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Create the user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom,
            prenom,
            role: 'director', // Important: user is a director
            // Temporary metadata, will be used by trigger or client-side logic
            nom_ecole: nomEcole,
            ville_ecole: ville,
            telephone_ecole: telephone,
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error("Erreur lors de la création de l'utilisateur")

      // 2. Create the school (Ecole) manually if trigger doesn't handle it fully or to be safe
      // Note: RLS might prevent this if the user is not yet fully set up.
      // Ideally, we use a Postgres Function (RPC) to create both User and Ecole, 
      // or we rely on the Trigger.
      // 
      // STRATEGY: 
      // The trigger `handle_new_user` currently inserts into `profiles`.
      // We need to modify the system so that it creates an `ecoles` record first, 
      // then links it to the profile.
      //
      // However, since we cannot easily modify the trigger from the client,
      // we will use a robust approach:
      // - The user is created.
      // - The trigger creates the profile (with null ecole_id initially).
      // - We (the client) then call a custom RPC function or standard insert 
      //   (if RLS allows) to create the school and update the profile.
      
      // Let's rely on a more standard flow:
      // The user is created. We show a success message asking to confirm email.
      // OR if email confirmation is disabled, we proceed.
      
      // Assuming email confirmation might be on, we can't do much more until they log in.
      // BUT, for a smooth UX, let's assume we can insert the school if we are authenticated.
      // Since `signUp` returns a session if email confirm is off, we can proceed.
      
      if (authData.session) {
        // User is logged in immediately
        
        // Create the school
        const { data: ecoleData, error: ecoleError } = await supabase
          .from('ecoles')
          .insert({
            nom: nomEcole,
            ville,
            telephone,
          })
          .select()
          .single()

        if (ecoleError) throw ecoleError

        // Update the profile with the new ecole_id
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ ecole_id: ecoleData.id })
          .eq('user_id', authData.user.id)

        if (profileError) throw profileError

        router.refresh()
        router.push('/dashboard')
      } else {
        // Email confirmation required
        setError('Compte créé ! Veuillez vérifier votre email pour confirmer votre inscription.')
        setLoading(false) // Keep showing the success message in error field (or separate state)
        return
      }

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Une erreur est survenue lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 py-12">
      <div className="w-full max-w-2xl bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Créer votre école</h1>
          <p className="text-slate-400">Inscrivez-vous en tant que Directeur</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          
          {/* Section Informations Personnelles */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2">
              Informations du Directeur
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Prénom</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Moussa"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Diop"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section Informations de l'École */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2">
              Informations de l'École
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom de l'établissement</label>
              <div className="relative">
                <School className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={nomEcole}
                  onChange={(e) => setNomEcole(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="Groupe Scolaire Excellence"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Ville</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="Dakar"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="77 000 00 00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section Identifiants */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2">
              Identifiants de Connexion
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email professionnel</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="directeur@ecole.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${error.includes('vérifier votre email') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Création du compte...
              </>
            ) : (
              'Créer mon école'
            )}
          </button>

          <p className="text-center text-slate-400 text-sm mt-4">
            Déjà inscrit ?{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
