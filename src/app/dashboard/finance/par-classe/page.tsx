'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { buildWhatsAppMessage, formatMontantCFA, distributeMensualites, SCHOOL_MONTHS, DistributionMensuelle } from '@/lib/financeEngine'
import { generatePaiementRecuPDF, printPaiementRecuPDF } from '@/lib/pdfRecuGenerator'
import type { Eleve, Classe, EleveFrais, Paiement, FraisScolaire } from '@/lib/supabase'
import {
  Search,
  Users,
  Filter,
  Printer,
  MessageCircle,
  Download,
  CheckSquare,
  Square,
  Loader2,
  ChevronDown,
  TrendingUp,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react'
import React, { Fragment } from 'react'

interface EleveRow {
  eleve: Eleve & { classe?: Classe }
  totalDu: number
  totalPaye: number
  reste: number
  statut: 'payé' | 'partiel' | 'impayé'
  dernierPaiement: Paiement | null
  mensualitesData?: DistributionMensuelle | null
}

export default function ParClassePage() {
  const { profile, ecole } = useProfile()
  const { showToast } = useToast()
  const ecoleId = profile?.ecole_id

  const [classes, setClasses] = useState<Classe[]>([])
  const [eleves, setEleves] = useState<(Eleve & { classe?: Classe })[]>([])
  const [elevesFrais, setElevesFrais] = useState<EleveFrais[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [frais, setFrais] = useState<FraisScolaire[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClasseId, setSelectedClasseId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterStatut, setFilterStatut] = useState<'all' | 'payé' | 'partiel' | 'impayé'>('all')
  const [printing, setPrinting] = useState(false)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  useEffect(() => {
    if (ecoleId) loadAll(ecoleId)
  }, [ecoleId])

  async function loadAll(id: string) {
    setLoading(true)
    try {
      if (!db) return
      const [cls, el, ef, p, fr] = await Promise.all([
        db.table('classes').where('ecole_id').equals(id).toArray(),
        db.table('eleves').where('ecole_id').equals(id).toArray(),
        db.table('eleves_frais').where('ecole_id').equals(id).toArray(),
        db.table('paiements').where('ecole_id').equals(id).toArray(),
        db.table('frais_scolaires').where('ecole_id').equals(id).toArray(),
      ])
      
      const sortedClasses = cls.sort((a, b) => a.nom_classe.localeCompare(b.nom_classe))
      const sortedEleves = el.sort((a, b) => a.nom.localeCompare(b.nom))
      const elevesWithClasse = sortedEleves.map(e => ({
        ...e,
        classe: cls.find(c => c.id === e.classe_id)
      }))

      setClasses(sortedClasses as any)
      setEleves(elevesWithClasse as any)
      setElevesFrais(ef as any)
      setPaiements(p.sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime()) as any)
      setFrais(fr as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const balancesMap = useMemo(() => {
    const map = new Map<string, { du: number; paye: number; reste: number }>()

    const SCHOOL_MONTHS = ['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet']
    const currentMonthStr = new Date().toLocaleString('fr-FR', { month: 'long' }).toLowerCase()
    const currentIndex = SCHOOL_MONTHS.findIndex(m => m.toLowerCase() === currentMonthStr)
    const monthsDue = currentIndex >= 0 ? currentIndex + 1 : 0

    eleves.forEach(e => map.set(e.id, { du: 0, paye: 0, reste: 0 }))

    elevesFrais.forEach(ef => {
      const current = map.get(ef.eleve_id) || { du: 0, paye: 0, reste: 0 }
      const f = frais.find(fr => fr.id === ef.frais_id)
      let multiplier = 1
      if (f) {
        const lib = (f.libelle || '').toLowerCase()
        if (f.frequence === 'mensuel' || lib.includes('mensu') || lib.includes('scolarit')) {
           multiplier = monthsDue
        }
      }
      const aPayer = (Number(ef.montant_a_payer) || (Number(ef.montant_du) - (Number(ef.montant_remise) || 0)) || 0) * multiplier
      const newDu = current.du + aPayer
      map.set(ef.eleve_id, { ...current, du: newDu, reste: newDu - current.paye })
    })

    paiements.forEach(p => {
      const current = map.get(p.eleve_id) || { du: 0, paye: 0, reste: 0 }
      const newPaye = current.paye + (Number(p.montant) || 0)
      map.set(p.eleve_id, { ...current, paye: newPaye, reste: current.du - newPaye })
    })

    return map
  }, [eleves, elevesFrais, paiements, frais])

  const rows = useMemo((): EleveRow[] => {
    return eleves
      .filter(e => selectedClasseId === 'all' || e.classe_id === selectedClasseId)
      .filter(e => {
        if (!search.trim()) return true
        const s = search.toLowerCase()
        return e.nom.toLowerCase().includes(s) || e.prenom.toLowerCase().includes(s)
      })
      .map(e => {
        const ps = paiements.filter(p => p.eleve_id === e.id)
        const bal = balancesMap.get(e.id) || { du: 0, paye: 0, reste: 0 }
        const totalDu = bal.du
        const totalPaye = bal.paye
        const reste = Math.max(0, bal.reste)
        
        let statut: 'payé' | 'partiel' | 'impayé' = 'impayé'
        if (totalDu === 0 || totalPaye >= totalDu) statut = 'payé'
        else if (totalPaye > 0) statut = 'partiel'
        
        const dernierPaiement = ps[0] || null

        // Trouver le tarif mensuel (scolarité)
        const fraisMensuel = frais.find(f => f.frequence === 'mensuel' || f.libelle?.toLowerCase().includes('scolar'))
        let mensualitesData = null
        if (fraisMensuel) {
          const totalPayeScolarite = ps.filter(p => p.frais_id === fraisMensuel.id).reduce((s, p) => s + Number(p.montant), 0)
          mensualitesData = distributeMensualites(totalPayeScolarite, fraisMensuel.montant)
        }

        return { eleve: e, totalDu, totalPaye, reste, statut, dernierPaiement, mensualitesData }
      })
      .filter(r => filterStatut === 'all' || r.statut === filterStatut)
  }, [eleves, paiements, selectedClasseId, search, filterStatut, frais, balancesMap])

  const selectedRows = rows.filter(r => selectedIds.has(r.eleve.id))
  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.eleve.id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map(r => r.eleve.id)))
    }
  }

  // Impression en masse
  async function handleBulkPrint() {
    if (selectedRows.length === 0 || !ecole) return
    setPrinting(true)
    try {
      const paiementsToPrint = selectedRows
        .filter(row => row.dernierPaiement)
        .map(row => {
          const fraisDetails = frais.find(f => f.id === row.dernierPaiement!.frais_id)
          return {
            id: row.dernierPaiement!.id,
            date_paiement: row.dernierPaiement!.date_paiement,
            montant: row.dernierPaiement!.montant,
            mode_paiement: row.dernierPaiement!.mode || 'Espèces',
            reference: row.dernierPaiement!.reference,
            eleve_nom: row.eleve.nom,
            eleve_prenom: row.eleve.prenom,
            eleve_matricule: row.eleve.matricule,
            classe_nom: (row.eleve as any).classe?.nom_classe || '—',
            frais_libelle: fraisDetails?.libelle || 'Scolarité',
          }
        })
      
      if (paiementsToPrint.length > 0) {
        const { printBulkPaiementsRecusPDF } = await import('@/lib/pdfRecuGenerator')
        await printBulkPaiementsRecusPDF(ecole, paiementsToPrint, profile)
        showToast(`${paiementsToPrint.length} reçu(s) ouverts pour impression`, 'success')
      }
    } catch (e) {
      showToast("Erreur lors de l'impression en masse", 'error')
    } finally {
      setPrinting(false)
    }
  }

  // Téléchargement en masse
  async function handleBulkDownload() {
    if (selectedRows.length === 0 || !ecole) return
    setPrinting(true)
    try {
      const paiementsToPrint = selectedRows
        .filter(row => row.dernierPaiement)
        .map(row => {
          const fraisDetails = frais.find(f => f.id === row.dernierPaiement!.frais_id)
          return {
            id: row.dernierPaiement!.id,
            date_paiement: row.dernierPaiement!.date_paiement,
            montant: row.dernierPaiement!.montant,
            mode_paiement: row.dernierPaiement!.mode || 'Espèces',
            reference: row.dernierPaiement!.reference,
            eleve_nom: row.eleve.nom,
            eleve_prenom: row.eleve.prenom,
            eleve_matricule: row.eleve.matricule,
            classe_nom: (row.eleve as any).classe?.nom_classe || '—',
            frais_libelle: fraisDetails?.libelle || 'Scolarité',
          }
        })

      if (paiementsToPrint.length > 0) {
        const { generateBulkPaiementsRecusPDF } = await import('@/lib/pdfRecuGenerator')
        await generateBulkPaiementsRecusPDF(ecole, paiementsToPrint, profile)
        showToast(`Fichier contenant ${paiementsToPrint.length} reçu(s) téléchargé`, 'success')
      }
    } catch (e) {
      showToast('Erreur lors du téléchargement', 'error')
    } finally {
      setPrinting(false)
    }
  }

  // WhatsApp en masse
  function handleBulkWhatsApp() {
    if (selectedRows.length === 0 || !ecole) return
    const rowsWithPhone = selectedRows.filter(r => r.eleve.telephone_parent)
    if (rowsWithPhone.length === 0) {
      showToast('Aucun élève sélectionné n\'a de numéro de téléphone', 'error')
      return
    }
    
    rowsWithPhone.forEach((row, i) => {
      const fraisDetails = row.dernierPaiement
        ? frais.find(f => f.id === row.dernierPaiement!.frais_id)
        : null

      const message = row.dernierPaiement
        ? buildWhatsAppMessage(
            row.eleve.nom,
            row.eleve.prenom,
            (row.eleve as any).classe?.nom_classe || '—',
            ecole.nom,
            row.dernierPaiement.montant,
            fraisDetails?.libelle || 'Scolarité',
            (row.dernierPaiement as any).mois,
            row.dernierPaiement.reference
          )
        : `Bonjour, rappel de paiement pour ${row.eleve.prenom} ${row.eleve.nom} — Reste à payer : ${formatMontantCFA(row.reste)} — ${ecole.nom}`

      const phone = row.eleve.telephone_parent!.replace(/\s+/g, '').replace('+', '')
      setTimeout(() => {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
      }, i * 800)
    })
    showToast(`${rowsWithPhone.length} message(s) WhatsApp ouverts`, 'success')
  }

  const stats = {
    total: rows.length,
    payes: rows.filter(r => r.statut === 'payé').length,
    partiels: rows.filter(r => r.statut === 'partiel').length,
    impayes: rows.filter(r => r.statut === 'impayé').length,
    totalDu: rows.reduce((s, r) => s + r.totalDu, 0),
    totalPaye: rows.reduce((s, r) => s + r.totalPaye, 0),
    totalReste: rows.reduce((s, r) => s + r.reste, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-black text-white">Vue par classe</h1>
          </div>
          <p className="text-sm text-slate-400 font-medium">Gérez les paiements par classe, imprimez et envoyez en masse</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        {/* Sélecteur classe */}
        <div className="relative">
          <select
            value={selectedClasseId}
            onChange={e => setSelectedClasseId(e.target.value)}
            className="pl-4 pr-10 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-white focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer"
          >
            <option value="all">Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.nom_classe}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Filtre statut */}
        <div className="flex items-center gap-1 bg-slate-900 border border-white/5 rounded-xl p-1">
          {(['all', 'payé', 'partiel', 'impayé'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                filterStatut === s
                  ? s === 'all' ? 'bg-white/10 text-white'
                    : s === 'payé' ? 'bg-emerald-500/15 text-emerald-400'
                    : s === 'partiel' ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-rose-500/15 text-rose-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s === 'all' ? 'Tous' : s}
              {s !== 'all' && (
                <span className="ml-1">
                  ({s === 'payé' ? stats.payes : s === 'partiel' ? stats.partiels : stats.impayes})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un élève…"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Résumé mini */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-emerald-400">{formatMontantCFA(stats.totalPaye)}</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Encaissé</p>
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-rose-400">{formatMontantCFA(stats.totalReste)}</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Reste</p>
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-xl p-3 text-center">
          <p className="text-lg font-black text-white">{stats.total}</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Élèves</p>
        </div>
      </div>

      {/* Toolbar sélection */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
          <span className="text-sm font-black text-blue-400">{selectedIds.size} sélectionné(s)</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleBulkDownload}
              disabled={printing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50"
            >
              {printing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Télécharger reçus
            </button>
            <button
              onClick={handleBulkPrint}
              disabled={printing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-600 transition-all disabled:opacity-50"
            >
              {printing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
              Imprimer
            </button>
            <button
              onClick={handleBulkWhatsApp}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-500 transition-all"
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-x-auto overflow-y-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="p-4 text-left">
                  <button onClick={toggleAll} className="flex items-center">
                    {allSelected
                      ? <CheckSquare className="w-4 h-4 text-blue-400" />
                      : <Square className="w-4 h-4 text-slate-500" />
                    }
                  </button>
                </th>
                <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Élève</th>
                <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Classe</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Total dû</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Payé</th>
                <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Reste</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</th>
                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Aucun élève trouvé</p>
                  </td>
                </tr>
              )}
              {rows.map(({ eleve, totalDu, totalPaye, reste, statut, dernierPaiement, mensualitesData }) => (
                <Fragment key={eleve.id}>
                  <tr
                    className={`border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer ${selectedIds.has(eleve.id) ? 'bg-blue-500/5' : ''}`}
                    onClick={() => setExpandedRowId(expandedRowId === eleve.id ? null : eleve.id)}
                  >
                    <td className="p-4" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(eleve.id)}>
                        {selectedIds.has(eleve.id)
                          ? <CheckSquare className="w-4 h-4 text-blue-400" />
                          : <Square className="w-4 h-4 text-slate-500" />
                        }
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${expandedRowId === eleve.id ? 'rotate-90 text-blue-400' : ''}`} />
                        <div>
                          <p className="text-sm font-black text-white">{eleve.prenom} {eleve.nom}</p>
                          {eleve.matricule && <p className="text-[10px] text-slate-500">{eleve.matricule}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-300">{(eleve as any).classe?.nom_classe || '—'}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs font-bold text-slate-300">{totalDu.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs font-bold text-emerald-400">{totalPaye.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`text-xs font-bold ${reste > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                        {reste > 0 ? `${reste.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F` : '—'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        statut === 'payé' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : statut === 'partiel' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {statut === 'payé' ? <CheckCircle2 className="w-3 h-3" />
                          : statut === 'partiel' ? <Clock className="w-3 h-3" />
                          : <AlertCircle className="w-3 h-3" />
                        }
                        {statut}
                      </span>
                    </td>
                    <td className="p-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        {/* Télécharger reçu */}
                        {dernierPaiement && ecole && (
                          <button
                            onClick={async () => {
                              const fraisDetails = frais.find(f => f.id === dernierPaiement.frais_id)
                              await generatePaiementRecuPDF(ecole, {
                                id: dernierPaiement.id,
                                date_paiement: dernierPaiement.date_paiement,
                                montant: dernierPaiement.montant,
                                mode_paiement: dernierPaiement.mode || 'Espèces',
                                reference: dernierPaiement.reference,
                                eleve_nom: eleve.nom,
                                eleve_prenom: eleve.prenom,
                                eleve_matricule: eleve.matricule,
                                classe_nom: (eleve as any).classe?.nom_classe || '—',
                                frais_libelle: fraisDetails?.libelle || 'Scolarité',
                              }, profile)
                            }}
                            title="Télécharger le reçu PDF"
                            className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* WhatsApp individuel */}
                        {eleve.telephone_parent && (
                          <button
                            onClick={() => {
                              const fraisDetails = dernierPaiement ? frais.find(f => f.id === dernierPaiement.frais_id) : null
                              const message = dernierPaiement
                                ? buildWhatsAppMessage(
                                    eleve.nom, eleve.prenom,
                                    (eleve as any).classe?.nom_classe || '—',
                                    ecole!.nom, dernierPaiement.montant,
                                    fraisDetails?.libelle || 'Scolarité',
                                    (dernierPaiement as any).mois,
                                    dernierPaiement.reference
                                  )
                                : `Rappel de paiement — ${eleve.prenom} ${eleve.nom} — Reste : ${formatMontantCFA(reste)} — ${ecole?.nom}`
                              const phone = eleve.telephone_parent!.replace(/\s+/g, '').replace('+', '')
                              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
                            }}
                            title="Envoyer sur WhatsApp"
                            className="w-7 h-7 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center transition-all"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Ligne extensible : Détail des mensualités */}
                  {expandedRowId === eleve.id && mensualitesData && (
                    <tr className="bg-slate-900/50 border-b border-white/5">
                      <td colSpan={8} className="p-6">
                        <div className="max-w-4xl mx-auto space-y-4">
                          
                          {/* En-tête des détails */}
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              Détail des mensualités (Scolarité)
                            </h4>
                            <div className="flex gap-4">
                              {mensualitesData.totalArrieres > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black tracking-widest uppercase">
                                  Arriérés : {mensualitesData.totalArrieres.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                                </span>
                              )}
                              {mensualitesData.totalAvance > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-widest uppercase">
                                  Avance disponible : {mensualitesData.totalAvance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Grille des mois */}
                          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                            {mensualitesData.mensualites.map((m) => (
                              <div
                                key={m.mois}
                                className={`p-2 rounded-xl text-center flex flex-col items-center justify-center gap-1 border border-white/5 ${
                                  m.statut === 'payé' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                  m.statut === 'partiel' ? 'bg-amber-500/10 border-amber-500/30' :
                                  'bg-slate-800 border-white/5'
                                }`}
                              >
                                <span className="text-[10px] font-bold text-slate-400 capitalize">{m.mois.substring(0,3)}.</span>
                                {m.statut === 'payé' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                {m.statut === 'partiel' && (
                                  <div className="text-[9px] font-black text-amber-400 mt-1">
                                    {m.montantPaye.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                                    <div className="opacity-50 border-t border-amber-500/30 mt-0.5 pt-0.5">{m.montantDu.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}</div>
                                  </div>
                                )}
                                {m.statut === 'impayé' && <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
