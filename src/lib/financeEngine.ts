// src/lib/financeEngine.ts
// Moteur de logique métier pour le module Finance Scolaire
// FIFO credit allocation, bilan comptable, PDF batch

import type { Depense, PaiementStaff, EleveFrais, Paiement, FraisScolaire } from './supabase'

export const SCHOOL_MONTHS = ['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet']

export const CATEGORIES_DEPENSES: Record<string, { label: string; emoji: string; color: string }> = {
  loyer:          { label: 'Loyer',          emoji: '🏠', color: 'text-orange-400' },
  electricite:    { label: 'Électricité',    emoji: '⚡', color: 'text-yellow-400' },
  eau:            { label: 'Eau',            emoji: '💧', color: 'text-blue-400' },
  fournitures:    { label: 'Fournitures',    emoji: '📦', color: 'text-purple-400' },
  materiel:       { label: 'Matériel',       emoji: '🖥️', color: 'text-cyan-400' },
  entretien:      { label: 'Entretien',      emoji: '🔧', color: 'text-gray-400' },
  communication:  { label: 'Communication', emoji: '📡', color: 'text-pink-400' },
  transport:      { label: 'Transport',      emoji: '🚌', color: 'text-indigo-400' },
  autre:          { label: 'Autre',          emoji: '📌', color: 'text-slate-400' },
}

// ────────────────────────────────────────────────────────────
// ALLOCATION FIFO avec report de crédit
// ────────────────────────────────────────────────────────────

export interface AllocationResult {
  /** Montant réellement affecté à la dette en cours */
  montantAffecte: number
  /** Surplus crédité pour les prochains mois */
  credit: number
  /** Nouveau solde restant après ce paiement */
  nouveauReste: number
}

/**
 * Alloue un paiement selon la logique FIFO :
 * - Si montant > dette → reste = crédit pour le mois suivant
 * - Si montant <= dette → on réduit simplement la dette
 */
export function allocatePayment(
  montantVerse: number,
  detteActuelle: number,
  creditExistant: number = 0
): AllocationResult {
  // D'abord on utilise le crédit existant s'il y en a
  const montantEffectif = montantVerse + creditExistant
  
  if (montantEffectif >= detteActuelle) {
    const credit = montantEffectif - detteActuelle
    return {
      montantAffecte: detteActuelle,
      credit,
      nouveauReste: 0,
    }
  }
  
  return {
    montantAffecte: montantEffectif,
    credit: 0,
    nouveauReste: detteActuelle - montantEffectif,
  }
}

// ────────────────────────────────────────────────────────────
// DISTRIBUTION DES MENSUALITÉS (AVANCES / PARTIELS)
// ────────────────────────────────────────────────────────────

export interface MensualiteStatus {
  mois: string
  montantDu: number
  montantPaye: number
  resteAPayer: number
  statut: 'payé' | 'partiel' | 'impayé'
}

export interface DistributionMensuelle {
  mensualites: MensualiteStatus[]
  totalAvance: number
  totalArrieres: number
}

/**
 * Retourne la liste des mois scolaires écoulés jusqu'à présent
 */
export function getMoisEcoules(): string[] {
  const now = new Date()
  let monthIndex = now.getMonth() // 0 = Jan, 8 = Sep, 9 = Oct
  
  // Si on est entre août et septembre, aucun mois scolaire n'est écoulé
  if (monthIndex === 7 || monthIndex === 8) return []
  
  // Mapping index JS vers notre liste SCHOOL_MONTHS (Octobre = 0)
  let schoolMonthIndex = 0
  if (monthIndex >= 9) { // Oct (9) à Dec (11)
    schoolMonthIndex = monthIndex - 9
  } else { // Jan (0) à Jul (6)
    schoolMonthIndex = monthIndex + 3
  }
  
  return SCHOOL_MONTHS.slice(0, schoolMonthIndex + 1)
}

/**
 * Distribue le montant total versé sur les mois scolaires.
 * Gère les avances, les paiements partiels, et les arriérés.
 */
export function distributeMensualites(
  totalVerse: number,
  montantMensuel: number
): DistributionMensuelle {
  let restant = totalVerse
  const mensualites: MensualiteStatus[] = []
  let totalArrieres = 0
  
  const moisEcoules = getMoisEcoules()

  for (const mois of SCHOOL_MONTHS) {
    let payePourCeMois = 0
    let statut: 'payé' | 'partiel' | 'impayé' = 'impayé'
    let reste = montantMensuel

    if (restant >= montantMensuel) {
      payePourCeMois = montantMensuel
      statut = 'payé'
      reste = 0
      restant -= montantMensuel
    } else if (restant > 0) {
      payePourCeMois = restant
      statut = 'partiel'
      reste = montantMensuel - restant
      restant = 0
    }

    mensualites.push({
      mois,
      montantDu: montantMensuel,
      montantPaye: payePourCeMois,
      resteAPayer: reste,
      statut
    })

    // Si le mois est déjà passé et qu'il reste à payer, c'est un arriéré
    if (moisEcoules.includes(mois) && reste > 0) {
      totalArrieres += reste
    }
  }

  // Si l'élève a payé pour des mois non encore écoulés (mais pas plus que l'année)
  // Ou s'il a payé plus que le total de l'année (restant > 0)
  // L'avance totale est le total payé pour les mois futurs + le surplus global
  const totalPayeMoisFuturs = mensualites
    .filter(m => !moisEcoules.includes(m.mois))
    .reduce((sum, m) => sum + m.montantPaye, 0)

  return {
    mensualites,
    totalAvance: totalPayeMoisFuturs + restant,
    totalArrieres
  }
}


// ────────────────────────────────────────────────────────────
// BILAN COMPTABLE
// ────────────────────────────────────────────────────────────

export interface BilanPeriode {
  label: string
  entrees: number
  sorties: number
  solde: number
}

export interface BilanData {
  totalEntrees: number
  totalSorties: number
  soldeNet: number
  parMois: BilanPeriode[]
  parCategorie: Record<string, number>
}

/**
 * Calcule le bilan financier complet sur une période donnée
 */
export function computeBilan(
  paiements: Paiement[],
  depenses: Depense[],
  paiementsStaff: PaiementStaff[],
  annee_scolaire?: string
): BilanData {
  // Filtrer par année scolaire si spécifié
  const filteredPaiements = paiements // Les paiements élèves = entrées
  const filteredDepenses = annee_scolaire
    ? depenses.filter(d => {
        const year = new Date(d.date_depense).getFullYear()
        const [startYear] = annee_scolaire.split('-').map(Number)
        return year === startYear || year === startYear + 1
      })
    : depenses
  const filteredStaff = annee_scolaire
    ? paiementsStaff.filter(p => p.annee_scolaire === annee_scolaire)
    : paiementsStaff

  const totalEntrees = filteredPaiements.reduce((s, p) => s + Number(p.montant), 0)
  const totalDepenses = filteredDepenses
    .filter(d => !d.deleted_at)
    .reduce((s, d) => s + Number(d.montant), 0)
  const totalSalaires = filteredStaff.reduce((s, p) => s + Number(p.montant), 0)
  const totalSorties = totalDepenses + totalSalaires
  
  // Calcul par mois (pour le graphique)
  const parMoisMap: Record<string, BilanPeriode> = {}
  
  filteredPaiements.forEach(p => {
    const mois = new Date(p.date_paiement).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!parMoisMap[mois]) parMoisMap[mois] = { label: mois, entrees: 0, sorties: 0, solde: 0 }
    parMoisMap[mois].entrees += Number(p.montant)
  })
  
  filteredDepenses.filter(d => !d.deleted_at).forEach(d => {
    const mois = new Date(d.date_depense).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!parMoisMap[mois]) parMoisMap[mois] = { label: mois, entrees: 0, sorties: 0, solde: 0 }
    parMoisMap[mois].sorties += Number(d.montant)
  })
  
  filteredStaff.forEach(p => {
    const mois = new Date(p.date_paiement).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!parMoisMap[mois]) parMoisMap[mois] = { label: mois, entrees: 0, sorties: 0, solde: 0 }
    parMoisMap[mois].sorties += Number(p.montant)
  })
  
  const parMois = Object.values(parMoisMap)
    .map(m => ({ ...m, solde: m.entrees - m.sorties }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr-FR'))
  
  // Répartition des dépenses par catégorie
  const parCategorie: Record<string, number> = {}
  filteredDepenses.filter(d => !d.deleted_at).forEach(d => {
    parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + Number(d.montant)
  })
  parCategorie['salaires'] = totalSalaires

  return {
    totalEntrees,
    totalSorties,
    soldeNet: totalEntrees - totalSorties,
    parMois,
    parCategorie,
  }
}

// ────────────────────────────────────────────────────────────
// CALCULS ÉLÈVE
// ────────────────────────────────────────────────────────────

export interface EleveFinanceInfo {
  id: string
  totalDu: number
  totalPaye: number
  soldeCredit: number
  reste: number
  statut: 'payé' | 'partiel' | 'impayé'
  tauxRecouvrement: number
}

export function calcEleveFinance(
  eleveId: string,
  elevesFrais: EleveFrais[],
  paiements: Paiement[]
): EleveFinanceInfo {
  const efs = elevesFrais.filter(ef => ef.eleve_id === eleveId)
  const ps = paiements.filter(p => p.eleve_id === eleveId)
  
  const totalDu = efs.reduce((s, ef) => s + (Number(ef.montant_a_payer) || 0), 0)
  const totalPaye = ps.reduce((s, p) => s + Number(p.montant), 0)
  const soldeCredit = efs.reduce((s, ef) => s + (Number(ef.solde_credit) || 0), 0)
  const reste = Math.max(0, totalDu - totalPaye - soldeCredit)
  
  let statut: 'payé' | 'partiel' | 'impayé' = 'impayé'
  if (totalDu === 0 || totalPaye + soldeCredit >= totalDu) statut = 'payé'
  else if (totalPaye > 0) statut = 'partiel'
  
  return {
    id: eleveId,
    totalDu,
    totalPaye,
    soldeCredit,
    reste,
    statut,
    tauxRecouvrement: totalDu > 0 ? Math.min(100, (totalPaye / totalDu) * 100) : 100,
  }
}

// ────────────────────────────────────────────────────────────
// UTILITAIRES
// ────────────────────────────────────────────────────────────

export function formatMontantCFA(montant: number): string {
  return montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' F CFA'
}

export function getCurrentAnnéeScolaire(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

export function buildWhatsAppMessage(
  eleveNom: string,
  elevePrenom: string,
  classeNom: string,
  ecoleNom: string,
  montant: number,
  fraisLibelle: string,
  mois?: string | null,
  reference?: string | null
): string {
  const montantStr = formatMontantCFA(montant)
  const ref = reference ? `\n📋 Réf : ${reference}` : ''
  const moisStr = mois ? ` — ${mois}` : ''
  
  return (
    `✅ *Reçu de paiement — ${ecoleNom}*\n` +
    `👤 Élève : ${elevePrenom} ${eleveNom} (${classeNom})\n` +
    `💰 Montant : ${montantStr}\n` +
    `📚 Motif : ${fraisLibelle}${moisStr}${ref}\n` +
    `📅 Date : ${new Date().toLocaleDateString('fr-FR')}\n\n` +
    `_Merci de conserver ce message comme reçu de paiement._`
  )
}
