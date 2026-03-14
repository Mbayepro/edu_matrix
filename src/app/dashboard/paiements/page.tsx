'use client'

import { useEffect, useState } from 'react'
import { supabase, Eleve, FraisScolaire, EleveFrais, Paiement } from '@/lib/supabase'
import {
  Loader2,
  Search,
  CreditCard,
  Euro,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  PieChart,
  BarChart3,
} from 'lucide-react'

interface EleveWithClasse extends Omit<Eleve, 'classe'> {
  classe?: { nom_classe: string }
}

export default function PaiementsPage() {
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [eleves, setEleves] = useState<EleveWithClasse[]>([])
  const [frais, setFrais] = useState<FraisScolaire[]>([])
  const [elevesFrais, setElevesFrais] = useState<EleveFrais[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedEleve, setSelectedEleve] = useState<EleveWithClasse | null>(null)
  const [selectedFraisId, setSelectedFraisId] = useState<string>('')
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (ecoleId) {
      void loadEleves()
      void loadFrais()
      void loadElevesFrais()
      void loadPaiements()
    }
  }, [ecoleId])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase
      .from('profiles')
      .select('ecole_id')
      .eq('user_id', user.id)
      .single()
    if (!prof?.ecole_id) return
    setEcoleId(prof.ecole_id)
  }

  async function loadEleves() {
    if (!ecoleId) return
    setLoading(true)
    try {
      let query = supabase
        .from('eleves')
        .select('*, classe:classes(nom_classe)')
        .eq('ecole_id', ecoleId)
        .order('nom')

      if (search.trim()) {
        query = query.or(
          `nom.ilike.%${search}%,prenom.ilike.%${search}%,matricule.ilike.%${search}%`
        )
      }

      const { data } = await query
      setEleves((data ?? []) as EleveWithClasse[])
    } finally {
      setLoading(false)
    }
  }

  async function loadFrais() {
    if (!ecoleId) return
    const { data } = await supabase
      .from('frais_scolaires')
      .select('*')
      .eq('ecole_id', ecoleId)
      .eq('is_active', true)
      .order('libelle')
    setFrais((data ?? []) as FraisScolaire[])
  }

  async function loadElevesFrais() {
    if (!ecoleId) return
    const { data } = await supabase
      .from('eleves_frais')
      .select('*')
      .eq('ecole_id', ecoleId)
    setElevesFrais((data ?? []) as EleveFrais[])
  }

  async function loadPaiements() {
    if (!ecoleId) return
    const { data } = await supabase
      .from('paiements')
      .select('*')
      .eq('ecole_id', ecoleId)
      .order('date_paiement', { ascending: false })
    setPaiements((data ?? []) as Paiement[])
  }

  async function enregistrerPaiement(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEleve || !selectedFraisId || !montant || !ecoleId) return
    setSaving(true)
    setMessage(null)
    try {
      const m = Number(montant.replace(',', '.'))
      if (!Number.isFinite(m) || m <= 0) {
        setMessage('Montant invalide')
        return
      }

      const { error: insertError } = await supabase
        .from('paiements')
        .insert({
          ecole_id: ecoleId,
          eleve_id: selectedEleve.id,
          frais_id: selectedFraisId,
          montant: m,
          mode: mode || null,
          reference: reference || null,
        })

      if (insertError) {
        setMessage(insertError.message)
        return
      }

      setMessage('Paiement enregistré avec succès.')
      setMontant('')
      setMode('')
      setReference('')
      await loadEleves()
    } finally {
      setSaving(false)
    }
  }

  const filteredEleves = eleves

  // Calculate KPIs
  const totalEleves = eleves.length
  const totalDu = elevesFrais.reduce((sum, ef) => sum + ef.montant_a_payer, 0)
  const totalEncaisse = paiements.reduce((sum, p) => sum + p.montant, 0)
  const totalRestant = totalDu - totalEncaisse
  const tauxRecouvrement = totalDu > 0 ? (totalEncaisse / totalDu) * 100 : 0

  const elevesParStatut = {
    payé: eleves.filter(e => e.statut_paiement === 'payé').length,
    partiel: eleves.filter(e => e.statut_paiement === 'partiel').length,
    impayé: eleves.filter(e => e.statut_paiement === 'impayé').length,
  }

  // Monthly payments data for chart
  const paiementsParMois = paiements.reduce((acc, paiement) => {
    const mois = new Date(paiement.date_paiement).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!acc[mois]) acc[mois] = 0
    acc[mois] += paiement.montant
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-emerald-600" />
        <h1 className="text-lg font-bold text-slate-800">Paiements scolaires</h1>
      </div>
      <p className="text-sm text-slate-500">
        Enregistrez les règlements des frais pour chaque élève. Le statut « payé / partiel / impayé » est mis à jour automatiquement.
      </p>

      {/* KPIs Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Total élèves</div>
              <div className="text-xl font-bold text-slate-800">{totalEleves}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Montant total dû</div>
              <div className="text-xl font-bold text-slate-800">
                {totalDu.toLocaleString('fr-FR')} F
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Montant encaissé</div>
              <div className="text-xl font-bold text-slate-800">
                {totalEncaisse.toLocaleString('fr-FR')} F
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Taux recouvrement</div>
              <div className="text-xl font-bold text-slate-800">
                {tauxRecouvrement.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-slate-400" />
            Répartition des statuts
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Payés</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-emerald-600 h-2 rounded-full" 
                    style={{ width: `${(elevesParStatut.payé / totalEleves) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-emerald-600">
                  {elevesParStatut.payé}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Partiels</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-amber-600 h-2 rounded-full" 
                    style={{ width: `${(elevesParStatut.partiel / totalEleves) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-amber-600">
                  {elevesParStatut.partiel}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Impayés</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full" 
                    style={{ width: `${(elevesParStatut.impayé / totalEleves) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-red-600">
                  {elevesParStatut.impayé}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            Encaissements par mois
          </h3>
          <div className="space-y-2">
            {Object.entries(paiementsParMois).slice(0, 6).map(([mois, montant]) => (
              <div key={mois} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{mois}</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {montant.toLocaleString('fr-FR')} F
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => loadEleves()}
              placeholder="Rechercher un élève…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Chargement des élèves…
              </div>
            ) : filteredEleves.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                Aucun élève trouvé.
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {filteredEleves.map((e) => (
                  <li
                    key={e.id}
                    className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50 ${
                      selectedEleve?.id === e.id ? 'bg-emerald-50/60' : ''
                    }`}
                    onClick={() => setSelectedEleve(e)}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                      {e.prenom[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {e.prenom} {e.nom}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {(e.classe as any)?.nom_classe ?? '—'} · {e.matricule}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                      e.statut_paiement === 'payé'
                        ? 'bg-emerald-100 text-emerald-700'
                        : e.statut_paiement === 'partiel'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {e.statut_paiement}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="w-full md:w-[260px] space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Euro className="w-4 h-4 text-emerald-600" />
              Paiement rapide
            </h2>
            {!selectedEleve ? (
              <p className="text-xs text-slate-400">
                Sélectionnez d&apos;abord un élève dans la liste pour enregistrer un paiement.
              </p>
            ) : frais.length === 0 ? (
              <p className="text-xs text-amber-600">
                Aucun frais configuré pour cette école. Ajoutez des frais dans les paramètres ou en base (table <code>frais_scolaires</code>).
              </p>
            ) : (
              <form onSubmit={enregistrerPaiement} className="space-y-3">
                <div className="text-xs text-slate-500">
                  Élève sélectionné :
                  <br />
                  <span className="font-semibold text-slate-800">
                    {selectedEleve.prenom} {selectedEleve.nom}
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Frais
                  </label>
                  <select
                    value={selectedFraisId}
                    onChange={(e) => setSelectedFraisId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="">Choisir un frais…</option>
                    {frais.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.libelle} — {f.montant.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Montant réglé (F CFA)
                  </label>
                  <input
                    type="text"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Mode
                    </label>
                    <input
                      type="text"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      placeholder="Espèces, OM, Wave…"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Référence
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="N° reçu"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Enregistrer le paiement
                    </>
                  )}
                </button>
                {message && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

