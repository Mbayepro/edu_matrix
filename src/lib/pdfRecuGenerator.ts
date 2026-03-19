import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

/** Helper pour charger une image distante en base64 pour jsPDF */
async function getImageData(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error('Erreur lors du chargement de l\'image:', url, err)
    return null
  }
}

/** Construit le document jsPDF du reçu (partagé entre téléchargement, impression, etc.) */
async function buildRecuDoc(
  ecole: Ecole,
  paiement: PaiementRecuInfo,
  caissier?: Profile | null
): Promise<jsPDF> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  const datePaiement = new Date(paiement.date_paiement)
  const dateStr = datePaiement.toLocaleDateString('fr-FR')
  const timeStr = datePaiement.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // Logo
  if (ecole.logo_url) {
    try {
      const logoData = await getImageData(ecole.logo_url)
      if (logoData) {
        doc.addImage(logoData, 'PNG', 14, 10, 24, 24)
      }
    } catch (e) { console.warn('Logo error skipped', e) }
  }

  const titleX = ecole.logo_url ? 45 : 14
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(15, 23, 42)
  doc.text(ecole.nom.toUpperCase(), titleX, 20)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(100, 116, 139)
  if (ecole.adresse)   doc.text(ecole.adresse, titleX, 26)
  if (ecole.telephone) doc.text(`Tél : ${ecole.telephone}`, titleX, 31)

  doc.setFontSize(10).setTextColor(15, 23, 42)
  doc.text(`Reçu N°: REF-${paiement.id.substring(0, 8).toUpperCase()}`, pageWidth - 14, 20, { align: 'right' })
  doc.text(`Date : ${dateStr} à ${timeStr}`, pageWidth - 14, 26, { align: 'right' })

  doc.setDrawColor(226, 232, 240)
  doc.line(14, 38, pageWidth - 14, 38)

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(5, 150, 105)
  doc.text('REÇU DE PAIEMENT SCOLARITÉ', pageWidth / 2, 50, { align: 'center' })

  doc.setFontSize(11).setTextColor(51, 65, 85)
  doc.setFont('helvetica', 'bold')
  doc.text("Informations de l'élève", 14, 65)
  doc.setFont('helvetica', 'normal')

  const eleveInfos = [
    `Nom & Prénom : ${paiement.eleve_prenom} ${paiement.eleve_nom}`,
    `Classe : ${paiement.classe_nom}`,
  ]
  if (paiement.eleve_matricule) eleveInfos.push(`Matricule : ${paiement.eleve_matricule}`)
  eleveInfos.forEach((text, i) => doc.text(text, 14, 75 + i * 7))

  try {
    autoTable(doc, {
      startY: 100,
      head: [['Désignation', 'Mode de paiement', 'Référence', 'Montant Payé']],
      body: [[
        paiement.frais_libelle,
        paiement.mode_paiement,
        paiement.reference || '-',
        `${paiement.montant.toLocaleString('fr-FR')} F`,
      ]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      styles: { font: 'helvetica', fontSize: 11, cellPadding: 6 },
      columnStyles: { 3: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] } },
    })
  } catch (err) {
    console.error('AutoTable error:', err)
  }

  const finalY = (doc as any).lastAutoTable?.finalY || 150
  
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(15, 23, 42)
  doc.text('La Direction', pageWidth - 50, finalY + 20)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(148, 163, 184)
  if (caissier) doc.text(`Encaissé par : ${caissier.prenom} ${caissier.nom}`, 14, finalY + 20)

  if (ecole.tampon_url) {
    try {
      const tamponData = await getImageData(ecole.tampon_url)
      if (tamponData) {
        doc.addImage(tamponData, 'PNG', pageWidth - 60, finalY + 25, 40, 40)
      }
    } catch (e) { console.warn('Tampon error skipped', e) }
  }

  doc.setFontSize(8).setTextColor(148, 163, 184)
  doc.text('Généré par EduMatrix • Logiciel de Gestion Scolaire Sénégalaise', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

  return doc
}

/** ⬇️ Télécharge le reçu PDF */
export async function generatePaiementRecuPDF(
  ecole: Ecole,
  paiement: PaiementRecuInfo,
  caissier?: Profile | null
) {
  const doc = await buildRecuDoc(ecole, paiement, caissier)
  doc.save(`Recu_${paiement.id.substring(0, 8)}_${paiement.eleve_nom.replace(/\s+/g, '')}.pdf`)
}

/** 🖨️ Ouvre le reçu PDF dans un onglet et déclenche l'impression */
export async function printPaiementRecuPDF(
  ecole: Ecole,
  paiement: PaiementRecuInfo,
  caissier?: Profile | null
) {
  const doc = await buildRecuDoc(ecole, paiement, caissier)
  // Ouvre en blob URL dans un nouvel onglet + auto-print
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => { win.print() }, 300)
    })
  }
  // Libère l'URL après 60s
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** 📤 Partage le résumé du paiement (WhatsApp, Email ou Copie) */
export function sharePaiementRecu(
  paiement: PaiementRecuInfo,
  ecole: Ecole,
  method: 'whatsapp' | 'email' | 'copy'
) {
  const date = new Date(paiement.date_paiement).toLocaleDateString('fr-FR')
  const montantStr = paiement.montant.toLocaleString('fr-FR')
  const ref = `REF-${paiement.id.substring(0, 8).toUpperCase()}`

  const message =
    `✅ *Reçu de paiement — ${ecole.nom}*\n` +
    `📋 Réf : ${ref}\n` +
    `👤 Élève : ${paiement.eleve_prenom} ${paiement.eleve_nom} (${paiement.classe_nom})\n` +
    `💰 Montant : ${montantStr} F CFA\n` +
    `🔖 Motif : ${paiement.frais_libelle}\n` +
    `📅 Date : ${date}`

  if (method === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  } else if (method === 'email') {
    const subject = encodeURIComponent(`Reçu paiement ${ref} — ${paiement.eleve_prenom} ${paiement.eleve_nom}`)
    const body    = encodeURIComponent(message.replace(/\*/g, ''))
    window.open(`mailto:?subject=${subject}&body=${body}`)
  } else {
    navigator.clipboard.writeText(message)
  }
}

