import jsPDF from 'jspdf'
import 'jspdf-autotable'
import type { Ecole, Profile } from './supabase'

// Interface representing the payment data we need for the receipt
export interface PaiementRecuInfo {
  id: string
  date_paiement: string
  montant: number
  mode_paiement: string
  reference?: string | null
  eleve_nom: string
  eleve_prenom: string
  eleve_matricule?: string | null
  classe_nom: string
  frais_libelle: string
}

export async function generatePaiementRecuPDF(
  ecole: Ecole,
  paiement: PaiementRecuInfo,
  caissier?: Profile | null
) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Convert Supabase dates
  const datePaiement = new Date(paiement.date_paiement)
  const dateStr = datePaiement.toLocaleDateString('fr-FR')
  const timeStr = datePaiement.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // --- HEADER: School info ---
  // Try to load logo if available
  if (ecole.logo_url) {
    try {
      doc.addImage(ecole.logo_url, 'PNG', 14, 10, 24, 24)
    } catch (e) {
      console.warn('Erreur chargement logo ecole', e)
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42) // slate-900
  const titleX = ecole.logo_url ? 45 : 14
  doc.text(ecole.nom.toUpperCase(), titleX, 20)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139) // slate-500
  if (ecole.adresse) doc.text(ecole.adresse, titleX, 26)
  if (ecole.telephone) doc.text(`Tél : ${ecole.telephone}`, titleX, 31)

  // Receipt Number
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  const rectStr = `Reçu N°: REF-${paiement.id.substring(0, 8).toUpperCase()}`
  doc.text(rectStr, pageWidth - 14, 20, { align: 'right' })
  doc.text(`Date : ${dateStr} à ${timeStr}`, pageWidth - 14, 26, { align: 'right' })

  // --- LINE SEPARATOR ---
  doc.setDrawColor(226, 232, 240) // slate-200
  doc.line(14, 38, pageWidth - 14, 38)

  // --- RECEIPT TITLE ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(5, 150, 105) // emerald-600
  doc.text('REÇU DE PAIEMENT SCOLARITÉ', pageWidth / 2, 50, { align: 'center' })

  // --- ELEVE INFO ---
  doc.setFontSize(11)
  doc.setTextColor(51, 65, 85) // slate-700
  
  doc.setFont('helvetica', 'bold')
  doc.text('Informations de l\'élève', 14, 65)
  
  doc.setFont('helvetica', 'normal')
  const eleveInfos = [
    `Nom & Prénom : ${paiement.eleve_prenom} ${paiement.eleve_nom}`,
    `Classe : ${paiement.classe_nom}`,
  ]
  if (paiement.eleve_matricule) {
    eleveInfos.push(`Matricule : ${paiement.eleve_matricule}`)
  }

  eleveInfos.forEach((text, i) => {
    doc.text(text, 14, 75 + (i * 7))
  })

  // --- PAIEMENT DETAILS TABLE ---
  const tableData = [
    [
      paiement.frais_libelle, 
      paiement.mode_paiement, 
      paiement.reference || '-', 
      `${paiement.montant.toLocaleString('fr-FR')} F`
    ]
  ]

  ;(doc as any).autoTable({
    startY: 100,
    head: [['Désignation', 'Mode de paiement', 'Référence', 'Montant Payé']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: {
      font: 'helvetica',
      fontSize: 11,
      cellPadding: 6,
    },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] }, // right align amount
    }
  })

  // --- SIGNATURE AREA ---
  const finalY = (doc as any).lastAutoTable.finalY + 30
  
  doc.setFont('helvetica', 'bold')
  doc.text('La Direction', pageWidth - 50, finalY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184) // slate-400
  if (caissier) {
    doc.text(`Encaissé par : ${caissier.prenom} ${caissier.nom}`, 14, finalY)
  }

  if (ecole.tampon_url) {
    try {
      doc.addImage(ecole.tampon_url, 'PNG', pageWidth - 60, finalY + 5, 40, 40)
    } catch (e) {
      console.warn('Erreur chargement tampon', e)
    }
  }

  // --- FOOTER ---
  doc.setFontSize(8)
  doc.text('Généré par EduMatrix', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

  // Save PDF
  doc.save(`Recu_${paiement.id.substring(0, 8)}_${paiement.eleve_nom.replace(/\s+/g, '')}.pdf`)
}
