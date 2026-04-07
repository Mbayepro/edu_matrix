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
  const qrData = JSON.stringify({ id: eleve.id, matricule: eleve.matricule })
  // Utilisation de l'API qrserver pour assurer la consistance absolue avec la version d'impression
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`

  return (
    <div
      id={isPrint ? "student-card-final" : "student-card-preview"}
      className={`border-[1.5px] border-slate-200 rounded-xl p-4 bg-white relative overflow-hidden shadow-sm flex gap-4 shrink-0 mx-auto transition-transform ${
        !isPrint && 'hover:scale-[1.02] sm:scale-125 my-8'
      } ${isPrint ? 'print-card print:shadow-none print:border-slate-800' : ''}`}
      style={{ width: '85.6mm', height: '54mm', fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
    >
      {/* Left: Photo + details */}
      <div className="flex-1 flex flex-col justify-between z-10 w-full min-w-0">
        <div>
          <h3 className="font-extrabold text-[12px] tracking-tight leading-tight uppercase text-emerald-800 truncate">{ecole?.nom ?? 'Établissement Scolaire'}</h3>
          <p className="text-[9px] font-semibold text-slate-500 uppercase mt-0.5 tracking-wider">{classeNom} • {new Date().getFullYear()}</p>
        </div>
        
        <div className="flex gap-3 items-center mt-auto pb-1">
          <div className="w-[50px] h-[50px] bg-slate-100 rounded-md overflow-hidden shrink-0 border border-slate-200 shadow-sm">
            {eleve.photo_url ? (
              <img src={eleve.photo_url} className="w-full h-full object-cover" alt={`${eleve.prenom} ${eleve.nom}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-100 text-lg">
                {eleve.prenom[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 pr-1">
            <h2 className="font-black text-[13px] leading-tight text-slate-900 uppercase truncate">{eleve.nom || '—'}</h2>
            <h3 className="font-bold text-[11px] text-slate-700 leading-tight truncate mt-0.5">{eleve.prenom || '—'}</h3>
            <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase tracking-wider">Mat: {eleve.matricule || 'XXX'}</p>
          </div>
        </div>
      </div>
      
      {/* Right: Logos & QR Code */}
      <div className="w-[55px] shrink-0 flex flex-col justify-between items-end z-10">
        {ecole?.logo_url ? (
          <img src={ecole.logo_url} className="w-[35px] h-[35px] object-contain mb-1 drop-shadow-sm" alt="Logo" />
        ) : (
          <div className="w-[35px] h-[35px] bg-emerald-50 rounded border border-emerald-100 mb-1 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-emerald-600" />
          </div>
        )}
        <img src={qrUrl} alt="QR" className="w-[50px] h-[50px] rounded border border-slate-200 p-0.5 bg-white shadow-sm" />
      </div>

      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 w-[54mm] h-[54mm] bg-gradient-to-bl from-emerald-50 to-transparent rounded-full opacity-60 z-0 pointer-events-none translate-x-1/2 -translate-y-1/2" />
      <div className="absolute left-0 bottom-0 w-[8mm] h-[85.6mm] bg-emerald-600 opacity-80 z-0 pointer-events-none -rotate-12 translate-y-10 -translate-x-4" />
    </div>
  )
}

// ─────────────────────────────────────────
// Print card utility (now uses window.print directly on current page)
// ─────────────────────────────────────────
function handleDirectPrint() {
  window.print();
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
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #printable-card-area, #printable-card-area * { visibility: visible; }
          #printable-card-area { position: absolute; left: 0; top: 0; width: 100%; display: flex; justify-content: center; align-items: flex-start; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Zone d'impression invisible à l'écran */}
      <div id="printable-card-area" className="hidden print:flex fixed inset-0 z-[9999] bg-white pointer-events-none items-center justify-center">
          <PhysicalCard eleve={eleve} ecole={ecole} classeNom={classeNom} isPrint={true} />
      </div>

      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden">
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
                onClick={handleDirectPrint}
                className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 px-6 py-3 rounded-xl transition-all shadow-sm w-full sm:w-auto no-print"
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