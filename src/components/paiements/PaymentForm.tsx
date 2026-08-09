import React, { useState, useEffect } from 'react'
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Printer } from 'lucide-react'
import type { LocalFraisScolaire, LocalPaiement, LocalEleveFrais } from '@/lib/db'

interface EleveBase {
  id: string
}

interface PaymentFormProps {
  selectedEleve: EleveBase | null
  enregistrerPaiement: (e: React.FormEvent, autoPrint: boolean) => Promise<void>
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
  paiements: LocalPaiement[]
  elevesFrais: LocalEleveFrais[]
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
  saving,
  paiements,
  elevesFrais
}: PaymentFormProps) {
  const [autoPrint, setAutoPrint] = useState(true)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  // Validate duplicate month
  useEffect(() => {
    if (isMensuel && selectedMonth && selectedFraisId && selectedEleve) {
      // Find all payments for this fee type and this month
      const existingPayments = paiements.filter(
        p => p.frais_id === selectedFraisId && p.mois === selectedMonth
      )
      
      const targetFee = elevesFrais.find(ef => ef.frais_id === selectedFraisId)
      const montantAttendu = targetFee ? (Number(targetFee.montant_a_payer) || (Number(targetFee.montant_du) - Number(targetFee.montant_remise))) : 0

      const totalPaidForMonth = existingPayments.reduce((sum, p) => sum + Number(p.montant), 0)

      if (totalPaidForMonth >= montantAttendu && montantAttendu > 0) {
        setDuplicateWarning(`Attention : Le mois de ${selectedMonth} a déjà été intégralement payé !`)
      } else if (totalPaidForMonth > 0) {
        setDuplicateWarning(`Le mois de ${selectedMonth} est partiellement payé. Reste : ${(montantAttendu - totalPaidForMonth).toLocaleString('fr-FR')} F`)
      } else {
        setDuplicateWarning(null)
      }
    } else {
      setDuplicateWarning(null)
    }
  }, [selectedMonth, selectedFraisId, isMensuel, paiements, selectedEleve, elevesFrais])

  // Smart default selection
  useEffect(() => {
    if (selectedEleve && !selectedFraisId && frais.length > 0) {
      // Prioritize "Inscription" if not fully paid
      const inscription = frais.find(f => (f.libelle || '').toLowerCase().includes('inscription'))
      if (inscription) {
        const ef = elevesFrais.find(ef => ef.frais_id === inscription.id)
        if (ef) {
          const aPayer = Number(ef.montant_a_payer) || (Number(ef.montant_du) - Number(ef.montant_remise)) || 0
          const paye = paiements.filter(p => p.frais_id === inscription.id).reduce((s, p) => s + Number(p.montant), 0)
          if (aPayer > paye) {
            setSelectedFraisId(inscription.id)
            setMontant((aPayer - paye).toString())
            return
          }
        }
      }
      // Otherwise, select the first one
      setSelectedFraisId(frais[0].id)
    }
  }, [selectedEleve, frais])


  if (!selectedEleve) {
    return (
      <div className="py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 animate-in zoom-in-95 duration-500">
        <CreditCard className="w-10 h-10 text-slate-700 mx-auto mb-4" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-8 leading-relaxed">
          Veuillez d'abord sélectionner un élève dans la liste de gauche.
        </p>
      </div>
    )
  }

  // Grouper les frais : Uniques (Inscription, Tenue...) vs Mensuels
  const fraisUniques = frais.filter(f => f.frequence !== 'mensuel' && !(f.libelle || '').toLowerCase().includes('mensu') && !(f.libelle || '').toLowerCase().includes('scolarit'))
  const fraisMensuels = frais.filter(f => f.frequence === 'mensuel' || (f.libelle || '').toLowerCase().includes('mensu') || (f.libelle || '').toLowerCase().includes('scolarit'))

  const isFormDisabled = saving || (duplicateWarning !== null && duplicateWarning.includes('déjà été intégralement payé'))

  return (
    <form onSubmit={(e) => enregistrerPaiement(e, autoPrint)} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Frais</label>
          <select
            value={selectedFraisId}
            onChange={(e) => {
              setSelectedFraisId(e.target.value)
              // Reset month warning when changing fee
              setDuplicateWarning(null)
            }}
            className="w-full bg-slate-900 border-2 border-emerald-500/20 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
            required
          >
            <option value="" className="bg-slate-900 text-white">Sélectionner…</option>
            {fraisUniques.length > 0 && (
              <optgroup label="FRAIS UNIQUES (INSCRIPTION...)" className="text-emerald-400 text-[10px] font-black">
                {fraisUniques.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white text-sm">
                    {f.libelle} ({f.montant.toLocaleString('fr-FR')} F)
                  </option>
                ))}
              </optgroup>
            )}
            {fraisMensuels.length > 0 && (
              <optgroup label="MENSUALITÉS (SCOLARITÉ)" className="text-amber-400 text-[10px] font-black">
                {fraisMensuels.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white text-sm">
                    {f.libelle} ({f.montant.toLocaleString('fr-FR')} F)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {isMensuel && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mois concerné</label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={`w-full bg-slate-900 border-2 ${duplicateWarning?.includes('intégralement payé') ? 'border-rose-500/50' : 'border-amber-500/20'} rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-amber-500/20 transition-all appearance-none cursor-pointer`}
                required
              >
                <option value="" className="bg-slate-900 text-slate-500">Sélectionner le mois…</option>
                {months.map((m) => {
                  const isPaid = paiements.some(p => p.frais_id === selectedFraisId && p.mois === m)
                  return (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {m} {isPaid ? '(Déjà des paiements)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            
            {duplicateWarning && (
              <div className={`p-4 rounded-xl flex items-start gap-3 text-sm font-bold animate-in zoom-in-95 ${duplicateWarning.includes('intégralement payé') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{duplicateWarning}</p>
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Montant versé (F CFA)</label>
          <input
            type="number"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="Ex: 25000"
            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-lg font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all placeholder:text-slate-700 placeholder:font-normal"
            required
            disabled={duplicateWarning?.includes('intégralement payé')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all appearance-none cursor-pointer"
            >
              <option value="Espèces">Espèces</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Chèque">Chèque</option>
              <option value="Virement">Virement</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Réf. Transaction</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: Wave ID…"
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all placeholder:text-slate-700"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${autoPrint ? 'bg-emerald-500' : 'bg-slate-700'}`} onClick={() => setAutoPrint(!autoPrint)}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoPrint ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors flex items-center gap-1.5" onClick={() => setAutoPrint(!autoPrint)}>
              <Printer className="w-3.5 h-3.5" /> Impression immédiate du reçu
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isFormDisabled}
        className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black tracking-widest uppercase transition-all shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      >
        {saving ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement…</>
        ) : (
          <><CheckCircle2 className="w-5 h-5" /> Valider l'encaissement</>
        )}
      </button>
    </form>
  )
}
