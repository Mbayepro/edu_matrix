import React from 'react'
import { Users, CreditCard, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'
import type { Paiement } from '@/lib/supabase'
import type { LocalFraisScolaire, LocalEleveFrais } from '@/lib/db'

interface EleveWithClasse {
  id: string
  prenom: string
  nom: string
  matricule: string
  classe_id: string
  telephone_parent?: string
  statut_paiement?: string
  classe?: { nom_classe: string }
}

interface StudentListProps {
  loading: boolean
  profileLoading: boolean
  filteredEleves: EleveWithClasse[]
  selectedEleve: EleveWithClasse | null
  setSelectedEleve: (e: EleveWithClasse) => void
  elevesFrais: LocalEleveFrais[]
  frais: LocalFraisScolaire[]
  paiements: Paiement[]
  activeTab: 'tous' | 'impayes'
  getEleveBalance: (eleveId: string) => { du: number; paye: number; reste: number }
  getMoisEnRetard: (eleveId: string, fraisId: string) => string[]
  handleWhatsAppReminder: (eleve: EleveWithClasse, reste: number) => void
  editingPhoneId: string | null
  setEditingPhoneId: (id: string | null) => void
  tempPhone: string
  setTempPhone: (phone: string) => void
  handleUpdatePhone: (eleveId: string) => void
}

export function StudentList({
  loading,
  profileLoading,
  filteredEleves,
  selectedEleve,
  setSelectedEleve,
  elevesFrais,
  frais,
  paiements,
  activeTab,
  getEleveBalance,
  getMoisEnRetard,
  handleWhatsAppReminder,
  editingPhoneId,
  setEditingPhoneId,
  tempPhone,
  setTempPhone,
  handleUpdatePhone
}: StudentListProps) {
  if (loading || profileLoading) {
    return (
      <div className="p-8 space-y-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl bg-white/5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2 bg-white/5" />
              <Skeleton className="h-3 w-1/3 bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filteredEleves.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 px-10 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <Users className="w-10 h-10 text-slate-500" />
        </div>
        <h3 className="text-lg font-black text-white mb-1 tracking-tight">Aucun résultat</h3>
        <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto">
          Aucun élève ne correspond à votre recherche pour le moment.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-white/5 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10">
      {filteredEleves.map((e) => (
        <li
          key={e.id}
          className={`px-8 py-5 flex items-center gap-5 cursor-pointer transition-all duration-500 relative group overflow-hidden ${
            selectedEleve?.id === e.id ? 'bg-white/10' : 'hover:bg-white/5 hover:translate-x-1'
          }`}
          onClick={() => setSelectedEleve(e)}
        >
          {selectedEleve?.id === e.id && (
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 shadow-[2px_0_10px_rgba(16,185,129,0.3)] animate-in slide-in-from-left duration-300" />
          )}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg transition-transform duration-500 group-hover:scale-105 border border-white/10 ${
            selectedEleve?.id === e.id ? 'bg-emerald-600 rotate-3 border-emerald-500/30' : 'bg-slate-900 grayscale-[0.2] group-hover:grayscale-0'
          }`}>
            {e.prenom[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-base font-black truncate transition-colors uppercase tracking-tight ${selectedEleve?.id === e.id ? 'text-emerald-400' : 'text-white'}`}>
              {e.prenom} {e.nom}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-slate-400 font-bold tracking-[0.1em] uppercase mt-0.5">
                {(e.classe as any)?.nom_classe ?? 'NON ASSIGNÉ'} · <span className="text-slate-400 font-black">{e.matricule}</span>
              </p>
              {getEleveBalance(e.id).reste > 0 && (
                <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                  Reste: {getEleveBalance(e.id).reste.toLocaleString('fr-FR')} F
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {/* Affichage détaillé des statuts d'inscription, mensualité et montants restants */}
            {(() => {
              const efs = elevesFrais.filter(ef => ef.eleve_id === e.id)
              let retardsMensuels: string[] = []
              let isInscriptionPaid = true
              let hasInscriptionFee = false

              // Compute remaining amounts for inscription and monthly fees
              let inscriptionRemaining = 0
              let mensualiteRemaining = 0
              let monthlyFee: any = null

              for (const ef of efs) {
                const f = frais.find(fr => fr.id === ef.frais_id)
                if (f) {
                  const lib = (f.libelle || '').toLowerCase()
                  if (f.frequence === 'mensuel' || lib.includes('mensu') || lib.includes('scolarit')) {
                    // monthly fee
                    monthlyFee = f
                    retardsMensuels = [...retardsMensuels, ...getMoisEnRetard(e.id, ef.frais_id)]
                  } else {
                    const aPayer = Number(ef.montant_a_payer) || (Number(ef.montant_du) - (Number(ef.montant_remise) || 0)) || 0
                    const paye = paiements.filter(p => p.eleve_id === e.id && p.frais_id === ef.frais_id).reduce((s, p) => s + Number(p.montant), 0)
                    if (lib.includes('inscription')) {
                      hasInscriptionFee = true
                      if (aPayer > paye) isInscriptionPaid = false
                      inscriptionRemaining = Math.max(0, aPayer - paye)
                    }
                  }
                }
              }

              // calculate remaining for monthly if fee exists
              if (monthlyFee) {
                const totalPaidMonthly = paiements.filter(p => p.eleve_id === e.id && p.frais_id === monthlyFee.id).reduce((s, p) => s + Number(p.montant), 0)
                const amountDue = Number(monthlyFee.montant) || 0
                mensualiteRemaining = Math.max(0, amountDue - totalPaidMonthly)
              }

              retardsMensuels = Array.from(new Set(retardsMensuels))

              return (
                <div className="flex flex-col gap-1 items-end w-full max-w-[140px]">
                  {hasInscriptionFee && (
                    <div className="flex flex-col items-end">
                      <span className={`w-full text-right text-[8px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-md border shadow-sm truncate ${isInscriptionPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}> 
                        Inscrip: {isInscriptionPaid ? 'Payée' : 'Impayée'}
                      </span>
                      <span className="text-[8px] font-black text-slate-400">{inscriptionRemaining.toLocaleString('fr-FR')} F</span>
                    </div>
                  )}
                  <span className={`w-full text-right text-[8px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-md border shadow-sm truncate ${retardsMensuels.length === 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}> 
                    {retardsMensuels.length === 0 ? 'Mois: À Jour' : `Mois Retard: ${retardsMensuels.length}`}
                  </span>
                  {monthlyFee && (
                    <span className="text-[8px] font-black text-slate-400">{mensualiteRemaining.toLocaleString('fr-FR')} F</span>
                  )}
                </div>
              )
            })()}
            {activeTab === 'impayes' && (
              <div className="flex items-center gap-2">
                 {e.telephone_parent ? (
                   <button
                     onClick={(evt) => {
                       evt.stopPropagation()
                       const { reste } = getEleveBalance(e.id)
                       handleWhatsAppReminder(e, reste)
                     }}
                     className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                     title="Relancer sur WhatsApp"
                   >
                     <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                       <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                     </svg>
                   </button>
                 ) : (
                   <div className="flex items-center gap-1" onClick={(evt) => evt.stopPropagation()}>
                     {editingPhoneId === e.id ? (
                       <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                         <input
                           autoFocus
                           type="text"
                           value={tempPhone}
                           onChange={(ev) => setTempPhone(ev.target.value)}
                           placeholder="+221..."
                           className="w-24 px-2 py-1.5 bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold outline-none text-white placeholder:text-slate-500"
                           onKeyDown={(ev) => ev.key === 'Enter' && handleUpdatePhone(e.id)}
                         />
                         <button onClick={() => handleUpdatePhone(e.id)} className="p-1.5 bg-emerald-500 text-white rounded-lg"><CheckCircle2 className="w-3 h-3"/></button>
                       </div>
                     ) : (
                       <button
                         onClick={() => { setEditingPhoneId(e.id); setTempPhone('') }}
                         className="text-[9px] font-black uppercase text-slate-400 hover:text-emerald-600 flex items-center gap-1"
                       >
                         <CreditCard className="w-3 h-3" /> Ajouter Tel.
                       </button>
                     )}
                   </div>
                 )}
              </div>
            )}
            
            {activeTab === 'impayes' && elevesFrais.find(ef => ef.eleve_id === e.id)?.derniere_relance_le && (
              <p className="text-[8px] font-bold text-slate-500 uppercase italic">Relancé le {elevesFrais.find(ef => ef.eleve_id === e.id)?.derniere_relance_le}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
