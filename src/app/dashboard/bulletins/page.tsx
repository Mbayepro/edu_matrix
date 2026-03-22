'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CalculateurMoyennes } from '@/lib/calculMoyennes'
import type { BulletinData } from '@/lib/calculMoyennes'
import type { Classe, Eleve, Ecole, Niveau, Serie } from '@/lib/supabase'
import {
  Loader2,
  Download,
  FileText,
  Users,
  Calendar,
  TrendingUp,
  Award,
  Eye,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export default function BulletinsPage() {
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [ecole, setEcole] = useState<Ecole | null>(null)
  const [classes, setClasses] = useState<Classe[]>([])
  const [selectedClasse, setSelectedClasse] = useState<string>('')
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1)
  const [anneeScolaire, setAnneeScolaire] = useState('2025-2026')
  const [bulletins, setBulletins] = useState<BulletinData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBulletins, setLoadingBulletins] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { showToast } = useToast()

  // Générer les années scolaires disponibles
  const anneesScolaires = [
    '2023-2024',
    '2024-2025',
    '2025-2026',
    '2026-2027',
    '2027-2028'
  ]

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (ecoleId) {
      Promise.all([loadEcole(), loadClasses()]).finally(() => {
        setLoading(false)
      })
    }
  }, [ecoleId])

  useEffect(() => {
    if (selectedClasse && selectedTrimestre && anneeScolaire) {
      loadBulletins()
    }
  }, [selectedClasse, selectedTrimestre, anneeScolaire])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('ecole_id')
      .eq('user_id', user.id)
      .single()
    
    if (prof?.ecole_id) {
      setEcoleId(prof.ecole_id)
    } else {
      setLoading(false)
    }
  }

  async function loadEcole() {
    if (!ecoleId) return
    
    const { data } = await supabase
      .from('ecoles')
      .select('*')
      .eq('id', ecoleId)
      .single()
    
    setEcole(data)
  }

  async function loadClasses() {
    if (!ecoleId) return
    
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('ecole_id', ecoleId)
      .order('nom_classe')
    
    setClasses(data ?? [])
  }

  async function loadBulletins() {
    if (!selectedClasse || !selectedTrimestre) return
    
    setLoadingBulletins(true)
    setErrorMsg(null)
    try {
      const bulletinsData = await CalculateurMoyennes.genererBulletinsClasse(
        selectedClasse,
        selectedTrimestre,
        anneeScolaire
      )
      
      if (bulletinsData.length === 0) {
        showToast('Aucun élève trouvé ou pas de notes pour ce trimestre.', 'error')
      } else {
        const withNotes = bulletinsData.filter(b => b.matieres.length > 0)
        if (withNotes.length === 0) {
          showToast("Les élèves existent mais aucune moyenne calculée. Vérifiez vos matières et coefficients dans les Paramètres.", "error")
        } else {
          showToast(`${withNotes.length} bulletins calculés.`, 'success')
        }
      }
      setBulletins(bulletinsData)
    } catch (error: any) {
      console.error('Erreur lors du chargement des bulletins:', error)
      setErrorMsg(error.message || 'Impossible de générer les bulletins')
      showToast('Erreur : ' + (error.message || 'Impossible de générer les bulletins'), 'error')
      setBulletins([])
    } finally {
      setLoadingBulletins(false)
    }
  }

  async function calculateBulletin(eleve: any, trimestre: number): Promise<BulletinData> {
    // Get all notes for the student in the specified trimester
    const { data: notes } = await supabase
      .from('notes')
      .select(`
        *,
        evaluation:evaluations(
          *,
          matiere:matieres(*)
        )
      `)
      .eq('eleve_id', eleve.id)
      .eq('evaluation->trimestre', trimestre)

    // Group notes by subject
    const matieresMap = new Map<string, any[]>()

    notes?.forEach((note: any) => {
      const matiereNom = note.evaluation?.matiere?.nom || 'Inconnue'
      if (!matieresMap.has(matiereNom)) {
        matieresMap.set(matiereNom, [])
      }
      matieresMap.get(matiereNom)?.push(note)
    })

    // Calculate averages by subject
    const matieresData = Array.from(matieresMap.entries()).map(([nom, notesMatiere]) => {
      const totalPoints = notesMatiere.reduce((sum: number, note: any) => {
        return sum + (note.note * (note.evaluation?.coef || 1))
      }, 0)
      
      const totalCoef = notesMatiere.reduce((sum: number, note: any) => {
        return sum + (note.evaluation?.coef || 1)
      }, 0)

      const bareme = notesMatiere[0]?.evaluation?.bareme || 20
      const moyenne = totalCoef > 0 ? totalPoints / totalCoef : 0
      const coefficient = notesMatiere[0]?.evaluation?.matiere?.coefficient || 1

      return {
        matiere_id: notesMatiere[0]?.evaluation?.matiere?.id || '',
        matiere_nom: nom || 'Inconnue',
        coefficient,
        moyenne: Math.round(moyenne * 100) / 100,
        bareme,
        nombre_evaluations: notesMatiere.length,
      }
    })

    // Calculate general average normalized to 20
    let weightedTotalPoints = 0
    let totalCoefficients = 0

    matieresData.forEach(matiere => {
      const normalizedMoyenne = (matiere.moyenne / matiere.bareme) * 20
      weightedTotalPoints += normalizedMoyenne * matiere.coefficient
      totalCoefficients += matiere.coefficient
    })

    const moyenneGenerale = totalCoefficients > 0 ? weightedTotalPoints / totalCoefficients : 0

    // Determine mention
    const getMention = (moyenne: number) => {
      if (moyenne < 10) return 'Insuffisant'
      if (moyenne < 12) return 'Passable'
      if (moyenne < 14) return 'Assez bien'
      if (moyenne < 16) return 'Bien'
      return 'Très bien'
    }

    return {
      eleve,
      niveau: {} as any, // À implémenter
      serie: undefined, // À implémenter
      moyenne_generale: Math.round(moyenneGenerale * 100) / 100,
      mention: getMention(moyenneGenerale),
      matieres: matieresData,
      trimestre,
      annee_scolaire: anneeScolaire,
    }
  }

  async function generateBulletinPDF(bulletin: BulletinData) {
    setGenerating(bulletin.eleve.id)
    
    try {
      const html = generateBulletinHTML(bulletin)
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
    } finally {
      setGenerating(null)
    }
  }

  async function generateAllBulletinsPDF() {
    if (bulletins.length === 0) return;
    setGenerating('all')
    
    try {
      let combinedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Bulletins de la classe ${classes.find(c => c.id === selectedClasse)?.nom_classe}</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
              @media print {
                  body { background: white; padding: 0; }
                  .bulletin-page { page-break-after: always; padding: 20px; }
                  .bulletin-page:last-child { page-break-after: auto; }
              }
              .bulletin-page { padding: 40px; margin: 0 auto; max-width: 800px; }
              /* Extracted styles */
              .bulletin { margin: 0 auto; background: white; padding: 0; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
              .header h1 { color: #1f2937; margin: 0; font-size: 24px; }
              .header h2 { color: #6b7280; margin: 5px 0 0 0; font-size: 16px; font-weight: normal; }
              .student-info { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
              .student-info h3 { color: #374151; margin: 0 0 10px 0; }
              .student-info p { margin: 5px 0; color: #6b7280; }
              .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              .table th, .table td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
              .table th { background: #f3f4f6; font-weight: bold; color: #374151; }
              .table tr:nth-child(even) { background: #f9fafb; }
              .moyenne { text-align: center; font-weight: bold; }
              .mention { text-align: center; font-weight: bold; padding: 8px; border-radius: 4px; color: white; display: inline-block; }
              .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px; }
              .logo { max-width: 100px; margin-bottom: 20px; }
          </style>
      </head>
      <body>
      `;

      for (const bulletin of bulletins) {
        const bodyContent = generateBulletinHTML(bulletin, true);
        combinedHtml += `<div class="bulletin-page">${bodyContent}</div>`;
      }
      
      combinedHtml += `</body></html>`;

      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(combinedHtml)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
        }, 1500) // waiting longer for all images
      }
    } finally {
      setGenerating(null)
    }
  }

  function generateBulletinHTML(bulletin: BulletinData, insideCombined: boolean = false): string {
    const getMentionColor = (mention: string) => {
      switch (mention) {
        case 'Très bien': return '#10b981'
        case 'Bien': return '#3b82f6'
        case 'Assez bien': return '#f59e0b'
        case 'Passable': return '#f97316'
        default: return '#ef4444'
      }
    }

    const displayMoyenneTotal = bulletin.niveau?.cycle === 'primaire' ? bulletin.moyenne_generale / 2 : bulletin.moyenne_generale;
    const displayBaremeTotal = bulletin.niveau?.cycle === 'primaire' ? 10 : 20;

    const content = `
    <div class="bulletin">
        <div class="header">
            ${ecole?.logo_url ? `<img src="${ecole.logo_url}" alt="Logo" class="logo">` : ''}
            <h1>${ecole?.nom || 'Établissement Scolaire'}</h1>
            <h2>Bulletin Trimestriel - Trimestre ${bulletin.trimestre}</h2>
            <h2>Année Scolaire ${bulletin.annee_scolaire}</h2>
        </div>

        <div class="student-info">
            <div>
                <h3>Élève</h3>
                <p><strong>Nom :</strong> ${bulletin.eleve.prenom} ${bulletin.eleve.nom}</p>
                <p><strong>Matricule :</strong> ${bulletin.eleve.matricule || 'N/A'}</p>
                <p><strong>Classe :</strong> ${bulletin.eleve.classe?.nom_classe || 'N/A'}</p>
            </div>
            <div style="text-align: right;">
                <h3>Conseil de Classe</h3>
                <p><strong>Décision :</strong> <span style="text-transform: uppercase; font-weight: bold; color: ${bulletin.moyenne_generale >= 10 ? '#059669' : '#dc2626'}">${(bulletin.eleve as any).decision_conseil?.replace(/_/g, ' ') || 'À DÉTERMINER'}</span></p>
                <p><strong>Rang :</strong> ${bulletin.rang} / ${bulletin.total_eleves}</p>
            </div>
        </div>

        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #374151;">Appréciation Générale</h3>
            <p style="margin: 0; font-style: italic; color: #4b5563; min-height: 40px;">
                ${(bulletin.eleve as any).appreciation_trimestre || 'Aucune appréciation saisie.'}
            </p>
        </div>

        <table class="table">
            <thead>
                <tr>
                    <th>Matière</th>
                    <th>Coefficient</th>
                    <th>Moyenne</th>
                    <th>Observation</th>
                </tr>
            </thead>
            <tbody>
                ${bulletin.matieres.map(matiere => {
                  const isBonus = matiere.is_bonus;
                  const displayMoyenne = bulletin.niveau?.cycle === 'primaire' ? matiere.moyenne / 2 : matiere.moyenne;
                  const displayBareme = bulletin.niveau?.cycle === 'primaire' ? 10 : 20;
                  
                  return `
                    <tr>
                        <td>${matiere.matiere_nom} ${isBonus ? '<small style="color: #6366f1; font-weight: bold;">(BONUS)</small>' : ''}</td>
                        <td>${isBonus ? '-' : matiere.coefficient}</td>
                        <td class="moyenne">
                          ${isBonus 
                            ? `<span style="color: #6366f1; font-weight: bold;">+${(matiere.points_bonus || 0).toFixed(2)} pts</span>` 
                            : `${displayMoyenne.toFixed(2)} / ${displayBareme}`
                          }
                        </td>
                        <td style="font-size: 12px; color: #6b7280;">${matiere.appreciation}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <div>
                <h3 style="margin: 0; color: #374151;">Moyenne Générale</h3>
                <p style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0;">
                    ${displayMoyenneTotal.toFixed(2)} / ${displayBaremeTotal}
                </p>
            </div>
            <div>
                <h3 style="margin: 0; color: #374151;">Mention</h3>
                <div class="mention" style="background: ${getMentionColor(bulletin.mention)};">
                    ${bulletin.mention}
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Fait à ${ecole?.ville || 'Dakar'}, le ${new Date().toLocaleDateString('fr-FR')}</p>
            <div style="margin-top: 30px;">
                ${ecole?.signature_url ? `<img src="${ecole.signature_url}" alt="Signature" style="max-height: 60px;">` : ''}
                ${ecole?.tampon_url ? `<img src="${ecole.tampon_url}" alt="Tampon" style="max-height: 80px; margin-left: 20px;">` : ''}
            </div>
        </div>
    </div>`;

    if (insideCombined) return content;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bulletin ${bulletin.eleve.prenom} ${bulletin.eleve.nom}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .bulletin { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
        .header h1 { color: #1f2937; margin: 0; font-size: 24px; }
        .header h2 { color: #6b7280; margin: 5px 0 0 0; font-size: 16px; font-weight: normal; }
        .student-info { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .student-info h3 { color: #374151; margin: 0 0 10px 0; }
        .student-info p { margin: 5px 0; color: #6b7280; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .table th, .table td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        .table th { background: #f3f4f6; font-weight: bold; color: #374151; }
        .table tr:nth-child(even) { background: #f9fafb; }
        .moyenne { text-align: center; font-weight: bold; }
        .mention { text-align: center; font-weight: bold; padding: 8px; border-radius: 4px; color: white; display: inline-block; }
        .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px; }
        .logo { max-width: 100px; margin-bottom: 20px; }
    </style>
</head>
<body>
${content}
</body>
</html>`;
  }

  const selectedClasseData = classes.find(c => c.id === selectedClasse)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bulletins Scolaires</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Générez et consultez les bulletins de performance de vos élèves.
          </p>
        </div>

        {bulletins.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-center px-4 border-r border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</div>
              <div className="text-lg font-black text-slate-900 leading-tight">{bulletins.length}</div>
            </div>
            <div className="text-center px-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moy. Classe</div>
              <div className="text-lg font-black text-emerald-600 leading-tight">
                {((bulletins.reduce((sum, b) => sum + b.moyenne_generale, 0) / bulletins.length) / (bulletins[0]?.niveau?.cycle === 'primaire' ? 2 : 1)).toFixed(2)}
              </div>
            </div>
            <button
              onClick={generateAllBulletinsPDF}
              disabled={generating === 'all'}
              className="ml-2 flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50"
            >
              {generating === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Imprimer Tout
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-5 space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Structure / Classe</label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
            >
              <option value="">Sélectionner une classe</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.nom_classe}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Période scolaire</label>
            <select
              value={selectedTrimestre}
              onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all shadow-sm"
            >
              <option value={1}>1er Trimestre</option>
              <option value={2}>2ème Trimestre</option>
              <option value={3}>3ème Trimestre</option>
            </select>
          </div>

          <div className="md:col-span-3">
             <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                   <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60">Année Scolaire</p>
                   <select 
                      value={anneeScolaire} 
                      onChange={(e) => setAnneeScolaire(e.target.value)}
                      className="bg-transparent border-none p-0 text-sm font-black text-emerald-900 leading-tight focus:ring-0 w-32 outline-none"
                   >
                      {anneesScolaires.map(annee => (
                        <option key={annee} value={annee}>{annee}</option>
                      ))}
                   </select>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Persistent Error Alert */}
      {!loadingBulletins && errorMsg && (
        <div className="mx-8 mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-3xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-red-500/5">
          <div className="w-12 h-12 rounded-2xl bg-white border border-red-200 flex items-center justify-center shrink-0">
             <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-red-900 mb-1">Erreur inattendue</h3>
            <p className="text-sm text-red-700 font-medium">
              Le calcul des bulletins a été interrompu: <strong className="break-all">{errorMsg}</strong>
            </p>
            <button 
              onClick={() => setErrorMsg(null)}
              className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 bg-white px-3 py-1.5 rounded-lg border border-red-200"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Persistent Alert for Configuration Issues */}
      {!loadingBulletins && selectedClasse && bulletins.length > 0 && bulletins.filter(b => b.matieres.length > 0).length === 0 && (
         <div className="mx-8 mb-8 p-6 bg-red-50 border-2 border-red-100 rounded-3xl flex items-start gap-5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-red-500/5">
           <div className="w-14 h-14 rounded-2xl bg-white border-2 border-red-100 flex items-center justify-center shrink-0 shadow-sm">
             <AlertCircle className="w-7 h-7 text-red-500" />
           </div>
           <div className="flex-1">
             <h3 className="text-lg font-black text-red-900 mb-2">Calcul impossible pour {classes.find(c => c.id === selectedClasse)?.nom_classe}</h3>
             <div className="space-y-3 text-sm text-red-700/80 font-medium leading-relaxed">
               <p>Aucune matière n&apos;a pu être calculée pour cette classe. Voici les points à vérifier :</p>
               <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 list-none">
                 <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <strong>Coefficients :</strong> Absents pour le niveau {classes.find(c => c.id === selectedClasse)?.niveau}.
                 </li>
                 <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <strong>Notes :</strong> Aucune note saisie pour le Trimestre {selectedTrimestre}.
                 </li>
                 <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <strong>Paramètres :</strong> Matières non liées à ce niveau.
                 </li>
               </ul>
             </div>
             <div className="flex gap-3 mt-6">
                <Link 
                  href="/dashboard/matieres" 
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-600/20"
                >
                  Configurer les Coefficients
                </Link>
                <Link 
                  href="/dashboard/notes" 
                  className="px-6 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Saisir des Notes
                </Link>
             </div>
           </div>
         </div>
      )}

      {/* Bulletins List */}
      {loadingBulletins ? (
        <div className="flex flex-col justify-center items-center py-24 gap-4 animate-in fade-in duration-500">
          <div className="relative">
             <div className="w-16 h-16 rounded-full border-4 border-emerald-500/10 border-t-emerald-600 animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600/50" />
             </div>
          </div>
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">Génération des statistiques en cours…</p>
        </div>
      ) : bulletins.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {bulletins.map((bulletin) => (
            <div key={bulletin.eleve.id} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 flex flex-col">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-slate-900/20 group-hover:scale-110 transition-transform duration-500">
                      {bulletin.eleve.prenom[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 leading-tight">
                        {bulletin.eleve.prenom} {bulletin.eleve.nom}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                          {bulletin.eleve.matricule}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {selectedClasseData?.nom_classe}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 leading-none">Moyenne</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">
                        {(bulletin.niveau?.cycle === 'primaire' ? bulletin.moyenne_generale / 2 : bulletin.moyenne_generale).toFixed(2)}
                        <span className="text-sm text-slate-400">/{bulletin.niveau?.cycle === 'primaire' ? '10' : '20'}</span>
                      </p>
                    </div>
                    
                    <button
                      onClick={() => generateBulletinPDF(bulletin)}
                      disabled={generating === bulletin.eleve.id}
                      className="w-12 h-12 flex items-center justify-center bg-emerald-600 hover:bg-slate-900 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50 group/btn"
                    >
                      {generating === bulletin.eleve.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50/50 rounded-2xl p-6 mb-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                     <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Aperçu Académique</h4>
                     <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                        bulletin.mention === 'Très bien' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        bulletin.mention === 'Bien' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        bulletin.mention === 'Assez bien' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        bulletin.mention === 'Passable' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                        'bg-red-50 text-red-600 border-red-100'
                     }`}>
                        {bulletin.mention}
                     </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {bulletin.matieres.slice(0, 6).map((matiere, index) => (
                      <div key={index} className={`bg-white rounded-xl p-3 border shadow-sm group/item hover:border-emerald-200 transition-colors ${matiere.is_bonus ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-200/50'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest truncate mb-1 ${matiere.is_bonus ? 'text-indigo-400' : 'text-slate-400'}`}>
                          {matiere.matiere_nom}
                        </p>
                        <div className="flex items-baseline gap-1">
                          {matiere.is_bonus ? (
                            <span className="text-sm font-black text-indigo-600">+{matiere.points_bonus?.toFixed(1)} pts</span>
                          ) : (
                            <>
                              <span className="text-sm font-black text-slate-800">
                                {bulletin.niveau?.cycle === 'primaire' 
                                  ? (matiere.moyenne / 2).toFixed(1)
                                  : matiere.moyenne.toFixed(1)
                                }
                              </span>
                              <span className="text-[9px] font-bold text-slate-400">/{bulletin.niveau?.cycle === 'primaire' ? '10' : '20'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {bulletin.matieres.length > 6 && (
                      <div className="bg-slate-100/50 rounded-xl p-3 border border-dashed border-slate-300 flex items-center justify-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          +{bulletin.matieres.length - 6} autres
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : selectedClasse ? (
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-24 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
             <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-pulse" />
             <FileText className="w-10 h-10 text-slate-300 relative z-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Aucun bulletin disponible</h3>
          <p className="text-base text-slate-400 font-medium max-w-sm mx-auto">
            Les notes n&apos;ont pas encore été saisies pour cette classe et ce trimestre.
          </p>
        </div>
      ) : null}
    </div>
  )
}
