'use client'

import { useEffect, useState } from 'react'
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
} from 'lucide-react'

export default function BulletinsPage() {
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [ecole, setEcole] = useState<Ecole | null>(null)
  const [classes, setClasses] = useState<Classe[]>([])
  const [selectedClasse, setSelectedClasse] = useState<string>('')
  const [selectedTrimestre, setSelectedTrimestre] = useState<1 | 2 | 3>(1)
  const [bulletins, setBulletins] = useState<BulletinData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBulletins, setLoadingBulletins] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

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
    if (selectedClasse && selectedTrimestre) {
      loadBulletins()
    }
  }, [selectedClasse, selectedTrimestre])

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
    try {
      const bulletinsData = await CalculateurMoyennes.genererBulletinsClasse(
        selectedClasse,
        selectedTrimestre,
        '2024-2025'
      )
      setBulletins(bulletinsData)
    } catch (error) {
      console.error('Erreur lors du chargement des bulletins:', error)
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
      annee_scolaire: '2024-2025',
    }
  }

  async function generateBulletinPDF(bulletin: BulletinData) {
    setGenerating(bulletin.eleve.id)
    
    try {
      // This would integrate with a PDF generation library
      // For now, we'll create a simple HTML representation
      const html = generateBulletinHTML(bulletin)
      
      // Create download link
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Bulletin_${bulletin.eleve.prenom}_${bulletin.eleve.nom}_T${bulletin.trimestre}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(null)
    }
  }

  function generateBulletinHTML(bulletin: BulletinData): string {
    const getMentionColor = (mention: string) => {
      switch (mention) {
        case 'Très bien': return '#10b981'
        case 'Bien': return '#3b82f6'
        case 'Assez bien': return '#f59e0b'
        case 'Passable': return '#f97316'
        default: return '#ef4444'
      }
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bulletin Scolaire</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .bulletin { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
        .header h1 { color: #1f2937; margin: 0; font-size: 24px; }
        .header h2 { color: #6b7280; margin: 5px 0 0 0; font-size: 16px; font-weight: normal; }
        .student-info { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9fafb; padding: 20px; border-radius: 8px; }
        .student-info h3 { color: #374151; margin: 0 0 10px 0; }
        .student-info p { margin: 5px 0; color: #6b7280; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .table th, .table td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        .table th { background: #f3f4f6; font-weight: bold; color: #374151; }
        .table tr:nth-child(even) { background: #f9fafb; }
        .moyenne { text-align: center; font-weight: bold; }
        .mention { text-align: center; font-weight: bold; padding: 8px; border-radius: 4px; color: white; }
        .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px; }
        .logo { max-width: 100px; margin-bottom: 20px; }
    </style>
</head>
<body>
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
                </tr>
            </thead>
            <tbody>
                ${bulletin.matieres.map(matiere => `
                    <tr>
                        <td>${matiere.matiere_nom}</td>
                        <td>${matiere.coefficient}</td>
                        <td class="moyenne">${matiere.moyenne} / ${matiere.bareme}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <div>
                <h3 style="margin: 0; color: #374151;">Moyenne Générale</h3>
                <p style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0;">
                    ${bulletin.moyenne_generale} / 20
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
    </div>
</body>
</html>
    `
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-800">Bulletins scolaires</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Classe</label>
            <select
              value={selectedClasse}
              onChange={(e) => setSelectedClasse(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Choisir une classe</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.nom_classe}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Trimestre</label>
            <select
              value={selectedTrimestre}
              onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={1}>Trimestre 1</option>
              <option value={2}>Trimestre 2</option>
              <option value={3}>Trimestre 3</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-xs text-slate-500">
              {bulletins.length > 0 && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {bulletins.length} bulletin{bulletins.length > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Moyenne: {(bulletins.reduce((sum, b) => sum + b.moyenne_generale, 0) / bulletins.length).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulletins List */}
      {loadingBulletins ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : bulletins.length > 0 ? (
        <div className="space-y-4">
          {bulletins.map((bulletin) => (
            <div key={bulletin.eleve.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                    {bulletin.eleve.prenom[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {bulletin.eleve.prenom} {bulletin.eleve.nom}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {bulletin.eleve.matricule} • {selectedClasseData?.nom_classe}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Moyenne</div>
                    <div className="text-lg font-bold text-slate-800">
                      {(bulletin.niveau?.cycle === 'primaire' ? bulletin.moyenne_generale / 2 : bulletin.moyenne_generale).toFixed(2)}/{bulletin.niveau?.cycle === 'primaire' ? '10' : '20'}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Mention</div>
                    <div className={`text-sm font-semibold px-3 py-1 rounded-full text-white ${
                      bulletin.mention === 'Très bien' ? 'bg-emerald-600' :
                      bulletin.mention === 'Bien' ? 'bg-blue-600' :
                      bulletin.mention === 'Assez bien' ? 'bg-amber-600' :
                      bulletin.mention === 'Passable' ? 'bg-orange-600' :
                      'bg-red-600'
                    }`}>
                      {bulletin.mention}
                    </div>
                  </div>

                  <button
                    onClick={() => generateBulletinPDF(bulletin)}
                    disabled={generating === bulletin.eleve.id}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generating === bulletin.eleve.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        PDF
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Subjects preview */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Détail des matières
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {bulletin.matieres.slice(0, 6).map((matiere, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{matiere.matiere_nom}</div>
                      <div className="text-sm font-semibold text-slate-800">
                        {bulletin.niveau?.cycle === 'primaire' 
                          ? (matiere.moyenne / 2).toFixed(2) + '/10'
                          : matiere.moyenne.toFixed(2) + '/20'
                        }
                      </div>
                      <div className="text-xs text-slate-400">
                        Coef: {matiere.coefficient}
                      </div>
                    </div>
                  ))}
                  {bulletin.matieres.length > 6 && (
                    <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-center">
                      <span className="text-xs text-slate-400">
                        +{bulletin.matieres.length - 6} autres
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : selectedClasse ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Aucun bulletin disponible
          </h3>
          <p className="text-sm text-slate-400">
            Les notes n'ont pas encore été saisies pour cette classe et ce trimestre.
          </p>
        </div>
      ) : null}
    </div>
  )
}
