'use client'

// src/components/StudentCard.tsx
import { useEffect, useState, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase, Eleve, Note, Ecole } from '@/lib/supabase'
import {
  User, Award, BookOpen, Loader2,
  Printer, X, ChevronDown
} from 'lucide-react'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface StudentCardProps {
  eleveId:     string
  onClose?:    () => void
  defaultTab?: 'card' | 'qr'
}

interface MoyenneParMatiere {
  matiere:     string
  moyenne:     number
  coefficient: number
}

// ─────────────────────────────────────────
// Weighted average calculation
// ─────────────────────────────────────────
function calculateWeightedAverage(notes: Note[]): number {
  if (notes.length === 0) return 0
  const sumProd = notes.reduce((acc, n) => {
    const bareme = (n.evaluation as any)?.bareme || 20
    const noteSur20 = (n.note / bareme) * 20
    return acc + noteSur20 * n.coefficient
  }, 0)
  const sumCoeff = notes.reduce((acc, n) => acc + n.coefficient, 0)
  if (sumCoeff === 0) return 0
  return Math.round((sumProd / sumCoeff) * 100) / 100
}

function groupByMatiere(notes: Note[]): MoyenneParMatiere[] {
  const map = new Map<string, Note[]>()
  for (const n of notes) {
    if (!map.has(n.matiere)) map.set(n.matiere, [])
    map.get(n.matiere)!.push(n)
  }
  const result: MoyenneParMatiere[] = []
  map.forEach((ns, matiere) => {
    result.push({
      matiere,
      moyenne:     calculateWeightedAverage(ns),
      coefficient: ns[0].coefficient,
    })
  })
  return result.sort((a, b) => a.matiere.localeCompare(b.matiere))
}

function MentionBadge({ moyenne, isPrimary }: { moyenne: number, isPrimary?: boolean }) {
  let label = 'Insuffisant'
  let className = 'bg-red-100 text-red-600'
  
  if (isPrimary) {
    if (moyenne >= 8)      { label = 'Très bien';   className = 'bg-emerald-100 text-emerald-700' }
    else if (moyenne >= 7) { label = 'Bien';         className = 'bg-teal-100 text-teal-700' }
    else if (moyenne >= 6) { label = 'Assez bien';   className = 'bg-blue-100 text-blue-700' }
    else if (moyenne >= 5) { label = 'Passable';     className = 'bg-amber-100 text-amber-700' }
  } else {
    if (moyenne >= 16)      { label = 'Très bien';   className = 'bg-emerald-100 text-emerald-700' }
    else if (moyenne >= 14) { label = 'Bien';         className = 'bg-teal-100 text-teal-700' }
    else if (moyenne >= 12) { label = 'Assez bien';   className = 'bg-blue-100 text-blue-700' }
    else if (moyenne >= 10) { label = 'Passable';     className = 'bg-amber-100 text-amber-700' }
  }

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────
// Physical Card (UI preview)
// ─────────────────────────────────────────
function PhysicalCard({ eleve, ecole, classeNom, isPrint = false }: {
  eleve: Eleve
  ecole: Ecole | null
  classeNom: string
  isPrint?: boolean
}) {
  const prenom = eleve.prenom || '—'
  const nom = eleve.nom || '—'
  const matricule = eleve.matricule || 'N/A'
  const dateNaissance = eleve.date_naissance
    ? new Date(eleve.date_naissance).toLocaleDateString('fr-FR')
    : null
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${eleve.id || 'no-id'}`

  return (
    <div
      id={isPrint ? "student-card-final" : "student-card-preview"}
      className={`relative w-[380px] h-[520px] rounded-[2.5rem] overflow-hidden shadow-2xl bg-[#030712] text-white select-none flex flex-col border-[6px] border-[#0F172A] ${isPrint ? 'print-card' : ''}`}
      style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
    >
      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-[#030712] to-[#030712]" />
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
          backgroundSize: '32px 32px' 
        }} 
      />
      
      {/* Animated Gradient Accent */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

      {/* Header Section */}
      <div className="relative pt-8 px-8 pb-4 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/20 mb-3 border border-emerald-400/30">
          <BookOpen className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-sm font-black tracking-[0.2em] text-emerald-400 uppercase text-center mb-0.5">
          {ecole?.nom ?? 'EXCELLENCE ACADEMY'}
        </h1>
        <div className="flex items-center gap-2">
          <div className="h-px w-6 bg-slate-700" />
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-medium">
            Student Identity Card
          </p>
          <div className="h-px w-6 bg-slate-700" />
        </div>
      </div>

      {/* Center Section: Photo & Identity */}
      <div className="relative flex-1 px-8 flex flex-col items-center justify-center">
        {/* Photo with Premium Border */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 bg-gradient-to-b from-amber-500/20 to-transparent rounded-[2rem] blur-xl opacity-50" />
          <div className="relative w-32 h-40 bg-slate-900 rounded-[1.5rem] p-1 border border-slate-700 overflow-hidden shadow-2xl">
            {eleve.photo_url ? (
              <img
                src={eleve.photo_url}
                alt={`${prenom} ${nom}`}
                className="w-full h-full object-cover rounded-[1.25rem]"
              />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center rounded-[1.25rem]">
                <User className="w-16 h-16 text-slate-600" />
              </div>
            )}
            {/* Holographic Overlays */}
            <div className="absolute top-2 right-2 w-6 h-6 bg-white/10 rounded-full blur-[2px]" />
          </div>
        </div>

        {/* Identity Details */}
        <div className="text-center space-y-1">
          <p className="text-2xl font-black text-white leading-tight tracking-tight uppercase">
            {prenom}
          </p>
          <p className="text-3xl font-black text-white leading-none tracking-tight uppercase mb-4">
            {nom}
          </p>
        </div>

        {/* Specific Information Grid */}
        <div className="w-full grid grid-cols-2 gap-4 mt-4 py-4 px-2 border-y border-slate-800/50">
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Matricule</span>
            <span className="text-xs font-mono font-black text-amber-500 tracking-wider">#{matricule.replace('EM-', '')}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Grade/Classe</span>
            <span className="text-xs font-black text-white uppercase">{classeNom}</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: QR & Security */}
      <div className="relative pt-4 pb-8 px-8 bg-gradient-to-t from-emerald-950/20 to-transparent">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 space-y-1.5">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Official Credential</p>
            <p className="text-[9px] text-slate-400 leading-relaxed font-semibold">
              Scan for digital validation of student status and attendance records.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[8px] text-slate-500 font-bold uppercase">Valid Until</span>
              <span className="text-[9px] font-black text-slate-300">JUNE {new Date().getFullYear() + 1}</span>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-2 bg-emerald-500/20 rounded-2xl blur-md opacity-50" />
            <div className="relative bg-white p-2 rounded-2xl shadow-lg border border-white/20">
              {isPrint ? (
                <img src={qrUrl} alt="QR Code" className="w-[84px] h-[84px]" />
              ) : (
                <QRCodeCanvas
                  value={eleve.id || 'no-id'}
                  size={84}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#030712"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security Watermark */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-black text-white/5 uppercase tracking-[0.5em] pointer-events-none rotate-[-12deg] scale-[2] whitespace-nowrap">
        OFFICIAL DOCUMENT OFFICIAL DOCUMENT
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Print card in a dedicated popup window
// ─────────────────────────────────────────
function printCard(eleve: Eleve, ecole: Ecole | null, classeNom: string, qrValue: string) {
  const prenom = eleve.prenom || '—'
  const nom = eleve.nom || '—'
  const matricule = eleve.matricule || 'N/A'
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrValue}`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Carte — ${prenom} ${nom}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'Outfit', system-ui, -apple-system, sans-serif;
    }

    .card {
      position: relative;
      width: 380px;
      height: 520px;
      border-radius: 40px;
      overflow: hidden;
      background: #030712;
      color: white;
      display: flex;
      flex-direction: column;
      border: 8px solid #0F172A;
      box-shadow: 0 40px 80px rgba(0,0,0,0.5);
    }

    .bg-gradient {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at top right, #064e3b66, #030712, #030712);
    }

    .bg-pattern {
      position: absolute;
      inset: 0;
      opacity: 0.05;
      background-image: radial-gradient(circle at 1px 1px, #fff 1px, transparent 0);
      background-size: 32px 32px;
    }

    .header {
      position: relative;
      padding: 32px 32px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .icon-box {
      width: 56px; height: 56px;
      background: linear-gradient(135deg, #10b981, #047857);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 12px;
      box-shadow: 0 10px 15px -3px rgba(6, 78, 59, 0.4);
    }

    .school-name {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #34d399;
      text-align: center;
      margin-bottom: 4px;
    }

    .subtitle {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3em;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .subtitle::before, .subtitle::after {
      content: "";
      height: 1px; width: 24px;
      background: #334155;
    }

    .content {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 32px;
    }

    .photo-area {
      position: relative;
      margin-bottom: 24px;
    }

    .photo-shadow {
      position: absolute;
      inset: -8px;
      background: #f59e0b33;
      border-radius: 32px;
      filter: blur(20px);
    }

    .photo {
      position: relative;
      width: 128px; height: 160px;
      background: #0f172a;
      border-radius: 24px;
      padding: 4px;
      border: 1px solid #334155;
      overflow: hidden;
    }

    .photo img {
      width: 100%; height: 100%;
      object-fit: cover;
      border-radius: 20px;
    }

    .photo-placeholder {
      width: 100%; height: 100%;
      background: #1e293b;
      display: flex; align-items: center; justify-content: center;
      border-radius: 20px;
      color: #475569;
      font-size: 32px;
      font-weight: 900;
    }

    .names { text-align: center; margin-bottom: 20px; }
    .prenom {
      font-size: 24px;
      font-weight: 900;
      color: white;
      text-transform: uppercase;
      letter-spacing: -0.02em;
    }
    .nom {
      font-size: 32px;
      font-weight: 900;
      color: white;
      text-transform: uppercase;
      line-height: 0.8;
      margin-top: 4px;
    }

    .stats {
      width: 100%;
      padding: 16px 0;
      border-top: 1px solid #1e293b88;
      border-bottom: 1px solid #1e293b88;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat-label { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 6px; }
    .stat-value { font-size: 13px; font-weight: 900; color: white; text-transform: uppercase; }
    .stat-value.gold { color: #f59e0b; font-family: monospace; letter-spacing: 0.1em; }

    .footer {
      position: relative;
      padding: 16px 32px 32px;
      background: linear-gradient(0deg, #064e3b1a, transparent);
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .footer-info { flex: 1; }
    .footer-title { font-size: 10px; font-weight: 900; color: #10b981; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 6px; }
    .footer-desc { font-size: 9px; color: #94a3b8; font-weight: 600; line-height: 1.5; }
    
    .valid-thru { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .valid-label { font-size: 8px; font-weight: 900; color: #475569; text-transform: uppercase; }
    .valid-date { font-size: 9px; font-weight: 900; color: #cbd5e1; }

    .qr-container {
      position: relative;
    }
    .qr-shadow {
      position: absolute;
      inset: -8px;
      background: #10b98133;
      border-radius: 16px;
      filter: blur(12px);
    }
    .qr-card {
      position: relative;
      background: white;
      padding: 8px;
      border-radius: 16px;
      width: 100px;
      height: 100px;
    }
    .qr-card img { width: 100%; height: 100%; }

    @media print {
      body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card { box-shadow: none; border: 4px solid #0F172A; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="bg-gradient"></div>
    <div class="bg-pattern"></div>
    
    <div class="header">
      <div class="icon-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
      </div>
      <div class="school-name">${ecole?.nom ?? 'EXCELLENCE ACADEMY'}</div>
      <div class="subtitle">Student Identity Card</div>
    </div>

    <div class="content">
      <div class="photo-area">
        <div class="photo-shadow"></div>
        <div class="photo">
          ${eleve.photo_url
            ? `<img src="${eleve.photo_url}" alt="${prenom}" crossorigin="anonymous" />`
            : `<div class="photo-placeholder">${prenom[0] ?? ''}${nom[0] ?? ''}</div>`
          }
        </div>
      </div>

      <div class="names">
        <div class="prenom">${prenom}</div>
        <div class="nom">${nom}</div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-label">Matricule</div>
          <div class="stat-value gold">#${matricule.replace('EM-', '')}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Grade/Classe</div>
          <div class="stat-value">${classeNom}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-info">
        <div class="footer-title">Official Credential</div>
        <div class="footer-desc">Scan for digital validation of student status and attendance records.</div>
        <div class="valid-thru">
          <span class="valid-label">Valid Until</span>
          <span class="valid-date">JUNE ${new Date().getFullYear() + 1}</span>
        </div>
      </div>
      <div class="qr-container">
        <div class="qr-shadow"></div>
        <div class="qr-card">
          <img src="${qrUrl}" alt="QR" />
        </div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      // Small timeout to ensure QR image is loaded before printing
      setTimeout(() => {
        window.print();
        window.close();
      }, 500);
    }
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=520,height=500')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
export default function StudentCard({ eleveId, onClose, defaultTab }: StudentCardProps) {
  const [eleve, setEleve]         = useState<Eleve | null>(null)
  const [notes, setNotes]         = useState<Note[]>([])
  const [loading, setLoading]     = useState(true)
  const [trimestre, setTrimestre] = useState<1 | 2 | 3>(1)
  const [ecole, setEcole]         = useState<Ecole | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [eleveId])

  useEffect(() => {
    if (defaultTab === 'qr' && cardRef.current) {
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
    }
  }, [defaultTab, eleve])

  async function loadData() {
    try {
      const [{ data: eleveData }, { data: notesData }] = await Promise.all([
        supabase
          .from('eleves')
          .select('*, classe:classes(nom_classe, niveau, niveau_info:niveaux(cycle))')
          .eq('id', eleveId)
          .single(),
        supabase
          .from('notes')
          .select(`
            *,
            evaluation:evaluations(
              trimestre,
              coef,
              bareme,
              matiere:matieres(nom)
            )
          `)
          .eq('eleve_id', eleveId),
      ])

      if (eleveData) {
        setEleve(eleveData as Eleve)
        if (eleveData.ecole_id) {
          const { data: ecoleData } = await supabase
            .from('ecoles')
            .select('*')
            .eq('id', eleveData.ecole_id)
            .single()
          setEcole((ecoleData ?? null) as Ecole | null)
        }
      }

      const mappedNotes = (notesData ?? []).map((n: any) => ({
        ...n,
        trimestre:   n.evaluation?.trimestre ?? 1,
        coefficient: n.evaluation?.coef      ?? 1,
        matiere:     n.evaluation?.matiere?.nom ?? 'Inconnue',
      }))
      setNotes(mappedNotes)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!eleve) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm">
          Élève introuvable.
        </div>
      </div>
    )
  }

  const isPrimary        = (eleve as any).classe?.niveau_info?.cycle === 'primaire'
  const notesDuTrimestre = notes.filter((n) => n.trimestre === trimestre)
  let moyenneGenerale    = calculateWeightedAverage(notesDuTrimestre)
  let parMatiere         = groupByMatiere(notesDuTrimestre)

  if (isPrimary) {
    moyenneGenerale = moyenneGenerale / 2
    parMatiere = parMatiere.map(m => ({ ...m, moyenne: m.moyenne / 2 }))
  }

  const classeNom = (eleve as any).classe?.nom_classe ?? '—'

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">

          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-800">
                {eleve.prenom} {eleve.nom}
              </h2>
              {eleve.matricule && (
                <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                  {eleve.matricule}
                </span>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-6 space-y-6">

            {/* Card + QR */}
            <div ref={cardRef} className="flex flex-col gap-4 items-center justify-center py-6 bg-slate-50/50 rounded-2xl border border-slate-100">
              {/* Infos rapides au-dessus de la carte */}
              <div className="flex items-center gap-6 text-sm text-slate-600 px-4">
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom complet</p>
                  <p className="font-bold text-slate-900">{eleve.prenom} {eleve.nom}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Matricule</p>
                  <p className="font-mono font-bold text-amber-600">{eleve.matricule ?? 'N/A'}</p>
                </div>
                {eleve.date_naissance && (
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date de naissance</p>
                    <p className="font-bold text-slate-900">
                      {new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classe</p>
                  <p className="font-bold text-emerald-600">{classeNom}</p>
                </div>
              </div>

              <PhysicalCard eleve={eleve} ecole={ecole} classeNom={classeNom} />

              <button
                onClick={() => printCard(eleve, ecole, classeNom, eleve.id)}
                className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 px-6 py-3 rounded-xl transition-all shadow-sm w-full sm:w-auto"
              >
                <Printer className="w-5 h-5" />
                Imprimer la carte physique
              </button>
            </div>

            {/* Notes section */}
            <div className="bg-slate-50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="font-semibold text-slate-800">Notes & Moyennes</h3>
                <div className="relative">
                  <select
                    value={trimestre}
                    onChange={(e) => setTrimestre(Number(e.target.value) as 1|2|3)}
                    className="appearance-none bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value={1}>1er Trimestre</option>
                    <option value={2}>2ème Trimestre</option>
                    <option value={3}>3ème Trimestre</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {parMatiere.length > 0 && (
                <div className="bg-white rounded-xl p-4 flex items-center gap-4 mb-4 shadow-sm border border-slate-100">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-800">
                      {moyenneGenerale.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-400">/ {isPrimary ? '10' : '20'}</p>
                  </div>
                  <div>
                    <MentionBadge moyenne={moyenneGenerale} isPrimary={isPrimary} />
                    <p className="text-xs text-slate-500 mt-1">Moyenne générale pondérée</p>
                  </div>
                </div>
              )}

              {parMatiere.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  Aucune note pour ce trimestre.
                </p>
              ) : (
                <div className="space-y-2">
                  {parMatiere.map((m) => (
                    <div
                      key={m.matiere}
                      className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-slate-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{m.matiere}</p>
                        <p className="text-xs text-slate-400">Coeff. {m.coefficient}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-slate-800">{m.moyenne.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">/ {isPrimary ? '10' : '20'}</p>
                      </div>
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 shrink-0">
                        <div
                          className={`h-1.5 rounded-full transition-all ${m.moyenne >= (isPrimary ? 5 : 10) ? 'bg-emerald-500' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(100, (m.moyenne / (isPrimary ? 10 : 20)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}