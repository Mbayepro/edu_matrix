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
function PhysicalCard({ eleve, ecole, classeNom }: {
  eleve: Eleve
  ecole: Ecole | null
  classeNom: string
}) {
  const prenom = eleve.prenom || '—'
  const nom = eleve.nom || '—'
  const matricule = eleve.matricule || 'N/A'
  const dateNaissance = eleve.date_naissance
    ? new Date(eleve.date_naissance).toLocaleDateString('fr-FR')
    : null

  return (
    <div
      id="student-card-print"
      className="relative w-[380px] rounded-3xl overflow-hidden shadow-2xl bg-[#0B132B] text-white select-none flex flex-col"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Header strip */}
      <div className="relative bg-emerald-600 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-black tracking-widest uppercase text-white leading-none">
            {ecole?.nom ?? 'EXCELLENCE'}
          </p>
          <p className="text-[9px] text-emerald-100 uppercase tracking-[0.2em] mt-1">
            Carte d'Étudiant
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] font-black text-white/90">EduMatrix</p>
          <p className="text-[10px] text-white/70">{new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Body */}
      <div className="relative px-6 py-6 flex gap-5">
        {/* Photo */}
        <div className="shrink-0 relative">
          <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500 to-transparent rounded-2xl blur opacity-30" />
          {eleve.photo_url ? (
            <img
              src={eleve.photo_url}
              alt={`${prenom} ${nom}`}
              className="relative w-24 h-28 object-cover rounded-xl border-2 border-slate-700 bg-slate-800 shadow-inner"
            />
          ) : (
            <div className="relative w-24 h-28 bg-slate-800 rounded-xl border-2 border-slate-700 flex items-center justify-center shadow-inner">
              <User className="w-10 h-10 text-slate-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-3">
          <div>
            <p className="text-xl font-black leading-tight text-white tracking-tight">
              {prenom} {nom}
            </p>
            {ecole?.ville && (
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-widest font-semibold">
                {ecole.ville}
              </p>
            )}
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest w-16">Classe</span>
              <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">{classeNom}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest w-16">Matricule</span>
              <span className="text-xs font-mono font-bold text-amber-400">{matricule}</span>
            </div>
            {dateNaissance && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest w-16">Né(e) le</span>
                <span className="text-xs text-slate-300 font-semibold">{dateNaissance}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code section */}
      <div className="mt-auto px-6 py-5 bg-slate-900/50 flex items-center gap-5 border-t border-slate-800">
        <div className="bg-white p-2 rounded-xl shrink-0 shadow-lg ring-4 ring-slate-800">
          <QRCodeCanvas
            value={eleve.id || 'no-id'}
            size={80}
            level="M"
            bgColor="#ffffff"
            fgColor="#0B132B"
          />
        </div>
        <div>
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1.5">Badge Officiel</p>
          <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
            Ce QR code permet à l'établissement de contrôler l'accès, les présences et les règlements.
          </p>
        </div>
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
  const dateNaissance = eleve.date_naissance
    ? new Date(eleve.date_naissance).toLocaleDateString('fr-FR')
    : null

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Carte — ${prenom} ${nom}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .card {
      width: 380px;
      border-radius: 24px;
      overflow: hidden;
      background: #0B132B;
      color: white;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .header {
      background: #059669;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon {
      width: 32px; height: 32px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .school-name {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: white;
    }
    .card-type {
      font-size: 9px;
      color: #a7f3d0;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      margin-top: 4px;
    }
    .header-right { margin-left: auto; text-align: right; }
    .header-right p { font-size: 10px; color: rgba(255,255,255,0.8); }

    .body {
      padding: 24px;
      display: flex;
      gap: 20px;
    }
    .photo {
      width: 96px; height: 112px;
      border-radius: 12px;
      overflow: hidden;
      border: 2px solid #334155;
      background: #1e293b;
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .photo-placeholder {
      font-size: 32px;
      color: #64748b;
      font-weight: 900;
    }
    .info { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
    .student-name {
      font-size: 20px;
      font-weight: 900;
      color: white;
      line-height: 1.2;
    }
    .city {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-weight: 600;
      margin-top: 4px;
    }
    .fields { display: flex; flex-direction: column; gap: 6px; }
    .field { display: flex; align-items: center; gap: 8px; }
    .field-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-weight: 700;
      width: 64px;
      flex-shrink: 0;
    }
    .field-classe {
      font-size: 11px;
      font-weight: 900;
      color: #34d399;
      background: rgba(52,211,153,0.1);
      padding: 2px 8px;
      border-radius: 6px;
    }
    .field-matricule {
      font-size: 11px;
      font-weight: 700;
      color: #fbbf24;
      font-family: monospace;
    }
    .field-date {
      font-size: 11px;
      font-weight: 600;
      color: #cbd5e1;
    }

    .qr-section {
      background: rgba(0,0,0,0.25);
      border-top: 1px solid #1e293b;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .qr-box {
      background: white;
      padding: 8px;
      border-radius: 12px;
      flex-shrink: 0;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-label {
      font-size: 10px;
      font-weight: 700;
      color: #10b981;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 6px;
    }
    .qr-desc {
      font-size: 10px;
      color: #64748b;
      line-height: 1.5;
    }

    @media print {
      body { background: white; }
      .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-icon">📚</div>
      <div>
        <p class="school-name">${ecole?.nom ?? 'EXCELLENCE'}</p>
        <p class="card-type">Carte d'Étudiant</p>
      </div>
      <div class="header-right">
        <p style="font-weight:900">EduMatrix</p>
        <p>${new Date().getFullYear()}</p>
      </div>
    </div>

    <div class="body">
      <div class="photo">
        ${eleve.photo_url
          ? `<img src="${eleve.photo_url}" alt="${prenom} ${nom}" crossorigin="anonymous" />`
          : `<span class="photo-placeholder">${(prenom[0] ?? '?').toUpperCase()}</span>`
        }
      </div>
      <div class="info">
        <div>
          <div class="student-name">${prenom} ${nom}</div>
          ${ecole?.ville ? `<div class="city">${ecole.ville}</div>` : ''}
        </div>
        <div class="fields">
          <div class="field">
            <span class="field-label">Classe</span>
            <span class="field-classe">${classeNom}</span>
          </div>
          <div class="field">
            <span class="field-label">Matricule</span>
            <span class="field-matricule">${matricule}</span>
          </div>
          ${dateNaissance ? `
          <div class="field">
            <span class="field-label">Né(e) le</span>
            <span class="field-date">${dateNaissance}</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <div class="qr-section">
      <div class="qr-box" id="qr-container"></div>
      <div>
        <p class="qr-label">Badge Officiel</p>
        <p class="qr-desc">Ce QR code permet à l'établissement de contrôler l'accès, les présences et les règlements.</p>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() { window.print(); window.close(); }
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