'use client'

import { useState } from 'react'
import { HelpCircle, X, ChevronRight, CheckCircle, Info } from 'lucide-react'

export default function QuickGuide() {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:bg-emerald-600 hover:scale-110 transition-all group"
      >
        <HelpCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>
    )
  }

  const steps = [
    { title: 'Présences', desc: 'Marquez les absences en un clic ou scannez les QR codes des élèves.' },
    { title: 'Notes & Bulletins', desc: 'Saisissez les notes par matière. Les moyennes et bulletins se calculent tout seuls.' },
    { title: 'Synchronisation', desc: 'EduMatrix fonctionne sans internet. Vos données se synchronisent dès que vous captez du réseau.' },
    { title: 'Paiements', desc: 'Suivez qui a payé les frais de scolarité directement sur le tableau de bord.' },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-in zoom-in duration-500">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16" />
        
        <div className="p-8 md:p-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Guide Rapide EduMatrix</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="space-y-6">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-4 group">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-emerald-600 transition-colors">
                  {idx + 1}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-wider">{step.title}</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-full mt-10 py-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
          >
            J&apos;ai compris !
            <CheckCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
