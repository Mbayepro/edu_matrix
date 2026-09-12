'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ShieldAlert, Search, User, GraduationCap, Layers, X, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Ecole {
  id: string
  nom: string
  ville: string
  statut: string
}

interface Eleve {
  id: string
  nom: string
  prenom: string
  date_naissance?: string
  classe_nom?: string
  niveau_nom?: string
  ecole_nom: string
  ecole_id: string
  created_at: string
}

export default function SuperAdminSupport() {
  const router = useRouter()
  const [ecoles, setEcoles] = useState<Ecole[]>([])
  const [selectedEcole, setSelectedEcole] = useState<Ecole | null>(null)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [supportMode, setSupportMode] = useState(false)
  const [supportReason, setSupportReason] = useState('')

  useEffect(() => {
    loadEcoles()
  }, [])

  async function loadEcoles() {
    try {
      const { data } = await supabase
        .from('ecoles')
        .select('id, nom, ville, statut')
        .order('nom')

      setEcoles(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  async function activateSupportMode(ecole: Ecole) {
    setSupportReason('')
    setSupportMode(true)
    setSelectedEcole(ecole)
    await loadEleves(ecole.id)
  }

  async function loadEleves(ecoleId: string) {
    try {
      const { data } = await (supabase.from('eleves' as any) as any)
        .select(`
          *,
          classe:classes(nom),
          niveau:niveaux(nom),
          ecole:ecoles(nom)
        `)
        .eq('ecole_id', ecoleId)
        .order('nom')

      const formattedEleves = (data || []).map((e: any) => ({
        id: e.id,
        nom: e.nom,
        prenom: e.prenom,
        date_naissance: e.date_naissance,
        classe_nom: e.classe?.nom,
        niveau_nom: e.niveau?.nom,
        ecole_nom: e.ecole?.nom,
        ecole_id: e.ecole_id,
        created_at: e.created_at
      }))

      setEleves(formattedEleves)
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    }
  }

  async function deactivateSupportMode() {
    setSupportMode(false)
    setSelectedEcole(null)
    setEleves([])
    setSupportReason('')
  }

  async function logSupportAccess() {
    if (!supportReason.trim()) {
      alert('Veuillez indiquer la raison de l\'accès support.')
      return
    }

    try {
      await (supabase.from('support_logs' as any) as any).insert({
        superadmin_id: (await supabase.auth.getUser()).data.user?.id,
        ecole_id: selectedEcole?.id,
        ecole_nom: selectedEcole?.nom,
        raison: supportReason,
        date_acces: new Date().toISOString()
      } as any)

      alert('Accès support enregistré avec succès.')
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error)
    }
  }

  const filteredEleves = eleves.filter(e =>
    e.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.prenom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.classe_nom?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return <div className="p-8 text-slate-400">Chargement...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/superadmin')}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Mode Support</h1>
          <p className="text-slate-400">Accès aux données nominatives des élèves (audit uniquement)</p>
        </div>
      </div>

      {!supportMode ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Accès Support Restreint</h2>
              <p className="text-slate-400">
                Ce mode permet d'accéder aux données nominatives des élèves d'une école spécifique.
                L'accès est enregistré et audité pour des raisons de sécurité.
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-left">
              <p className="text-amber-400 text-sm font-medium mb-2">⚠️ Conditions d'utilisation :</p>
              <ul className="text-slate-300 text-sm space-y-1">
                <li>• Uniquement pour le support technique</li>
                <li>• Toute consultation est enregistrée</li>
                <li>• L'accès est temporaire et justifié</li>
                <li>• Respect de la confidentialité des données</li>
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">Sélectionner une école</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ecoles.map((ecole) => (
                <button
                  key={ecole.id}
                  onClick={() => activateSupportMode(ecole)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{ecole.nom}</p>
                      <p className="text-sm text-slate-400">{ecole.ville}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Support Mode Header */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-amber-400 font-medium">Mode Support Actif</p>
                  <p className="text-slate-400 text-sm">
                    Consultation des données de : {selectedEcole?.nom}
                  </p>
                </div>
              </div>
              <button
                onClick={deactivateSupportMode}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <EyeOff className="w-4 h-4" />
                Désactiver
              </button>
            </div>
          </div>

          {/* Support Reason */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Raison de l'accès support (obligatoire) :
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={supportReason}
                onChange={(e) => setSupportReason(e.target.value)}
                placeholder="Ex: Problème de synchronisation des notes..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={logSupportAccess}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
              >
                Enregistrer
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher un élève..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-full"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total élèves</p>
                  <p className="text-xl font-bold text-white">{eleves.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Niveaux</p>
                  <p className="text-xl font-bold text-white">
                    {new Set(eleves.map(e => e.niveau_nom)).size}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <GraduationCap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Classes</p>
                  <p className="text-xl font-bold text-white">
                    {new Set(eleves.map(e => e.classe_nom)).size}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Eleves Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-300 font-medium">
                  <tr>
                    <th className="px-4 py-3">Élève</th>
                    <th className="px-4 py-3">Date de naissance</th>
                    <th className="px-4 py-3">Classe</th>
                    <th className="px-4 py-3">Niveau</th>
                    <th className="px-4 py-3">Date inscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredEleves.map((eleve) => (
                    <tr key={eleve.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
                            {eleve.prenom?.charAt(0)}{eleve.nom?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{eleve.prenom} {eleve.nom}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {eleve.date_naissance ? new Date(eleve.date_naissance).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{eleve.classe_nom || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">{eleve.niveau_nom || '-'}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(eleve.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-slate-800">
              {filteredEleves.map((eleve) => (
                <div key={eleve.id} className="p-4 space-y-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold">
                      {eleve.prenom?.charAt(0)}{eleve.nom?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white">{eleve.prenom} {eleve.nom}</p>
                      <p className="text-sm text-slate-400">{eleve.classe_nom || 'Non assigné'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-800/50 p-2 rounded-lg">
                      <p className="text-slate-400 text-xs">Niveau</p>
                      <p className="text-white">{eleve.niveau_nom || '-'}</p>
                    </div>
                    <div className="bg-slate-800/50 p-2 rounded-lg">
                      <p className="text-slate-400 text-xs">Date naissance</p>
                      <p className="text-white">
                        {eleve.date_naissance ? new Date(eleve.date_naissance).toLocaleDateString('fr-FR') : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredEleves.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                Aucun élève trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
