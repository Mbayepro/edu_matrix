'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { useProfile } from '@/hooks/useProfile'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, Users, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface HistoryEntry {
  date: string
  presents: number
  absents: number
  retards: number
}

export default function HistoriquePresences() {
  const { profile, loading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (loading || !ecoleId) return
    loadHistory()
  }, [ecoleId, loading])

  async function loadHistory() {
    setIsLoading(true)
    try {
      if (!db) return
      const allPresences = await db.presences.where('ecole_id').equals(ecoleId!).toArray()
      
      const grouped = allPresences.reduce((acc: Record<string, HistoryEntry>, curr) => {
        if (!acc[curr.date]) {
          acc[curr.date] = { date: curr.date, presents: 0, absents: 0, retards: 0 }
        }
        if (curr.statut === 'présent') acc[curr.date].presents++
        else if (curr.statut === 'absent') acc[curr.date].absents++
        else if (curr.statut === 'retard') acc[curr.date].retards++
        return acc
      }, {})

      const sortedHistory = Object.values(grouped).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      setHistory(sortedHistory)
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/presences"
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Historique des Présences</h1>
            <p className="text-slate-400 mt-1">Consultez l'historique complet des présences et absences de l'établissement.</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-10 py-6 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Rapports Quotidiens</h2>
          <Calendar className="w-4 h-4 text-slate-500" />
        </div>
        
        {history.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-500">Aucun historique disponible</h3>
            <p className="text-sm text-slate-600 mt-2">Les rapports apparaîtront ici une fois les présences saisies.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="text-center px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Présents</th>
                  <th className="text-center px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Absents</th>
                  <th className="text-center px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Retards</th>
                  <th className="text-center px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Taux de présence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {history.map((entry) => {
                  const total = entry.presents + entry.absents + entry.retards
                  const tauxPresence = total > 0 ? Math.round(((entry.presents + entry.retards) / total) * 100) : 0
                  
                  return (
                    <tr key={entry.date} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-10 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-white capitalize">
                              {format(parseISO(entry.date), 'EEEE d MMMM yyyy', { locale: fr })}
                            </p>
                            <p className="text-xs text-slate-500">{total} élèves évalués</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                          {entry.presents}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                          {entry.absents}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                          {entry.retards}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${tauxPresence >= 90 ? 'bg-emerald-500' : tauxPresence >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${tauxPresence}%` }}
                            />
                          </div>
                          <span className="font-black text-slate-300 w-8">{tauxPresence}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
