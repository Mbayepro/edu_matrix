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
  Download,
  Printer,
  Share2,
  MessageCircle,
  Mail,
  Copy,
  X,
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { generatePaiementRecuPDF, printPaiementRecuPDF, sharePaiementRecu, PaiementRecuInfo } from '@/lib/pdfRecuGenerator'
import { Skeleton } from '@/components/Skeleton'

interface EleveWithClasse extends Omit<Eleve, 'classe'> {
  classe?: { nom_classe: string }
}

export default function PaiementsPage() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

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
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ecoleId) {
      loadAllData(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadAllData(schoolId: string) {
    setLoading(true)
    try {
      await Promise.all([
        loadEleves(schoolId),
        loadFrais(schoolId),
        loadElevesFrais(schoolId),
        loadPaiements(schoolId),
      ])
    } finally {
      setLoading(false)
    }
  }

  // Re-filter eleves when search changes
  useEffect(() => {
    if (ecoleId) void loadEleves(ecoleId)
  }, [search])

  async function loadEleves(schoolId: string) {
    try {
      let query = supabase
        .from('eleves')
        .select('*, classe:classes(nom_classe)')
        .eq('ecole_id', schoolId)
        .order('nom')

      if (search.trim()) {
        query = query.or(
          `nom.ilike.%${search}%,prenom.ilike.%${search}%,matricule.ilike.%${search}%`
        )
      }

      const { data } = await query
      setEleves((data ?? []) as EleveWithClasse[])
    } catch (e) {
      console.error(e)
    }
  }

  async function loadFrais(schoolId: string) {
    const { data } = await supabase
      .from('frais_scolaires')
      .select('*')
      .eq('ecole_id', schoolId)
      .eq('is_active', true)
      .order('libelle')
    setFrais((data ?? []) as FraisScolaire[])
  }

  async function loadElevesFrais(schoolId: string) {
    const { data } = await supabase
      .from('eleves_frais')
      .select('*')
      .eq('ecole_id', schoolId)
    setElevesFrais((data ?? []) as EleveFrais[])
  }

  async function loadPaiements(schoolId: string) {
    const { data } = await supabase
      .from('paiements')
      .select('*')
      .eq('ecole_id', schoolId)
      .order('date_paiement', { ascending: false })
    setPaiements((data ?? []) as Paiement[])
  }

  async function enregistrerPaiement(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEleve || !selectedFraisId || !montant || !ecoleId) return
    setSaving(true)
    try {
      const m = Number(montant.replace(',', '.'))
      if (!Number.isFinite(m) || m <= 0) {
        showToast('Montant invalide', 'error')
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
        showToast(insertError.message, 'error')
        return
      }

      showToast('Paiement enregistré avec succès.', 'success')
      setMontant('')
      setMode('')
      setReference('')
      await loadAllData(ecoleId)
    } finally {
      setSaving(false)
    }
  }

  function buildRecuInfo(paiement: Paiement): PaiementRecuInfo | null {
    if (!ecole || !selectedEleve) return null
    const fraisDetails = frais.find(f => f.id === paiement.frais_id)
    return {
      id: paiement.id,
      date_paiement: paiement.date_paiement,
      montant: paiement.montant,
      mode_paiement: paiement.mode || 'Non spécifié',
      reference: paiement.reference,
      eleve_nom: selectedEleve.nom,
      eleve_prenom: selectedEleve.prenom,
      eleve_matricule: selectedEleve.matricule,
      classe_nom: selectedEleve.classe?.nom_classe || 'Niveau non défini',
      frais_libelle: fraisDetails?.libelle || 'Scolarité',
    }
  }

  async function handleDownloadReceipt(paiement: Paiement) {
    const info = buildRecuInfo(paiement)
    if (!info || !ecole) return
    try { await generatePaiementRecuPDF(ecole, info, profile) }
    catch { showToast('Erreur lors de la génération du reçu PDF', 'error') }
  }

  async function handlePrintReceipt(paiement: Paiement) {
    const info = buildRecuInfo(paiement)
    if (!info || !ecole) return
    try { await printPaiementRecuPDF(ecole, info, profile) }
    catch { showToast("Erreur lors de l'impression", 'error') }
  }

  function handleShare(paiement: Paiement, method: 'whatsapp' | 'email' | 'copy') {
    const info = buildRecuInfo(paiement)
    if (!info || !ecole) return
    sharePaiementRecu(info, ecole, method)
    if (method === 'copy') {
      setCopied(true)
      showToast('Texte copié dans le presse-papier !', 'success')
      setTimeout(() => setCopied(false), 2000)
    }
    setShareOpenId(null)
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
              placeholder="Rechercher un élève…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[380px] overflow-y-auto w-full">
            {loading || profileLoading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-2 w-1/3" />
                    </div>
                  </div>
                ))}
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
              </form>
            )}
          </div>

          {/* Historique des paiements de l'élève */}
          {selectedEleve && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Historique règlements
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {paiements.filter(p => p.eleve_id === selectedEleve.id).length === 0 ? (
                  <p className="text-xs text-slate-400">Aucun paiement enregistré.</p>
                ) : (
                  paiements
                    .filter(p => p.eleve_id === selectedEleve.id)
                    .map((p) => {
                      const fLibelle = frais.find(f => f.id === p.frais_id)?.libelle || 'Frais'
                      const isShareOpen = shareOpenId === p.id
                      return (
                        <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          {/* Info paiement */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800">
                                {p.montant.toLocaleString('fr-FR')} F
                              </p>
                              <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{fLibelle}</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">
                                {new Date(p.date_paiement).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => handleDownloadReceipt(p)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors"
                                title="Télécharger le reçu">
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handlePrintReceipt(p)}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Imprimer le reçu">
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setShareOpenId(isShareOpen ? null : p.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
                                title="Partager">
                                {isShareOpen ? <X className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                          {/* Share menu */}
                          {isShareOpen && (
                            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-1 flex-wrap">
                              <button onClick={() => handleShare(p, 'whatsapp')}
                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors">
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </button>
                              <button onClick={() => handleShare(p, 'email')}
                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
                                <Mail className="w-3 h-3" /> Email
                              </button>
                              <button onClick={() => handleShare(p, 'copy')}
                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
                                <Copy className="w-3 h-3" /> {copied ? 'Copié !' : 'Copier'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

