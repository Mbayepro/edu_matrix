'use client'

import { useState, useEffect } from 'react'
import { detectAtRiskStudents, AtRiskStudent } from '@/lib/intelligence'
import { AlertTriangle, ArrowDownRight, Eye, UserX, Loader2 } from 'lucide-react'
import StudentCard from './StudentCard'

export default function AtRiskPanel({ ecoleId }: { ecoleId: string }) {
  const [risks, setRisks] = useState<AtRiskStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (ecoleId) loadRisks()
  }, [ecoleId])

  async function loadRisks() {
    setLoading(true)
    const data = await detectAtRiskStudents(ecoleId)
    setRisks(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="bg-rose-50/50 rounded-[2.5rem] p-8 border border-rose-100/50 flex items-center justify-center min-h-[200px]">
         <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    )
  }

  if (risks.length === 0) {
    return (
      <div className="bg-emerald-50/30 rounded-[2.5rem] p-8 border border-emerald-100/50 flex flex-col items-center justify-center text-center gap-4">
         <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-emerald-600" />
         </div>
         <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Tout est sous contrôle</p>
         <p className="text-xs text-slate-400 font-medium max-w-[200px]">Aucune chute brutale de résultats n&apos;a été détectée récemment.</p>
      </div>
    )
  }

  return (
    <div className="bg-rose-50/30 rounded-[3rem] border border-rose-100/50 overflow-hidden flex flex-col">
      <div className="px-8 py-6 border-b border-rose-100/50 bg-rose-50/50 flex items-center justify-between">
         <h2 className="text-xs font-black text-rose-700 uppercase tracking-widest flex items-center gap-3">
            <UserX className="w-5 h-5" />
            Alertes Pédagogiques
         </h2>
         <span className="text-[9px] font-black bg-rose-200 text-rose-800 px-2 py-1 rounded-lg uppercase">{risks.length} Risques</span>
      </div>

      <div className="flex-1 divide-y divide-rose-100/50">
         {risks.map(risk => (
           <div key={risk.id} className="p-6 hover:bg-rose-100/30 transition-colors group">
              <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-rose-100 flex items-center justify-center text-rose-600 font-black text-sm">
                       {risk.prenom[0]}
                    </div>
                    <div>
                       <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{risk.prenom} {risk.nom}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase">{risk.classe_nom}</p>
                    </div>
                 </div>
                 <button 
                  onClick={() => setSelectedId(risk.id)}
                  className="w-8 h-8 rounded-lg bg-white border border-rose-100 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:border-rose-300 transition-all shadow-sm"
                 >
                    <Eye className="w-4 h-4" />
                 </button>
              </div>

              <div className="mt-4 flex items-center gap-3 bg-white/60 rounded-xl p-3 border border-rose-100">
                 <div className="flex items-center gap-1 text-rose-600">
                    <ArrowDownRight className="w-4 h-4" />
                    <span className="text-xs font-black">-{risk.chute.toFixed(1)} pts</span>
                 </div>
                 <div className="w-px h-4 bg-rose-100" />
                 <p className="text-[10px] font-medium text-slate-500 italic">Moyenne passée de {risk.moyenne_precedente.toFixed(1)} à {risk.moyenne_actuelle.toFixed(1)}</p>
              </div>
           </div>
         ))}
      </div>

      {selectedId && <StudentCard eleveId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
