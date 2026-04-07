'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Eleve, Classe, Ecole } from '@/lib/supabase'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function PrintCartesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const classeId = searchParams.get('classeId')

  const [eleves, setEleves] = useState<Eleve[]>([])
  const [classe, setClasse] = useState<Classe | null>(null)
  const [ecole, setEcole] = useState<Ecole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (classeId) loadData()
  }, [classeId])

  async function loadData() {
    setLoading(true)
    try {
      const { data: cls } = await supabase.from('classes').select('*').eq('id', classeId).single()
      if (cls) {
        setClasse(cls)
        const { data: ec } = await supabase.from('ecoles').select('*').eq('id', cls.ecole_id).single()
        if (ec) setEcole(ec)
      }

      const { data: elv } = await supabase
        .from('eleves')
        .select('*')
        .eq('classe_id', classeId)
        .order('nom')
      
      setEleves(elv || [])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!classe || !ecole) {
    return <div className="p-8 text-center text-red-500 font-bold">Erreur : Classe ou école introuvable.</div>
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white text-slate-800">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-semibold mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour aux élèves
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Cartes Scolaires : {classe.nom_classe}</h1>
          <p className="text-slate-500 mt-1">{eleves.length} élèves générés. Configurez votre imprimante sans marges.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95"
        >
          <Printer className="w-5 h-5" />
          Imprimer les cartes
        </button>
      </div>

      <div className="max-w-4xl mx-auto flex flex-wrap gap-4 print:grid print:grid-cols-2 print:gap-x-8 print:gap-y-8 justify-center print:justify-center print:w-full print:m-0">
        {eleves.map((eleve, idx) => {
          const qrData = JSON.stringify({ id: eleve.id, matricule: eleve.matricule })
          // Use qrserver api explicitly asking for high res
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`

          return (
            <div 
              key={eleve.id} 
              className={`border-[1.5px] border-slate-200 rounded-xl p-4 bg-white relative overflow-hidden shadow-sm flex gap-4 shrink-0 
                 print:shadow-none print:border-slate-800 print:break-inside-avoid card
              `}
              // Standard CR80 card dimensions
              style={{ width: '85.6mm', height: '54mm' }}
            >
             {/* Left: Photo + details */}
             <div className="flex-1 flex flex-col justify-between z-10 w-full min-w-0">
                <div>
                  <h3 className="font-extrabold text-[12px] tracking-tight leading-tight uppercase text-emerald-800 truncate">{ecole.nom}</h3>
                  <p className="text-[9px] font-semibold text-slate-500 uppercase mt-0.5 tracking-wider">{classe.nom_classe} • 2026</p>
                </div>
                
                <div className="flex gap-3 items-center mt-auto pb-1">
                  <div className="w-[50px] h-[50px] bg-slate-100 rounded-md overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                    {eleve.photo_url ? (
                      <img src={eleve.photo_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-100 text-lg">
                        {eleve.prenom[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 pr-1">
                    <h2 className="font-black text-[13px] leading-tight text-slate-900 uppercase truncate">{eleve.nom}</h2>
                    <h3 className="font-bold text-[11px] text-slate-700 leading-tight truncate mt-0.5">{eleve.prenom}</h3>
                    <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase tracking-wider">Mat: {eleve.matricule || 'XXX'}</p>
                  </div>
                </div>
             </div>
             
             {/* Right: Logos & QR Code */}
             <div className="w-[55px] shrink-0 flex flex-col justify-between items-end z-10">
               {ecole.logo_url ? (
                 <img src={ecole.logo_url} className="w-[35px] h-[35px] object-contain mb-1 drop-shadow-sm" alt="" />
               ) : (
                 <div className="w-[35px] h-[35px] bg-emerald-50 rounded border border-emerald-100 mb-1" />
               )}
               <img src={qrUrl} alt="QR" className="w-[50px] h-[50px] rounded border border-slate-200 p-0.5 bg-white shadow-sm" />
             </div>

             {/* Background decorative elements */}
             <div className="absolute top-0 right-0 w-[54mm] h-[54mm] bg-gradient-to-bl from-emerald-50 to-transparent rounded-full opacity-60 z-0 pointer-events-none translate-x-1/2 -translate-y-1/2" />
             <div className="absolute left-0 bottom-0 w-[8mm] h-[85.6mm] bg-emerald-600 opacity-80 z-0 pointer-events-none -rotate-12 translate-y-10 -translate-x-4" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PrintCartesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    }>
      <PrintCartesContent />
    </Suspense>
  )
}
