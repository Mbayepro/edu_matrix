// src/lib/bulletinPdfGenerator.ts
// Génération PDF des bulletins avec jsPDF — remplace window.open()
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { BulletinData } from './calculMoyennes'
import type { Ecole } from './supabase'

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
      reader.onerror = () => {
        console.error('Erreur lecture image:', url)
        resolve(null)
      }
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Erreur chargement image:', url, errorMessage)
    
    // Si c'est une erreur CORS, on retourne null silencieusement
    if (errorMessage.includes('CORS') || errorMessage.includes('fetch')) {
      console.warn('CORS ou fetch error - image ignorée:', url)
      return null
    }
    
    return null
  }
}

/** Dessine un bulletin complet sur la page courante du doc jsPDF */
export function drawBulletin(
  doc: jsPDF,
  bulletin: BulletinData,
  ecole: Ecole | null,
  typePeriode: 'trimestre' | 'semestre',
  includePIN: boolean,
  images?: { logo?: string | null, signature?: string | null, tampon?: string | null }
) {
  const margin = 12
  const pw = 210
  const cw = pw - 2 * margin
  const isPrimaire = bulletin.niveau?.cycle === 'primaire'
  const baremeLabel = isPrimaire ? '/10' : '/20'
  const perioLabel = typePeriode === 'semestre' ? 'Semestre' : 'Trimestre'
  const ordinal = bulletin.trimestre === 1 ? '1er' : `${bulletin.trimestre}ème`

  doc.setTextColor(0, 0, 0)

  // ── Bordure ──────────────────────────────────────────────────────────────
  doc.setLineWidth(0.5)
  doc.setDrawColor(0)
  doc.rect(margin, margin, cw, 273)

  let y = margin + 8

  // ── En-tête avec LOGO ───────────────────────────────────────────────────
  if (images?.logo) {
    const logoSize = 25
    doc.addImage(images.logo, 'PNG', margin + 5, y - 4, logoSize, logoSize)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text((ecole?.nom || 'ÉTABLISSEMENT SCOLAIRE').toUpperCase(), pw / 2, y, { align: 'center' })
  y += 5

  doc.setLineWidth(0.5)
  doc.line(margin + 35, y, pw - margin - 35, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(ecole?.adresse || "Plateforme EduMatrix — Gestion Scolaire Moderne", pw / 2, y, { align: 'center' })
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(`BULLETIN DE NOTES : ${ordinal} ${perioLabel.toUpperCase()}`, pw / 2, y, { align: 'center' })
  y += 11

  // ── Boîtes d'informations ─────────────────────────────────────────────────
  const boxH = 28
  const halfW = cw / 2 - 3

  // Boîte gauche : infos classe
  doc.setLineWidth(0.3)
  doc.rect(margin, y, halfW, boxH)
  doc.setFontSize(8)
  const lx = margin + 4
  const rows: [string, string][] = [
    ['Année Scolaire :', bulletin.annee_scolaire],
    ['Filière / Série :', (bulletin.eleve as any).classe?.serie?.nom || 'Enseignement Général'],
    ['Classe :', bulletin.eleve.classe?.nom_classe || 'N/A'],
    ['Cycle :', isPrimaire ? 'Élémentaire' : 'Moyen / Secondaire'],
  ]
  rows.forEach(([label, val], i) => {
    const lineY = y + 7 + i * 6
    doc.setFont('helvetica', 'bold'); doc.text(label, lx, lineY)
    doc.setFont('helvetica', 'normal'); doc.text(val, lx + label.length * 1.8 + 3, lineY)
  })

  // Boîte droite : infos élève
  const rx = margin + halfW + 6
  doc.rect(rx, y, halfW, boxH)
  const rtx = rx + 4
  const dob = bulletin.eleve.date_naissance
    ? new Date(bulletin.eleve.date_naissance).toLocaleDateString('fr-FR')
    : '—'
  const studentRows: [string, string][] = [
    ['Prénom & Nom :', `${bulletin.eleve.prenom} ${bulletin.eleve.nom}`],
    ['Matricule :', bulletin.eleve.matricule || 'Sans'],
    ['Naissance :', dob],
  ]
  if (includePIN && bulletin.eleve.pin_parent) {
    studentRows.push(['PIN Parent :', bulletin.eleve.pin_parent])
  }
  studentRows.forEach(([label, val], i) => {
    const lineY = y + 7 + i * 6
    doc.setFont('helvetica', 'bold'); doc.text(label, rtx, lineY)
    doc.setFont('helvetica', 'normal'); doc.text(val, rtx + label.length * 1.8 + 3, lineY)
  })

  y += boxH + 6

  // ── Tableau des notes ─────────────────────────────────────────────────────
  const tableRows = bulletin.matieres.map(m => [
    (m as any).matiere_nom || (m as any).nom || 'Inconnue',
    String(m.coefficient),
    m.moyenne_controles !== null && m.moyenne_controles !== undefined ? m.moyenne_controles.toFixed(2) : '—',
    m.note_examen !== null && m.note_examen !== undefined ? m.note_examen.toFixed(2) : '—',
    m.moyenne !== null ? m.moyenne.toFixed(2) : '—',
    m.moyenne !== null ? (m.moyenne * (m.coefficient || 1)).toFixed(2) : '—',
    m.appreciation || '',
  ])

  const totalCoef = bulletin.matieres.reduce((a, m) => a + (m.moyenne !== null ? (m.is_bonus ? 0 : m.coefficient || 1) : 0), 0)
  const totalPts  = bulletin.matieres.reduce((a, m) => a + (m.moyenne !== null ? m.moyenne * (m.coefficient || 1) : 0), 0)
  tableRows.push(['TOTAUX', String(totalCoef), '', '', '', totalPts.toFixed(2), ''])

  autoTable(doc, {
    startY: y,
    head: [['Matières', 'Coef', 'Moy. CC', 'Comp.', `Moy. (${baremeLabel})`, 'Total Pts', 'Appréciation']],
    body: tableRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [248, 250, 252], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38 },
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 22 },
      5: { halign: 'center', fontStyle: 'bold', fillColor: [255, 247, 237], cellWidth: 20 },
      6: { fontSize: 7, fontStyle: 'italic' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [248, 250, 252]
      }
    },
  })

  y = (doc as any).lastAutoTable.finalY + 6

  // ── Moyenne générale avec PROGRESSION ─────────────────────────────────────
  const avgW = 95
  const avgX = pw - margin - avgW
  doc.setLineWidth(0.8)
  doc.rect(avgX, y, avgW, 10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const avgLabel = typePeriode === 'semestre' ? 'SEMESTRE' : 'TRIMESTRE'
  
  doc.text(
    `MOY. DU ${avgLabel} : ${bulletin.moyenne_generale !== null ? bulletin.moyenne_generale.toFixed(2) : 'N/A'} ${baremeLabel}   [${bulletin.mention}]`,
    avgX + 3, y + 7
  )

  // Indicateur de progression (Tendance)
  if (bulletin.annual?.progression !== null && bulletin.annual?.progression !== undefined) {
    const prog = bulletin.annual.progression
    const isUp = prog >= 0
    doc.setFontSize(7)
    if (isUp) doc.setTextColor(21, 128, 61)
    else doc.setTextColor(185, 28, 28)
    const progText = `${isUp ? '↑' : '↓'} ${Math.abs(prog).toFixed(2)}`
    doc.text(progText, avgX + avgW - 12, y + 7, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  y += 15

  // ── BILAN ANNUEL (Tableau récapitulatif) ──────────────────────────────────
  if (bulletin.annual) {
    const tableW = 60
    const tableX = pw - margin - tableW
    const tableY = y
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('BILAN ANNUEL', tableX, tableY - 2)
    
    const head = typePeriode === 'semestre' ? ['S1', 'S2', 'ANNUEL'] : ['T1', 'T2', 'T3', 'ANNUEL']
    const body = [
      bulletin.annual.moyennes_trimestrielles
        .filter((_, i) => typePeriode === 'semestre' ? i < 2 : i < 3)
        .map(v => v !== null ? v.toFixed(2) : '—')
        .concat([bulletin.annual.moyenne_annuelle.toFixed(2)])
    ]

    autoTable(doc, {
      startY: tableY,
      head: [head],
      body: body,
      margin: { left: tableX },
      tableWidth: tableW,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
    })
  }

  // ── Assiduité & Appréciation ──────────────────────────────────────────────
  const attW = cw - 65
  doc.setLineWidth(0.3)
  doc.rect(margin, y, attW, 22)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Absences : ${bulletin.attendance?.absences || 0}`, margin + 4, y + 7)
  doc.text(`Retards : ${bulletin.attendance?.retards || 0}`, margin + 35, y + 7)
  doc.text(`Rang : ${bulletin.rang ?? '—'} / ${bulletin.total_eleves ?? '—'}`, margin + 65, y + 7)

  const appreciation = (bulletin.eleve as any).appreciation_trimestre || bulletin.mention
  doc.setFont('helvetica', 'bold')
  doc.text('Appréciation :', margin + 4, y + 16)
  doc.setFont('helvetica', 'italic')
  doc.text(appreciation, margin + 28, y + 16, { maxWidth: attW - 32 })

  // ── Zone signature avec TAMPON & SIGNATURE ────────────────────────────────
  const sigX = margin + attW + 4
  const sigW = cw - attW - 4
  doc.setLineWidth(0.3)
  doc.rect(sigX, y, sigW, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Le Directeur', sigX + sigW / 2, y + 6, { align: 'center' })
  
  // DÉCISION DE FIN D'ANNÉE (si applicable)
  if (bulletin.annual?.decision && bulletin.annual.decision !== 'En attente') {
    doc.setFontSize(10)
    const dec = bulletin.annual.decision.toUpperCase()
    if (dec === 'PASSAGE') doc.setTextColor(5, 150, 105)
    else if (dec === 'REDOUBLEMENT') doc.setTextColor(217, 119, 6)
    else if (dec === 'EXCLUSION') doc.setTextColor(220, 38, 38)
    else doc.setTextColor(0, 0, 0)

    doc.text(`DÉCISION : ${dec}`, sigX + sigW / 2, y + 14, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  // Tampon
  if (images?.tampon) {
    doc.addImage(images.tampon, 'PNG', sigX + 4, y + 4, 11, 11)
  }
  // Signature
  if (images?.signature) {
    doc.addImage(images.signature, 'PNG', sigX + sigW / 2 - 8, y + 9, 18, 9)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Signature & Cachet', sigX + sigW / 2, y + 20, { align: 'center' })
}

/** Génère et télécharge le PDF d'un seul bulletin */
export async function generateSingleBulletinPDF(
  bulletin: BulletinData,
  ecole: Ecole | null,
  typePeriode: 'trimestre' | 'semestre',
  includePIN: boolean
) {
  try {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    
    // Chargement des images en parallèle avec timeout
    const imagePromises = Promise.all([
      getImageData(ecole?.logo_url),
      getImageData(ecole?.signature_url),
      getImageData(ecole?.tampon_url)
    ])
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout chargement images')), 10000)
    )
    
    const [logo, signature, tampon] = await Promise.race([imagePromises, timeoutPromise]) as [string | null, string | null, string | null]

    drawBulletin(doc, bulletin, ecole, typePeriode, includePIN, { logo, signature, tampon })
    const fileName = `Bulletin_${bulletin.eleve.prenom}_${bulletin.eleve.nom}_T${bulletin.trimestre}.pdf`
    doc.save(fileName)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Erreur génération PDF bulletin:', errorMessage)
    throw new Error(`Échec de la génération du PDF: ${errorMessage}`)
  }
}

/** Génère et télécharge le PDF de tous les bulletins d'une classe */
export async function generateAllBulletinsPDF(
  bulletins: BulletinData[],
  ecole: Ecole | null,
  typePeriode: 'trimestre' | 'semestre',
  classeNom: string,
  includePIN: boolean
) {
  if (bulletins.length === 0) return
  
  try {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })

    // Chargement des images une seule fois pour tout le lot avec timeout
    const imagePromises = Promise.all([
      getImageData(ecole?.logo_url),
      getImageData(ecole?.signature_url),
      getImageData(ecole?.tampon_url)
    ])
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout chargement images')), 10000)
    )
    
    const [logo, signature, tampon] = await Promise.race([imagePromises, timeoutPromise]) as [string | null, string | null, string | null]

    bulletins.forEach((bulletin, idx) => {
      if (idx > 0) doc.addPage()
      drawBulletin(doc, bulletin, ecole, typePeriode, includePIN, { logo, signature, tampon })
    })
    doc.save(`Bulletins_${classeNom}_T${bulletins[0].trimestre}.pdf`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Erreur génération PDF bulletins:', errorMessage)
    throw new Error(`Échec de la génération des PDFs: ${errorMessage}`)
  }
}
