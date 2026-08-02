import React from 'react'
import { BarChart3, Printer, Download, Receipt } from 'lucide-react'
import { formatDateTime } from '@/lib/dateUtils'
import type { Paiement } from '@/lib/supabase'
import type { LocalFraisScolaire } from '@/lib/db'

interface EleveBase {
  id: string
}

interface PaymentHistoryProps {
  selectedEleve: EleveBase | null
  paiements: Paiement[]
  frais: LocalFraisScolaire[]
  handleDownloadReceipt: (p: Paiement) => void
  handlePrintThermalReceipt: (p: Paiement) => void
  handlePrintReceipt: (p: Paiement) => void
}

export function PaymentHistory({
  selectedEleve,
  paiements,
  frais,
  handleDownloadReceipt,
  handlePrintThermalReceipt,
  handlePrintReceipt
}: PaymentHistoryProps) {
  return (
    <div className="premium-glass overflow-hidden group">
      <div className="p-8 border-b border-white/5 bg-white/5">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-amber-500" />
          Derniers règlements
        </h3>
      </div>
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        {!selectedEleve ? (
          <div className="py-12 text-center opacity-30">
            <Printer className="w-10 h-10 mx-auto mb-4 text-slate-700" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aucune donnée</p>
          </div>
        ) : (
          paiements
            .filter(p => p.eleve_id === selectedEleve.id)
            .map((p) => {
              const fLibelle = frais.find(f => f.id === p.frais_id)?.libelle || 'Scolarité'
              return (
                <div key={p.id} className="p-5 bg-white/5 border border-white/5 rounded-3xl group/item hover:border-emerald-500/30 hover:bg-white/10 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-lg font-black text-white leading-none">
                        {p.montant.toLocaleString('fr-FR')} <span className="text-xs uppercase text-slate-400">F</span>
                      </p>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">
                        {fLibelle} {(p as any).mois ? `— ${(p as any).mois}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDownloadReceipt(p)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 border border-white/10 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                        title="Télécharger Reçu PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handlePrintThermalReceipt(p)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 border border-white/10 hover:bg-violet-500 hover:text-white transition-all shadow-sm"
                        title="Ticket (Thermique)"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handlePrintReceipt(p)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 border border-white/10 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                        title="Imprimer (A4)"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/5 mt-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {formatDateTime(p.date_paiement)}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase italic">
                      {p.reference || p.mode || 'N/A'}
                    </span>
                  </div>
                </div>
              )
            })
        )}
        {selectedEleve && paiements.filter(p => p.eleve_id === selectedEleve.id).length === 0 && (
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 text-center py-10">Aucun historique pour cet élève</p>
        )}
      </div>
    </div>
  )
}
