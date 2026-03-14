'use client'

// src/components/StudentCard.tsx
import { useEffect, useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, Eleve, Note, Ecole } from '@/lib/supabase'
import {
  User, Award, BookOpen, Loader2,
  Download, X, ChevronDown
} from 'lucide-react'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface StudentCardProps {
  eleveId:  string
  onClose?: () => void
}

interface MoyenneParMatiere {
  matiere:     string
  moyenne:     number
  coefficient: number
}

// ─────────────────────────────────────────
// Weighted average calculation (CM2 method)
// Moyenne = SUM(note × coeff) / SUM(coeff)
// ─────────────────────────────────────────
function calculateWeightedAverage(notes: Note[]): number {
  if (notes.length === 0) return 0
  const sumProd = notes.reduce((acc, n) => acc + n.note * n.coefficient, 0)
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

function MentionBadge({ moyenne }: { moyenne: number }) {
  let label = 'Insuffisant'
  let className = 'bg-red-100 text-red-600'
  if (moyenne >= 16)      { label = 'Très bien';   className = 'bg-emerald-100 text-emerald-700' }
  else if (moyenne >= 14) { label = 'Bien';         className = 'bg-teal-100 text-teal-700' }
  else if (moyenne >= 12) { label = 'Assez bien';   className = 'bg-blue-100 text-blue-700' }
  else if (moyenne >= 10) { label = 'Passable';     className = 'bg-amber-100 text-amber-700' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────
// Physical Card (printable / downloadable)
// ─────────────────────────────────────────
function PhysicalCard({ eleve, ecole, className }: {
  eleve: Eleve
  ecole: Ecole | null
  className: string
}) {
  return (
    <div
      id="student-card-print"
      className="w-[340px] rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white select-none"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Header strip */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-white/80" />
        <p className="text-xs font-bold tracking-widest uppercase text-white/90">
          {ecole?.nom ?? 'Carte Scolaire'}
        </p>
        <div className="ml-auto text-right">
          <p className="text-[10px] text-white/70">EduMatrix</p>
          <p className="text-[10px] text-white/70">{new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex gap-4">
        {/* Photo */}
        <div className="shrink-0">
          {eleve.photo_url ? (
            <img
              src={eleve.photo_url}
              alt={`${eleve.prenom} ${eleve.nom}`}
              className="w-20 h-24 object-cover rounded-xl border-2 border-white/20"
            />
          ) : (
            <div className="w-20 h-24 bg-white/10 rounded-xl border-2 border-white/20 flex items-center justify-center">
              <User className="w-8 h-8 text-white/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-lg font-bold leading-tight truncate">
              {eleve.prenom} {eleve.nom}
            </p>
            <p className="text-xs text-white/60 mt-0.5">{ecole?.ville}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 uppercase tracking-wide w-14">Classe</span>
              <span className="text-xs font-semibold text-emerald-300">{className}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 uppercase tracking-wide w-14">Matricule</span>
              <span className="text-xs font-mono font-bold text-amber-300">{eleve.matricule}</span>
            </div>
            {eleve.date_naissance && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/50 uppercase tracking-wide w-14">Né(e) le</span>
                <span className="text-xs text-white/80">
                  {new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code section */}
      <div className="px-5 pb-4 flex items-center gap-4 border-t border-white/10 pt-3">
        <div className="bg-white p-2 rounded-xl shrink-0">
          <QRCodeSVG
            value={eleve.id}
            size={64}
            level="M"
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
        <div>
          <p className="text-[10px] text-white/50 mb-1">Scannez pour vérifier</p>
          <p className="text-[10px] text-white/30 leading-tight">
            Ce QR code permet de contrôler les présences et paiements.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
export default function StudentCard({ eleveId, onClose }: StudentCardProps) {
  const [eleve, setEleve]         = useState<Eleve | null>(null)
  const [notes, setNotes]         = useState<Note[]>([])
  const [loading, setLoading]     = useState(true)
  const [trimestre, setTrimestre] = useState<1 | 2 | 3>(1)
  const [ecole, setEcole]         = useState<Ecole | null>(null)

  useEffect(() => {
    loadData()
  }, [eleveId])

  async function loadData() {
    try {
      const [{ data: eleveData }, { data: notesData }] = await Promise.all([
        supabase
          .from('eleves')
          .select('*, classe:classes(nom_classe, niveau)')
          .eq('id', eleveId)
          .single(),
        supabase
          .from('notes')
          .select(`
            *,
            evaluation:evaluations(
              trimestre,
              coef,
              matiere:matieres(nom)
            )
          `)
          .eq('eleve_id', eleveId),
      ])

      if (eleveData) {
        setEleve(eleveData)
        // Load school name
        if (eleveData.ecole_id) {
          const { data: ecole } = await supabase
            .from('ecoles')
            .select('*')
            .eq('id', eleveData.ecole_id)
            .single()
          setEcole((ecole ?? null) as Ecole | null)
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
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!eleve) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Élève introuvable.
      </div>
    )
  }

  const notesDuTrimestre = notes.filter((n) => n.trimestre === trimestre)
  const moyenneGenerale  = calculateWeightedAverage(notesDuTrimestre)
  const parMatiere       = groupByMatiere(notesDuTrimestre)
  const className        = eleve.classe
    ? `${(eleve.classe as any).nom_classe} - ${(eleve.classe as any).niveau}`
    : '—'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-800">Dossier élève</h2>
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
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-center">
            <PhysicalCard eleve={eleve} ecole={ecole} className={className} />

            {/* Download hint */}
            <div className="sm:self-end">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 px-4 py-2.5 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Imprimer la carte
              </button>
            </div>
          </div>

          {/* Notes section */}
          <div className="bg-slate-50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="font-semibold text-slate-800">Notes & Moyennes</h3>

              {/* Trimestre selector */}
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

            {/* Average banner */}
            <div className="bg-white rounded-xl p-4 flex items-center gap-4 mb-4 shadow-sm border border-slate-100">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-800">
                  {moyenneGenerale.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">/ 20</p>
              </div>
              <div>
                <MentionBadge moyenne={moyenneGenerale} />
                <p className="text-xs text-slate-500 mt-1">Moyenne générale pondérée</p>
                <p className="text-[10px] text-slate-400">
                  Formule CM2 : Σ(note × coeff) / Σcoeff
                </p>
              </div>
            </div>

            {/* Bulletin imprimable */}
            <div className="mt-4 bg-white rounded-xl p-4 border border-dashed border-slate-200">
              <p className="text-xs text-slate-500 mb-2">
                Pour générer un bulletin PDF, utilisez l&apos;impression du navigateur (Fichier → Imprimer) depuis cette fenêtre.
                Le bulletin inclut les informations de l&apos;élève, les moyennes par matière et la moyenne générale avec mention.
              </p>
            </div>

            {/* Per subject */}
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
                      <p className="text-[10px] text-slate-400">/ 20</p>
                    </div>
                    {/* Mini bar */}
                    <div className="w-16 bg-slate-100 rounded-full h-1.5 shrink-0">
                      <div
                        className={`h-1.5 rounded-full transition-all ${m.moyenne >= 10 ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: `${(m.moyenne / 20) * 100}%` }}
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
  )
}