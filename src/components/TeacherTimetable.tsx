'use client'

// src/components/TeacherTimetable.tsx
// Composant lecture seule de l'emploi du temps d'un enseignant

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EmploiDuTemps, Matiere } from '@/lib/supabase'
import { Loader2, Calendar } from 'lucide-react'

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const

const COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
]

interface Slot {
  id: string
  ecole_id: string
  enseignant_id: string
  classe_id: string
  matiere_id: string | null
  jour: number
  heure_debut: string
  heure_fin: string
  salle: string | null
  created_at: string
  classe?: { id: string; nom_classe: string }
  matiere?: { id: string; nom: string }
}

interface Props {
  enseignantId: string
  ecoleId: string
}

export default function TeacherTimetable({ enseignantId, ecoleId }: Props) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [matiereColorMap, setMatiereColorMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (enseignantId && ecoleId) loadSlots()
  }, [enseignantId, ecoleId])

  async function loadSlots() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('emploi_du_temps')
        .select(`*, classe:classes!classe_id(id, nom_classe), matiere:matieres!matiere_id(id, nom)`)
        .eq('ecole_id', ecoleId)
        .eq('enseignant_id', enseignantId)
        .order('jour').order('heure_debut')

      const items = (data ?? []) as Slot[]
      setSlots(items)

      // Build color map (unique per matiere)
      const uniqueMatieres = Array.from(new Set(items.map(s => s.matiere_id).filter(Boolean)))
      const colorMap: Record<string, string> = {}
      uniqueMatieres.forEach((id, i) => {
        if (id) colorMap[id] = COLORS[i % COLORS.length]
      })
      setMatiereColorMap(colorMap)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
    </div>
  )

  if (slots.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Calendar className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">Aucun créneau dans votre emploi du temps.</p>
      <p className="text-xs mt-1 text-slate-300">Votre directeur n'a pas encore configuré votre planning.</p>
    </div>
  )

  const slotsForDay = (jour: number) =>
    slots.filter(s => s.jour === jour).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut))

  return (
    <div className="space-y-3">
      {/* Mobile: list view */}
      <div className="space-y-3 md:hidden">
        {[1,2,3,4,5,6].map(jour => {
          const daySlots = slotsForDay(jour)
          if (!daySlots.length) return null
          return (
            <div key={jour} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-indigo-50 flex items-center gap-2">
                <span className="font-bold text-indigo-700 text-sm">{JOURS[jour]}</span>
              </div>
              <div className="p-3 space-y-2">
                {daySlots.map(s => {
                  const color = s.matiere_id ? matiereColorMap[s.matiere_id] ?? COLORS[0] : 'bg-slate-100 text-slate-700 border-slate-200'
                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${color}`}>
                      <div>
                        <p className="font-bold text-xs">{s.heure_debut.slice(0,5)} – {s.heure_fin.slice(0,5)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{s.matiere?.nom ?? 'Cours'}</p>
                        <p className="text-xs opacity-70">{s.classe?.nom_classe}{s.salle ? ` · ${s.salle}` : ''}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: weekly grid */}
      <div className="hidden md:grid grid-cols-6 gap-3">
        {[1,2,3,4,5,6].map(jour => {
          const daySlots = slotsForDay(jour)
          return (
            <div key={jour} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className={`px-3 py-2 text-center text-xs font-bold ${daySlots.length ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-400'}`}>
                {JOURS[jour]}
              </div>
              <div className="p-2 space-y-1.5 min-h-[120px]">
                {daySlots.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-slate-200 text-xs">—</span>
                  </div>
                ) : daySlots.map(s => {
                  const color = s.matiere_id ? matiereColorMap[s.matiere_id] ?? COLORS[0] : 'bg-slate-100 text-slate-700 border-slate-200'
                  return (
                    <div key={s.id} className={`rounded-lg border px-2 py-1.5 ${color}`}>
                      <p className="font-bold text-[10px] font-mono">{s.heure_debut.slice(0,5)}–{s.heure_fin.slice(0,5)}</p>
                      <p className="font-semibold text-[11px] leading-tight truncate">{s.matiere?.nom ?? 'Cours'}</p>
                      <p className="text-[10px] opacity-70 truncate">{s.classe?.nom_classe}</p>
                      {s.salle && <p className="text-[10px] opacity-60 truncate">{s.salle}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
