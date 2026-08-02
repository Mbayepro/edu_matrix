import React from 'react'
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react'
import type { LocalFraisScolaire } from '@/lib/db'

interface EleveBase {
  id: string
}

interface PaymentFormProps {
  selectedEleve: EleveBase | null
  enregistrerPaiement: (e: React.FormEvent) => Promise<void>
  frais: LocalFraisScolaire[]
  selectedFraisId: string
  setSelectedFraisId: (val: string) => void
  isMensuel: boolean
  months: string[]
  selectedMonth: string
  setSelectedMonth: (val: string) => void
  montant: string
  setMontant: (val: string) => void
  mode: string
  setMode: (val: string) => void
  reference: string
  setReference: (val: string) => void
  saving: boolean
}

export function PaymentForm({
  selectedEleve,
  enregistrerPaiement,
  frais,
  selectedFraisId,
  setSelectedFraisId,
  isMensuel,
  months,
  selectedMonth,
  setSelectedMonth,
  montant,
  setMontant,
  mode,
  setMode,
  reference,
  setReference,
  saving
}: PaymentFormProps) {
  if (!selectedEleve) {
    return (
      <div className="py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 animate-in zoom-in-95 duration-500">
        <CreditCard className="w-10 h-10 text-slate-700 mx-auto mb-4" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-8 leading-relaxed">
          Veuillez d&apos;abord sélectionner un élève dans la liste de gauche.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enregistrerPaiement} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Frais</label>
          <select
            value={selectedFraisId}
            onChange={(e) => setSelectedFraisId(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all appearance-none cursor-pointer"
            required
          >
            <option value="" className="bg-slate-900 text-white">Sélectionner…</option>
            {frais.map((f) => (
              <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                {f.libelle} ({f.montant.toLocaleString('fr-FR')} F)
              </option>
            ))}
          </select>
        </div>

        {isMensuel && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mois concerné</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all appearance-none cursor-pointer"
              required
            >
              <option value="" className="bg-slate-900 text-white">Sélectionner le mois…</option>
              {months.map((m) => (
                <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Montant versé (F CFA)</label>
          <input
            type="text"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="Ex: 25 000"
            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all placeholder:text-slate-700"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mode</label>
            <input
              type="text"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              placeholder="Espèces/Mobile"
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all placeholder:text-slate-700"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Réf. Transaction</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: Wave ID, Chèque…"
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all placeholder:text-slate-700"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black tracking-widest uppercase transition-all shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95"
      >
        {saving ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement…</>
        ) : (
          <><CheckCircle2 className="w-5 h-5" /> Valider le versement</>
        )}
      </button>
    </form>
  )
}
