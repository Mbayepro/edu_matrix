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
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Paiements Scolaires</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium max-w-2xl tracking-tight">
            Pilotez les encaissements et le recouvrement. Le statut est synchronisé automatiquement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Flux en direct</span>
          </div>
        </div>
      </div>

      {/* KPIs Dashboard */}
      {/* KPIs Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:rotate-6 transition-all duration-500">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total élèves</p>
              <div className="text-2xl font-black text-slate-900 leading-none">{totalEleves}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 group-hover:rotate-6 transition-all duration-500">
              <TrendingDown className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total attendu</p>
              <div className="text-2xl font-black text-slate-900 leading-none">
                {totalDu.toLocaleString('fr-FR')} <span className="text-[10px] font-black ml-1 uppercase text-slate-400">F</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:rotate-6 transition-all duration-500 shadow-sm">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Encaissé</p>
              <div className="text-2xl font-black text-emerald-600 leading-none">
                {totalEncaisse.toLocaleString('fr-FR')} <span className="text-[10px] font-black ml-1 uppercase opacity-60">F</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-900/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-slate-900 flex items-center justify-center text-white rounded-2xl group-hover:rotate-6 transition-all duration-500 shadow-lg shadow-slate-900/10">
              <DollarSign className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Recouvrement</p>
              <div className="text-2xl font-black text-slate-900 leading-none">
                {tauxRecouvrement.toFixed(1)} <span className="text-[10px] font-black ml-1 uppercase text-slate-400">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 group hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Répartition des statuts
            </h3>
            <PieChart className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Dossiers soldés</span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{elevesParStatut.payé} élèves</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-3.5 p-1 border border-slate-100 shadow-inner">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-emerald-500/30" 
                  style={{ width: `${(elevesParStatut.payé / totalEleves) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Paiements partiels</span>
                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{elevesParStatut.partiel} élèves</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-3.5 p-1 border border-slate-100 shadow-inner">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-amber-500/30" 
                  style={{ width: `${(elevesParStatut.partiel / totalEleves) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Dossiers en attente</span>
                <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{elevesParStatut.impayé} élèves</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-3.5 p-1 border border-slate-100 shadow-inner">
                <div 
                  className="bg-red-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-red-500/30" 
                  style={{ width: `${(elevesParStatut.impayé / totalEleves) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 group hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Recettes Mensuelles
            </h3>
            <BarChart3 className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="space-y-3">
            {Object.entries(paiementsParMois).slice(0, 5).map(([mois, montant]) => (
              <div key={mois} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm hover:translate-x-1 transition-transform cursor-default">
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">{mois}</span>
                <span className="text-sm font-black text-slate-900">
                  {montant.toLocaleString('fr-FR')} <span className="text-[10px] text-slate-400">F</span>
                </span>
              </div>
            ))}
            {Object.entries(paiementsParMois).length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">Aucun historique mensuel</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Student Selection */}
        <div className="flex-1 space-y-4">
        {/* Left Column: Student Selection */}
        <div className="flex-1 space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un dossier élève…"
              className="w-full pl-12 pr-6 py-4.5 bg-white border border-slate-200/60 rounded-[2rem] text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            {loading || profileLoading ? (
              <div className="p-8 space-y-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEleves.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 px-10 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Users className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1 tracking-tight">Aucun résultat</h3>
                <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto">
                  Aucun élève ne correspond à votre recherche pour le moment.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 overflow-y-auto max-h-[600px] custom-scrollbar">
                {filteredEleves.map((e) => (
                  <li
                    key={e.id}
                    className={`px-8 py-5 flex items-center gap-5 cursor-pointer transition-all duration-500 relative group overflow-hidden ${
                      selectedEleve?.id === e.id ? 'bg-emerald-50/50' : 'hover:bg-slate-50/80 hover:translate-x-1'
                    }`}
                    onClick={() => setSelectedEleve(e)}
                  >
                    {selectedEleve?.id === e.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 shadow-[2px_0_10px_rgba(16,185,129,0.3)] animate-in slide-in-from-left duration-300" />
                    )}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg transition-transform duration-500 group-hover:scale-105 ${
                      selectedEleve?.id === e.id ? 'bg-emerald-600 rotate-3' : 'bg-slate-900 grayscale-[0.2] group-hover:grayscale-0'
                    }`}>
                      {e.prenom[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-base font-black truncate transition-colors uppercase tracking-tight ${selectedEleve?.id === e.id ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {e.prenom} {e.nom}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold tracking-[0.1em] uppercase mt-0.5">
                        {(e.classe as any)?.nom_classe ?? 'NON ASSIGNÉ'} · <span className="text-slate-500 font-black">{e.matricule}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg border shadow-sm ${
                        e.statut_paiement === 'payé'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : e.statut_paiement === 'partiel'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {e.statut_paiement}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </div>

        {/* Right Column: Payment Form & History */}
        <div className="w-full lg:w-[320px] space-y-4">
        {/* Right Column: Payment Form & History */}
        <div className="w-full lg:w-[380px] space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm p-8 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500/10 group-focus-within:bg-emerald-500/20 transition-all" />
            
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Nouveau Versement
            </h2>
            
            {!selectedEleve ? (
              <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 animate-in zoom-in-95 duration-500">
                <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-8 leading-relaxed">
                  Veuillez d&apos;abord sélectionner un élève dans la liste de gauche.
                </p>
              </div>
            ) : (
              <form onSubmit={enregistrerPaiement} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Frais</label>
                    <select
                      value={selectedFraisId}
                      onChange={(e) => setSelectedFraisId(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="">Sélectionner…</option>
                      {frais.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.libelle} ({f.montant.toLocaleString('fr-FR')} F)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Montant versé (F CFA)</label>
                    <input
                      type="text"
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                      placeholder="Ex: 25 000"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all placeholder:text-slate-300"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mode</label>
                      <input
                        type="text"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        placeholder="Espèces/Mobile"
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ref.</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="N° Reçu"
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-5 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white text-sm font-black tracking-widest uppercase transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {saving ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement…</>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5" /> Valider le versement</>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* History Section */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden group">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                Derniers règlements
              </h3>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {!selectedEleve ? (
                <div className="py-12 text-center opacity-30">
                  <Printer className="w-10 h-10 mx-auto mb-4 text-slate-200" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Aucune donnée</p>
                </div>
              ) : (
                paiements
                  .filter(p => p.eleve_id === selectedEleve.id)
                  .map((p) => {
                    const fLibelle = frais.find(f => f.id === p.frais_id)?.libelle || 'Scolarité'
                    return (
                      <div key={p.id} className="p-5 bg-white border border-slate-100 rounded-3xl group/item hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5 transition-all duration-300">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-lg font-black text-slate-900 leading-none">
                              {p.montant.toLocaleString('fr-FR')} <span className="text-xs uppercase text-slate-400">F</span>
                            </p>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">{fLibelle}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleDownloadReceipt(p)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Télécharger Reçu PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handlePrintReceipt(p)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                              title="Imprimer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-slate-50 mt-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(p.date_paiement).toLocaleDateString('fr-FR')}
                          </span>
                          <span className="text-[10px] font-black text-slate-300 uppercase italic">
                            {p.mode || 'N/A'}
                          </span>
                        </div>
                      </div>
                    )
                  })
              )}
              {selectedEleve && paiements.filter(p => p.eleve_id === selectedEleve.id).length === 0 && (
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 text-center py-10">Aucun historique pour cet élève</p>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

