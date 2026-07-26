'use client'

import { useEffect, useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, Eleve, Note, Ecole, Presence } from '@/lib/supabase'
import {
  User, Award, BookOpen, Loader2,
  Printer, X, ChevronDown, History, Sparkles, AlertCircle, Phone, Heart, Calendar, MessageSquare, Send
} from 'lucide-react'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface StudentCardProps {
  eleveId:     string
  onClose?:    () => void
  defaultTab?: 'card' | 'qr' | 'parcours'
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
    else if (moyenne >= 6) { label = 'Assez bien';   className = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' }
    else if (moyenne >= 5) { label = 'Passable';     className = 'bg-amber-100 text-amber-700' }
  } else {
    if (moyenne >= 16)      { label = 'Très bien';   className = 'bg-emerald-100 text-emerald-700' }
    else if (moyenne >= 14) { label = 'Bien';         className = 'bg-teal-100 text-teal-700' }
    else if (moyenne >= 12) { label = 'Assez bien';   className = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' }
    else if (moyenne >= 10) { label = 'Passable';     className = 'bg-amber-100 text-amber-700' }
  }

  return (
    <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${className}`}>
      {label}
    </span>
  )
}

function PhysicalCard({ eleve, ecole, classeNom, isPrint = false }: {
  eleve: Eleve
  ecole: Ecole | null
  classeNom: string
  isPrint?: boolean
}) {
  const qrData = eleve.id

  return (
    <div
      id={isPrint ? "student-card-final" : "student-card-preview"}
      className={`border-[1.5px] border-slate-200 rounded-xl p-4 bg-white relative overflow-hidden shadow-sm flex gap-4 shrink-0 mx-auto transition-transform ${
        !isPrint && 'hover:scale-[1.02] sm:scale-110 my-4'
      } ${isPrint ? 'print-card print:shadow-none print:border-slate-800' : ''}`}
      style={{ width: '85.6mm', height: '54mm', fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
    >
      <div className="flex-1 flex flex-col justify-between z-10 w-full min-w-0">
        <div>
          <h3 className="font-black text-[10px] tracking-widest leading-tight uppercase text-emerald-800 truncate">{ecole?.nom ?? 'Établissement Scolaire'}</h3>
          <p className="text-[8px] font-black text-slate-500 uppercase mt-0.5 tracking-[0.2em]">{classeNom} • {new Date().getFullYear()}</p>
        </div>
        
        <div className="flex gap-3 items-center mt-auto pb-1">
          <div className="w-[50px] h-[50px] bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-200 shadow-sm">
            {eleve.photo_url ? (
              <img src={eleve.photo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-black bg-slate-100 text-lg uppercase">
                {eleve.prenom[0]}
              </div>
            )}
          </div>
          <div className="min-w-0 pr-1">
            <h2 className="font-black text-[12px] leading-tight text-slate-900 uppercase truncate">{eleve.nom || '—'}</h2>
            <h3 className="font-bold text-[10px] text-slate-700 leading-tight truncate mt-0.5">{eleve.prenom || '—'}</h3>
            <p className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded inline-block">Mat: {eleve.matricule || 'XXX'}</p>
          </div>
        </div>
      </div>
      
      <div className="w-[55px] shrink-0 flex flex-col justify-between items-end z-10">
        {ecole?.logo_url ? (
          <img src={ecole.logo_url} className="w-[30px] h-[30px] object-contain mb-1" alt="" />
        ) : (
          <div className="w-[30px] h-[30px] bg-emerald-50 rounded border border-emerald-100 mb-1 flex items-center justify-center">
            <BookOpen className="w-3 h-3 text-emerald-600" />
          </div>
        )}
        <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex items-center justify-center">
          <QRCodeSVG value={qrData} size={50} level="H" />
        </div>
      </div>

      <div className="absolute top-0 right-0 w-[54mm] h-[54mm] bg-gradient-to-bl from-emerald-50 to-transparent rounded-full opacity-60 z-0 pointer-events-none translate-x-1/2 -translate-y-1/2" />
      <div className="absolute left-0 bottom-0 w-[6mm] h-[85.6mm] bg-emerald-600 opacity-80 z-0 pointer-events-none -rotate-12 translate-y-10 -translate-x-4" />
    </div>
  )
}

export default function StudentCard({ eleveId, onClose, defaultTab }: StudentCardProps) {
  const [eleve, setEleve]         = useState<Eleve | null>(null)
  const [notes, setNotes]         = useState<Note[]>([])
  const [presences, setPresences] = useState<Presence[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<'profil' | 'parcours' | 'qr'>(defaultTab === 'qr' ? 'qr' : 'profil')
  const [trimestre, setTrimestre] = useState<1 | 2 | 3>(1)
  const [ecole, setEcole]         = useState<Ecole | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [eleveId])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: eleveData }, { data: notesData }, { data: presData }] = await Promise.all([
        supabase
          .from('eleves' as any)
          .select('*, classe:classes(nom_classe, niveau, niveau_info:niveaux(cycle))')
          .eq('id', eleveId)
          .single() as any,
        supabase
          .from('notes' as any)
          .select(`*, evaluation:evaluations(trimestre, coef, bareme, matiere:matieres(nom))`)
          .eq('eleve_id', eleveId) as any,
        supabase
          .from('presences' as any)
          .select('*')
          .eq('eleve_id', eleveId)
          .order('date', { ascending: false })
          .limit(20) as any
      ])

      if (eleveData) {
        setEleve(eleveData as Eleve)
        if (eleveData.ecole_id) {
          const { data: ecoleData } = await supabase.from('ecoles' as any).select('*').eq('id', eleveData.ecole_id).single() as { data: Ecole | null; error: any }
          setEcole((ecoleData ?? null) as Ecole | null)
        }
      }

      setNotes((notesData ?? []).map((n: any) => ({
        ...n,
        trimestre:   n.evaluation?.trimestre ?? 1,
        coefficient: n.evaluation?.coef      ?? 1,
        matiere:     n.evaluation?.matiere?.nom ?? 'Inconnue',
      })))
      setPresences(presData as any || [])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!eleve) return null

  const isPrimary = (eleve as any).classe?.niveau_info?.cycle === 'primaire'
  const notesDuTrimestre = notes.filter((n) => n.trimestre === trimestre)
  let moyenneGenerale = calculateWeightedAverage(notesDuTrimestre)
  let parMatiere = groupByMatiere(notesDuTrimestre)

  if (isPrimary) {
    moyenneGenerale = moyenneGenerale / 2
    parMatiere = parMatiere.map(m => ({ ...m, moyenne: m.moyenne / 2 }))
  }

  const handleWhatsAppShare = () => {
    const message = `*EDUMATRIX - Bulletin de ${eleve.prenom} ${eleve.nom}*\n\n` +
      `Trimestre: ${trimestre}\n` +
      `Moyenne Générale: *${moyenneGenerale.toFixed(2)} / ${isPrimary ? '10' : '20'}*\n` +
      `Mention: ${moyenneGenerale >= (isPrimary ? 5 : 10) ? 'Admis' : 'Insuffisant'}\n\n` +
      `*Détails par matière:*\n` +
      parMatiere.map(m => `• ${m.matiere}: ${m.moyenne.toFixed(2)}`).join('\n') +
      `\n\n_Envoyé via EduMatrix_`;
    
    const whatsappUrl = `https://wa.me/${eleve.telephone_parent?.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const classeNom = (eleve as any).classe?.nom_classe ?? '—'

  // Combinaison timeline
  const timeline = [
    ...notes.map(n => ({ type: 'note', date: n.created_at, val: n.note, label: n.matiere })),
    ...presences.map(p => ({ type: 'presence', date: p.date, val: p.statut, label: (p as any).observation || p.statut })),
  ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in zoom-in duration-500">
        
        {/* Header Modal */}
        <div className="bg-slate-900 px-8 py-6 text-white flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white text-xl font-black uppercase">
                 {eleve.prenom[0]}
              </div>
              <div>
                 <h2 className="text-lg font-black uppercase tracking-tight">{eleve.prenom} {eleve.nom}</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{classeNom} • {eleve.matricule}</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-6 h-6 text-slate-400" />
           </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
           {[
             { id: 'profil',   label: 'Dossier Scolaire', icon: Award },
             { id: 'parcours', label: 'Timeline 360°',    icon: History },
             { id: 'qr',       label: 'Carte Physique',   icon: Printer },
           ].map(tab => (
             <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tab.id ? 'border-emerald-600 text-emerald-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
             >
               <tab.icon className="w-4 h-4" />
               <span className="hidden sm:inline">{tab.label}</span>
             </button>
           ))}
        </div>

        <div className="p-8">
          {activeTab === 'profil' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Moyenne T{trimestre}</p>
                    <div className="flex items-end gap-2">
                       <span className="text-3xl font-black text-slate-900">{moyenneGenerale.toFixed(2)}</span>
                       <span className="text-xs font-bold text-slate-400 pb-1">/ {isPrimary ? '10' : '20'}</span>
                    </div>
                    <div className="mt-4">
                       <MentionBadge moyenne={moyenneGenerale} isPrimary={isPrimary} />
                    </div>
                 </div>
                 <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex flex-col justify-center relative group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Points Mérite</p>
                    <div className="flex items-center gap-3">
                       <Sparkles className="w-8 h-8 text-amber-500" />
                       <span className="text-3xl font-black text-amber-600">{(eleve as any).points_merite || 0}</span>
                    </div>
                    {eleve.telephone_parent && (
                      <button 
                        onClick={handleWhatsAppShare}
                        className="absolute top-4 right-4 p-2 bg-emerald-100 text-emerald-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-600 hover:text-white"
                        title="Partager le bulletin via WhatsApp"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                 </div>
              </div>

              {/* Scolarité details */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Notes par matière</h3>
                    <div className="relative">
                       <select 
                        value={trimestre}
                        onChange={(e) => setTrimestre(Number(e.target.value) as 1|2|3)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                       >
                         <option value={1}>Trimestre 1</option>
                         <option value={2}>Trimestre 2</option>
                         <option value={3}>Trimestre 3</option>
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {parMatiere.map(m => (
                      <div key={m.matiere} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                         <div>
                            <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{m.matiere}</p>
                            <p className="text-[9px] font-bold text-slate-400">Coeff. {m.coefficient}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-black text-slate-900">{m.moyenne.toFixed(2)}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Urgences */}
              <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 space-y-4">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Informations d&apos;Urgence
                 </h3>
                 <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-3">
                       <Heart className="w-5 h-5 text-rose-400" />
                       <div>
                          <p className="text-[9px] font-black uppercase text-rose-400">Groupe Sanguin</p>
                          <p className="text-xs font-black text-rose-900">Inconnu</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Phone className="w-5 h-5 text-rose-400" />
                       <div>
                          <p className="text-[9px] font-black uppercase text-rose-400">Parent à contacter</p>
                          <p className="text-xs font-black text-rose-900">{eleve.telephone_parent || 'Non renseigné'}</p>
                       </div>
                    </div>
                 </div>
              </div>

            </div>
          )}

          {activeTab === 'parcours' && (
            <div className="space-y-6 animate-in fade-in duration-500 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
               {timeline.length === 0 ? (
                 <div className="py-20 text-center text-slate-400 italic text-sm">Aucun événement enregistré.</div>
               ) : (
                 <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {timeline.map((item, idx) => (
                      <div key={idx} className="relative">
                         <div className={`absolute -left-[2.35rem] w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${item.type === 'note' ? 'bg-emerald-500' : item.val === 'absent' ? 'bg-rose-500' : 'bg-blue-500'}`}>
                            {item.type === 'note' ? <Award className="w-3 h-3 text-white" /> : <Calendar className="w-3 h-3 text-white" />}
                         </div>
                         <div className="space-y-1">
                            <div className="flex items-center gap-3">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${item.type === 'note' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {item.type === 'note' ? 'Évaluation' : 'Présence'}
                               </span>
                            </div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.label}</h4>
                            {item.type === 'note' && (
                              <p className="text-xs font-bold text-emerald-600">Note obtenue : {item.val} / 20</p>
                            )}
                            {item.type === 'presence' && (
                              <p className={`text-xs font-bold ${item.val === 'absent' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                 Statut : {item.val}
                              </p>
                            )}
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center gap-8 py-10 animate-in zoom-in duration-500">
               <PhysicalCard eleve={eleve} ecole={ecole} classeNom={classeNom} />
               <button 
                onClick={() => window.print()}
                className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl shadow-black/20"
               >
                 <Printer className="w-5 h-5" />
                 Imprimer la carte physique
               </button>
               <p className="text-center text-[10px] text-slate-400 max-w-xs font-medium leading-relaxed">
                 Cette carte permet au directeur et aux professeurs d&apos;identifier l&apos;élève et de marquer sa présence via le scanner QR.
               </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}