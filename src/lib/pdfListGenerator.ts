import jsPDF from 'jspdf'
import 'jspdf-autotable'
import type { Eleve, Ecole, Classe } from '@/lib/supabase'

// Fallback image dimensions might be needed if they can't be computed
const getBase64ImageFromUrl = async (imageUrl: string): Promise<string | null> => {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error('Network response non OK')
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error("Failed to load image for PDF:", err)
    return null
  }
}

export async function generateClassePDF(ecole: Ecole, classe: Classe, eleves: Eleve[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // ── 1. Branding Header ──
  // Logo à gauche
  if (ecole.logo_url) {
    const logoB64 = await getBase64ImageFromUrl(ecole.logo_url)
    if (logoB64) {
      // Trying to keep an arbitrary size. Can adjust as needed.
      doc.addImage(logoB64, 'PNG', 15, 10, 30, 30, '', 'FAST')
    }
  }

  // République à droite ou au centre
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', pageWidth - 15, 15, { align: 'right' })
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Un Peuple - Un But - Une Foi', pageWidth - 15, 20, { align: 'right' })
  doc.text('Ministère de l\'Éducation Nationale', pageWidth - 15, 25, { align: 'right' })

  // Infos de l'école (milieu / en dessous du logo)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(ecole.nom || 'École', 15, 48)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (ecole.adresse) doc.text(ecole.adresse, 15, 53)
  if (ecole.telephone) doc.text(`Tél: ${ecole.telephone}`, 15, 58)

  // ── 2. Titre de la liste ──
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`LISTE DE CLASSE : ${classe.nom_classe.toUpperCase()}`, pageWidth / 2, 75, { align: 'center' })

  const anneeColScolaire = new Date().getFullYear()
  doc.setFontSize(11)
  doc.setFont('helvetica', 'italic')
  doc.text(`Année scolaire: ${anneeColScolaire}-${anneeColScolaire + 1}  •  Effectif: ${eleves.length}`, pageWidth / 2, 82, { align: 'center' })

  // ── 3. Tableau des élèves ──
  const tableData = eleves.map((e, index) => [
    (index + 1).toString(),
    e.matricule || '—',
    e.prenom,
    e.nom,
    e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—'
  ])

  let finalY = 0

  ;(doc as any).autoTable({
    startY: 90,
    head: [['N°', 'Matricule', 'Prénom', 'Nom', 'Date Naissance']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255 }, // emerald-500
    didDrawPage: (data: any) => {
      finalY = data.cursor.y
    }
  })

  // ── 4. Zone Signature / Tampon ──
  // Check if we need a new page for signatures
  if (finalY > pageHeight - 60) {
    doc.addPage()
    finalY = 20
  } else {
    finalY += 20
  }

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Le Directeur', pageWidth - 50, finalY, { align: 'center' })

  if (ecole.tampon_url) {
    const tamponB64 = await getBase64ImageFromUrl(ecole.tampon_url)
    if (tamponB64) {
      doc.addImage(tamponB64, 'PNG', pageWidth - 65, finalY + 5, 30, 30, '', 'FAST')
    }
  }

  if (ecole.signature_url) {
    const sigB64 = await getBase64ImageFromUrl(ecole.signature_url)
    if (sigB64) {
      doc.addImage(sigB64, 'PNG', pageWidth - 55, finalY + 15, 25, 15, '', 'FAST')
    }
  }

  // ── Save PDF ──
  doc.save(`Liste_Classe_${classe.nom_classe.replace(/\s+/g, '_')}.pdf`)
}
