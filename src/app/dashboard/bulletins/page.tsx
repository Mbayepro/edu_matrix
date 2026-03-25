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
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

export default function BulletinsPage() {
  const [ecoleId, setEcoleId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)
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

  // Professeur : uniquement ses classes assignées
  const { classeIds: teacherClasseIds, loading: teacherLoading } = useTeacherClasses(
    isTeacher ? profileId : null
  )

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
      if (isTeacher && teacherLoading) return
      Promise.all([loadEcole(), loadClasses()]).finally(() => {
        setLoading(false)
      })
    }
  }, [ecoleId, isTeacher, teacherLoading, teacherClasseIds.join(',')])

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
      .select('id, ecole_id, role')
      .eq('user_id', user.id)
      .single()
    
    if (prof?.ecole_id) {
      setEcoleId(prof.ecole_id)
      setProfileId(prof.id)
      setIsTeacher(prof.role === 'teacher')
    } else {
      setLoading(false)
    }
  }

  async function loadEcole() {
    if (!ecoleId) return
    const { data } = await supabase.from('ecoles').select('*').eq('id', ecoleId).single()
    setEcole(data)
  }

  async function loadClasses() {
    if (!ecoleId) return
    if (isTeacher) {
      if (teacherClasseIds.length === 0) {
        setClasses([])
        return
      }
      const { data } = await supabase.from('classes').select('*').in('id', teacherClasseIds).order('nom_classe')
      setClasses(data ?? [])
    } else {
      const { data } = await supabase.from('classes').select('*').eq('ecole_id', ecoleId).order('nom_classe')
      setClasses(data ?? [])
    }
  }

  async function loadBulletins() {
    if (!selectedClasse || !selectedTrimestre) return
    setLoadingBulletins(true)
    setErrorMsg(null)
    try {
      const bulletinsData = await CalculateurMoyennes.genererBulletinsClasse(selectedClasse, selectedTrimestre, anneeScolaire)
      setBulletins(bulletinsData)
      if (bulletinsData.length > 0 && bulletinsData.filter(b => b.matieres.length > 0).length > 0) {
        showToast(`${bulletinsData.length} bulletins calculés.`, 'success')
      }
    } catch (error: any) {
      console.error(error)
      setErrorMsg(error.message || 'Erreur lors du calcul')
      setBulletins([])
    } finally {
      setLoadingBulletins(false)
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
        setTimeout(() => { printWindow.print() }, 1000)
      }
    } finally {
      setGenerating(null)
    }
  }

  async function generateAllBulletinsPDF() {
    if (bulletins.length === 0) return
    setGenerating('all')
    try {
      let combinedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Bulletins de la classe ${classes.find(c => c.id === selectedClasse)?.nom_classe}</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Inter:wght@400;700;900&display=swap');
              body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #fff; }
              @media print {
                  body { background: white; padding: 0; }
                  .bulletin-page { page-break-after: always; padding: 0; }
                  .bulletin-page:last-child { page-break-after: auto; }
              }
              .bulletin-page { padding: 40px; margin: 0 auto; }
              .bulletin { max-width: 850px; margin: 0 auto; background: white; padding: 40px; border: 1.5px solid #000; position: relative; color: #000; }
              .header-section { display: flex; align-items: flex-start; margin-bottom: 25px; gap: 20px; }
              .logo { max-width: 90px; height: auto; }
              .header-center { flex: 1; text-align: center; }
              .school-name { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #000; }
              .header-line { height: 2px; background: #000; width: 60%; margin: 8px auto; }
              .bulletin-title { font-family: 'Dancing Script', cursive; font-size: 32px; color: #000; margin: 10px 0; }
              .info-boxes { display: flex; gap: 20px; margin-bottom: 30px; }
              .info-box { flex: 1; border: 1.5px solid #000; border-radius: 8px; padding: 12px 15px; }
              .info-box p { margin: 4px 0; font-size: 12px; }
              .grades-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1.5px solid #000; }
              .grades-table th { background: #f8fafc; border: 1.5px solid #000; padding: 8px; font-size: 11px; text-transform: uppercase; font-weight: 900; }
              .grades-table td { border: 1.5px solid #000; padding: 6px 10px; font-size: 12px; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .final-average-box { display: flex; align-items: center; gap: 15px; padding: 10px 20px; border: 2.5px solid #000; border-radius: 4px; float: right; }
              .avg-label { font-size: 14px; font-weight: 800; }
              .avg-value { font-size: 20px; font-weight: 900; }
              .appreciation-footer { display: flex; gap: 20px; clear: both; margin-top: 30px; }
              .app-box { flex: 1; border: 1.5px solid #000; border-radius: 8px; padding: 15px; font-size: 11px; }
              .footer-right { width: 220px; text-align: center; }
              .signer-title { font-weight: 900; text-decoration: underline; margin-bottom: 10px; }
              .stamp-area { height: 100px; position: relative; display: flex; align-items: center; justify-content: center; }
              .stamp { max-height: 90px; opacity: 0.8; transform: rotate(-5deg); position: absolute; }
              .signature { max-height: 50px; position: absolute; z-index: 2; }
          </style>
      </head>
      <body>
      `;
      for (const bulletin of bulletins) {
        const bodyContent = generateBulletinHTML(bulletin, true)
        combinedHtml += `<div class="bulletin-page">${bodyContent}</div>`
      }
      combinedHtml += `</body></html>`
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(combinedHtml)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => { printWindow.print() }, 1500)
      }
    } finally {
      setGenerating(null)
    }
  }

  function generateBulletinHTML(bulletin: BulletinData, insideCombined: boolean = false): string {
    const displayMoyenneTotal = bulletin.niveau?.cycle === 'primaire' ? bulletin.moyenne_generale / 2 : bulletin.moyenne_generale;

    const content = `
    <div class="bulletin">
        <div class="header-section">
            <div class="header-left">
                ${ecole?.logo_url ? `<img src="${ecole.logo_url}" alt="Logo" class="logo">` : '<div class="logo-placeholder">LOGO</div>'}
            </div>
            <div class="header-center">
                <h1 class="school-name">${ecole?.nom || 'Établissement Scolaire'}</h1>
                <div class="header-line"></div>
                ${ecole?.id ? `<div style="font-size:10px; font-weight:700;">Agréé par l'État - Plateforme EduMatrix</div>` : ''}
                <h2 class="bulletin-title">Bulletin du ${bulletin.trimestre === 1 ? '1<sup>er</sup>' : bulletin.trimestre === 2 ? '2<sup>ème</sup>' : '3<sup>ème</sup>'} Trimestre</h2>
            </div>
        </div>

        <div class="info-boxes">
            <div class="info-box">
                <p><strong>Année Scolaire :</strong> ${bulletin.annee_scolaire}</p>
                <p><strong>Filière / Série :</strong> ${(bulletin.eleve as any).classe?.serie?.nom || 'Enseignement Général'}</p>
                <p><strong>Classe :</strong> ${bulletin.eleve.classe?.nom_classe || 'N/A'}</p>
                <p><strong>Cycle :</strong> ${bulletin.niveau?.cycle === 'primaire' ? 'Élémentaire' : 'Moyen/Secondaire'}</p>
            </div>
            <div class="info-box">
                <p><strong>Prénom & Nom :</strong> ${bulletin.eleve.prenom} ${bulletin.eleve.nom}</p>
                <p><strong>Matricule :</strong> ${bulletin.eleve.matricule || 'Sans'}</p>
                <p><strong>Naissance :</strong> ${bulletin.eleve.date_naissance ? new Date(bulletin.eleve.date_naissance).toLocaleDateString('fr-FR') : '—'}</p>
            </div>
        </div>

        <table class="grades-table">
            <thead>
                <tr>
                    <th style="text-align: left; padding-left: 10px;">Matières</th>
                    <th class="text-center">Dev. 1</th>
                    <th class="text-center">Dev. 2</th>
                    <th class="text-center">Dev. 3</th>
                    <th class="text-center">Comp.</th>
                    <th class="text-center">Coef</th>
                    <th class="text-center">Moyenne</th>
                    <th>Appréciation</th>
                </tr>
            </thead>
            <tbody>
                ${bulletin.matieres.map(matiere => {
                  const d1 = matiere.devoir1 !== undefined ? matiere.devoir1.toFixed(2) : '—';
                  const d2 = matiere.devoir2 !== undefined ? matiere.devoir2.toFixed(2) : '—';
                  const d3 = matiere.devoir3 !== undefined ? matiere.devoir3.toFixed(2) : '—';
                  const comp = matiere.note_examen !== undefined ? matiere.note_examen.toFixed(2) : '—';
                  const weightedMoy = (matiere.moyenne * matiere.coefficient).toFixed(2);
                  return `
                    <tr>
                        <td style="padding-left: 10px;"><strong>${matiere.matiere_nom}</strong></td>
                        <td class="text-center">${d1}</td>
                        <td class="text-center">${d2}</td>
                        <td class="text-center">${d3}</td>
                        <td class="text-center" style="font-weight:bold; background:#fafafa;">${comp}</td>
                        <td class="text-center">${matiere.coefficient}</td>
                        <td class="text-center" style="font-weight:900;">${weightedMoy}</td>
                        <td style="font-size:10px; font-style:italic;">${matiere.appreciation || ''}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
            <tfoot>
                <tr style="background:#f8fafc; font-weight:900;">
                    <td colspan="5" style="text-align:right; padding-right:15px;">TOTAL GÉNÉRAL :</td>
                    <td class="text-center">${bulletin.matieres.reduce((acc, m) => acc + (m.is_bonus ? 0 : m.coefficient), 0)}</td>
                    <td class="text-center">${bulletin.matieres.reduce((acc, m) => acc + (m.moyenne * m.coefficient), 0).toFixed(2)}</td>
                    <td></td>
                </tr>
            </tfoot>
        </table>

        <div style="margin:20px 0; overflow:hidden;">
            <div class="final-average-box">
                <span class="avg-label">MOYENNE DU TRIMESTRE :</span>
                <span class="avg-value">${displayMoyenneTotal.toFixed(2)}</span>
            </div>
        </div>

        <div class="appreciation-footer">
            <div style="flex:1; display:flex; flex-direction:column; gap:10px;">
                <div class="app-box">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px dotted #ccc;">
                        <span><strong>Total Absences:</strong> ${bulletin.attendance?.absences || 0}</span>
                        <span><strong>Total Retards:</strong> ${bulletin.attendance?.retards || 0}</span>
                        <span><strong>Rang:</strong> ${bulletin.rang} / ${bulletin.total_eleves}</span>
                    </div>
                    <div style="margin-top:10px;">
                        <strong>Appréciation :</strong> <span style="font-style:italic; font-weight:700;">${(bulletin.eleve as any).appreciation_trimestre || 'Bon travail.'}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${bulletin.eleve.id}" width="60" height="60">
                    <div style="font-size:8px; color:#999;">Authentifié par EduMatrix <br/> ${bulletin.eleve.id.substring(0,8)}</div>
                </div>
            </div>
            <div class="footer-right">
                <div class="signer-title">Directeur des Études</div>
                <div class="stamp-area">
                    ${ecole?.tampon_url ? `<img src="${ecole.tampon_url}" class="stamp">` : ''}
                    ${ecole?.signature_url ? `<img src="${ecole.signature_url}" class="signature">` : ''}
                </div>
            </div>
        </div>
    </div>`;

    if (insideCombined) return content;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bulletin</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background: #fff; }
        .bulletin { max-width: 850px; margin: 0 auto; padding: 40px; border: 1.5px solid #000; position: relative; }
        .header-section { display: flex; align-items: flex-start; margin-bottom: 25px; gap: 20px; }
        .logo { max-width: 90px; height: auto; }
        .header-center { flex: 1; text-align: center; }
        .school-name { font-size: 18px; font-weight: 900; text-transform: uppercase; }
        .header-line { height: 2px; background: #000; width: 60%; margin: 8px auto; }
        .bulletin-title { font-family: 'Dancing Script', cursive; font-size: 32px; color: #000; margin: 10px 0; }
        .info-boxes { display: flex; gap: 20px; margin-bottom: 30px; }
        .info-box { flex: 1; border: 1.5px solid #000; border-radius: 8px; padding: 12px 15px; }
        .info-box p { margin: 4px 0; font-size: 12px; }
        .grades-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1.5px solid #000; }
        .grades-table th { background: #f8fafc; border: 1.5px solid #000; padding: 8px; font-size: 11px; text-transform: uppercase; font-weight: 900; }
        .grades-table td { border: 1.5px solid #000; padding: 6px 10px; font-size: 12px; }
        .text-center { text-align: center; }
        .final-average-box { display: flex; align-items: center; gap: 15px; padding: 10px 20px; border: 2.5px solid #000; border-radius: 4px; float: right; }
        .avg-label { font-size: 14px; font-weight: 800; }
        .avg-value { font-size: 20px; font-weight: 900; }
        .appreciation-footer { display: flex; gap: 20px; clear: both; margin-top: 30px; }
        .app-box { flex: 1; border: 1.5px solid #000; border-radius: 8px; padding: 15px; font-size: 11px; }
        .footer-right { width: 220px; text-align: center; }
        .signer-title { font-weight: 900; text-decoration: underline; margin-bottom: 10px; }
        .stamp-area { height: 100px; position: relative; display: flex; align-items: center; justify-content: center; }
        .stamp { max-height: 90px; opacity: 0.8; transform: rotate(-5deg); position: absolute; }
        .signature { max-height: 50px; position: absolute; z-index: 2; }
        @media print { body { padding: 0; } .bulletin { border: none; } }
    </style></head><body>${content}</body></html>`;
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bulletins Scolaires</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Générez les bulletins officiels de vos élèves.</p>
        </div>
        {bulletins.length > 0 && (
          <button
            onClick={generateAllBulletinsPDF}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-emerald-600 shadow-lg shadow-slate-900/20"
          >
            {generating === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Tout Imprimer
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Classe / Structure</label>
            <select value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10">
              <option value="">Sélectionner</option>
              {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.nom_classe}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Période scolaire</label>
            <select value={selectedTrimestre} onChange={(e) => setSelectedTrimestre(Number(e.target.value) as 1|2|3)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10">
              <option value={1}>1er Trimestre</option>
              <option value={2}>2ème Trimestre</option>
              <option value={3}>3ème Trimestre</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Année Scolaire</label>
            <select value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10">
              {anneesScolaires.map(an => <option key={an} value={an}>{an}</option>)}
            </select>
          </div>
        </div>
      </div>

      {bulletins.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {bulletins.map((bulletin) => (
            <div key={bulletin.eleve.id} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">{bulletin.eleve.prenom[0]}</div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">{bulletin.eleve.prenom} {bulletin.eleve.nom}</h3>
                    <p className="text-[10px] font-black uppercase text-slate-400">{bulletin.eleve.matricule || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-slate-400">Moyenne</p>
                    <p className="text-xl font-black text-slate-900">{(bulletin.niveau?.cycle === 'primaire' ? bulletin.moyenne_generale / 2 : bulletin.moyenne_generale).toFixed(2)}</p>
                  </div>
                  <button onClick={() => generateBulletinPDF(bulletin)} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-emerald-600/20">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
