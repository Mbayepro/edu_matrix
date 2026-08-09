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
    // On essaie avec fetch
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
    const blob = await res.blob()
    
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64data = reader.result as string
        resolve(base64data)
      }
      reader.onerror = () => {
        console.error('FileReader error for:', url)
        resolve(null)
      }
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error('Erreur lors du chargement de l\'image (cors):', url, err)
    // Tentative alternative pour certains navigateurs si CORS est bloqué par fetch 
    // mais autorisé pour les balises img (parfois)
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
        // Détecter si c'est un PNG ou JPG pour addImage
        const format = ecole.logo_url.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG'
        doc.addImage(logoData, format, 14, 10, 24, 24)
      }
    } catch (e) { 
      console.warn('Logo error skipped', e)
    }
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
        paiement.reference || `REF-${paiement.id.substring(0, 8).toUpperCase()}`,
        `${paiement.montant.toLocaleString('fr-FR').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ')} F`,
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
        doc.addImage(tamponData, 'PNG', pageWidth - 60, finalY + 25, 35, 35)
      }
    } catch (e) { console.warn('Tampon error skipped', e) }
  }

  if (ecole.signature_url) {
    try {
      const signatureData = await getImageData(ecole.signature_url)
      if (signatureData) {
        doc.addImage(signatureData, 'PNG', pageWidth - 55, finalY + 30, 30, 15)
      }
    } catch (e) { console.warn('Signature error skipped', e) }
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

export async function printThermalPaiementRecuPDF(
  ecole: Ecole,
  paiement: PaiementRecuInfo,
  caissier?: Profile | null
) {
  // Format thermique 80mm. 
  // On utilise une longueur de 160mm pour avoir assez de place.
  const doc = new jsPDF({ format: [80, 160], unit: 'mm' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 6 // Marge gauche/droite augmentée pour éviter les coupures à l'impression
  
  const datePaiement = new Date(paiement.date_paiement)
  const dateStr = datePaiement.toLocaleDateString('fr-FR')
  const timeStr = datePaiement.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  
  let y = 5

  const textCenter = (text: string, yPos: number, options?: any) => {
    doc.text(text, pageWidth / 2, yPos, { align: 'center', ...options })
  }

  // --- LOGO (Optionnel, si disponible et chargeable) ---
  if (ecole.logo_url) {
    try {
      const logoData = await getImageData(ecole.logo_url)
      if (logoData) {
        const format = ecole.logo_url.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG'
        doc.addImage(logoData, format, (pageWidth - 20) / 2, y, 20, 20)
        y += 22
      }
    } catch (e) { 
      console.warn('Logo error skipped for thermal', e) 
    }
  } else {
    y += 5
  }

  // --- EN-TÊTE ÉCOLE ---
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0, 0, 0)
  textCenter(ecole.nom.toUpperCase(), y)
  
  doc.setFont('helvetica', 'normal').setFontSize(8)
  if (ecole.adresse) textCenter(ecole.adresse, y += 4)
  if (ecole.telephone) textCenter(`Tel: ${ecole.telephone}`, y += 4)
  
  y += 2
  ;(doc as any).setLineDash([1, 1], 0)
  doc.line(marginX, y, pageWidth - marginX, y)
  ;(doc as any).setLineDash([], 0)

  // --- TITRE REÇU ---
  y += 6
  doc.setFont('helvetica', 'bold').setFontSize(10)
  textCenter('REÇU DE SCOLARITÉ', y)
  doc.setFontSize(8).setFont('helvetica', 'normal')
  textCenter(`Date : ${dateStr} à ${timeStr}`, y += 4)
  textCenter(`Réf: REF-${paiement.id.substring(0, 8).toUpperCase()}`, y += 4)
  
  y += 2
  ;(doc as any).setLineDash([1, 1], 0)
  doc.line(marginX, y, pageWidth - marginX, y)
  ;(doc as any).setLineDash([], 0)
  
  // --- INFOS ÉLÈVE ---
  y += 6
  doc.setFont('helvetica', 'bold').setFontSize(8)
  doc.text('ÉLÈVE :', marginX, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${paiement.eleve_prenom} ${paiement.eleve_nom}`, marginX, y += 4)
  doc.text(`Classe: ${paiement.classe_nom}`, marginX, y += 4)
  if (paiement.eleve_matricule) {
    doc.text(`Matricule: ${paiement.eleve_matricule}`, marginX, y += 4)
  }

  y += 2
  ;(doc as any).setLineDash([1, 1], 0)
  doc.line(marginX, y, pageWidth - marginX, y)
  ;(doc as any).setLineDash([], 0)

  // --- DÉTAILS PAIEMENT ---
  y += 6
  doc.setFont('helvetica', 'bold').setFontSize(8)
  doc.text('MOTIF / DÉSIGNATION :', marginX, y)
  doc.setFont('helvetica', 'normal')
  
  const splitMotif = doc.splitTextToSize(paiement.frais_libelle, pageWidth - (marginX * 2))
  doc.text(splitMotif, marginX, y += 4)
  y += (splitMotif.length - 1) * 4

  doc.text(`Mode de paiement : ${paiement.mode_paiement}`, marginX, y += 4)
  
  y += 6
  // --- TOTAL ---
  doc.setFillColor(240, 240, 240)
  doc.rect(marginX, y - 4, pageWidth - (marginX * 2), 8, 'F') // Fond gris clair pour le total
  doc.setFont('helvetica', 'bold').setFontSize(10)
  doc.text('TOTAL PAYÉ :', marginX + 2, y + 1.5)
  doc.text(`${paiement.montant.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/g, ' ')} F`, pageWidth - marginX - 2, y + 1.5, { align: 'right' })
  
  y += 6
  ;(doc as any).setLineDash([1, 1], 0)
  doc.line(marginX, y, pageWidth - marginX, y)
  ;(doc as any).setLineDash([], 0)

  // --- PIED DE PAGE ---
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(7)
  textCenter(`Caissier: ${caissier ? `${caissier.prenom} ${caissier.nom}` : 'Direction'}`, y)
  y += 4
  doc.setFont('helvetica', 'italic')
  textCenter('Merci de votre confiance.', y)
  textCenter('Conservez ce reçu précieusement.', y += 3)
  
  const blob = doc.output('blob')
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => { win.print() }, 300)
    })
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
