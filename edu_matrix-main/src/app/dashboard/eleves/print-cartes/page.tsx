'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Eleve, Classe, Ecole } from '@/lib/supabase'
import { Loader2, Printer, ArrowLeft, BookOpen, User, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { generateSecureQRData } from '@/lib/qrSecurity'
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
      const { data: cls } = await supabase.from('classes' as any).select('*').eq('id', classeId as any).single() as { data: Classe | null; error: any }
      if (cls) {
        setClasse(cls)
        const { data: ec } = await supabase.from('ecoles' as any).select('*').eq('id', cls.ecole_id).single() as { data: Ecole | null; error: any }
        if (ec) setEcole(ec)
      }

      const { data: elv } = await supabase
        .from('eleves' as any)
        .select('*')
        .eq('classe_id', classeId as any)
        .order('nom')
      
      setEleves(elv as any || [])
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
          const qrData = generateSecureQRData(eleve.id)

          return (
            <div 
              key={eleve.id} 
              className={`relative overflow-hidden bg-white shrink-0 print:shadow-none print:border-slate-800 print:break-inside-avoid print-card border border-slate-200 rounded-xl shadow-sm`}
              style={{ width: '85.6mm', height: '54mm', fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
            >
              {/* Arrière-plan premium : motifs et dégradés */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500 rounded-full mix-blend-multiply filter blur-2xl opacity-40 pointer-events-none"></div>
              <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-amber-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 pointer-events-none"></div>
              <div className="absolute right-0 bottom-0 w-[40mm] h-[60mm] bg-emerald-600 opacity-[0.03] -rotate-45 translate-x-4 translate-y-4 pointer-events-none"></div>

              {/* Header : Bandeau d'en-tête */}
              <div className="h-[12mm] bg-emerald-700 w-full flex items-center px-4 relative z-10 overflow-hidden shadow-sm">
                <div className="absolute bottom-0 left-0 w-full h-[2mm] bg-amber-400"></div>
                
                {ecole.logo_url ? (
                  <img src={ecole.logo_url} className="w-[8mm] h-[8mm] object-contain bg-white rounded-full p-0.5 shadow-sm mr-2" alt="" />
                ) : (
                  <div className="w-[8mm] h-[8mm] bg-white rounded-full shadow-sm mr-2 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[12px] tracking-widest leading-tight uppercase text-white truncate drop-shadow-md">
                    {ecole.nom}
                  </h3>
                  <p className="text-[7px] font-bold text-emerald-100 uppercase tracking-widest mt-0.5">
                    Carte d'identité scolaire • {new Date().getFullYear()}
                  </p>
                </div>
              </div>

              {/* Corps de la carte */}
              <div className="p-3 flex gap-3 h-[42mm] relative z-10">
                {/* Photo Élève */}
                <div className="w-[24mm] h-[32mm] bg-slate-100 rounded-xl overflow-hidden shrink-0 border-2 border-white shadow-md relative">
                  {eleve.photo_url ? (
                    <img src={eleve.photo_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 font-black bg-gradient-to-br from-slate-50 to-slate-200">
                      <User className="w-8 h-8 mb-1 opacity-50" />
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-amber-400 rounded-full border-2 border-white"></div>
                </div>

                {/* Informations Élève */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h2 className="font-black text-[14px] leading-none text-slate-900 uppercase truncate">
                    {eleve.nom || '—'}
                  </h2>
                  <h3 className="font-bold text-[11px] text-slate-700 leading-tight truncate mt-1">
                    {eleve.prenom || '—'}
                  </h3>
                  
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] uppercase font-black text-slate-400 tracking-widest w-10">Classe</span>
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">{classe.nom_classe}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] uppercase font-black text-slate-400 tracking-widest w-10">Mat.</span>
                      <span className="text-[9px] font-bold text-slate-700 tracking-widest">{eleve.matricule || 'XXX'}</span>
                    </div>
                  </div>
                </div>

                {/* Section QR Code */}
                <div className="w-[18mm] flex flex-col items-center justify-end pb-1 shrink-0">
                  <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm relative group">
                    <QRCodeSVG value={qrData} size={54} level="H" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <div className="bg-white rounded-full p-0.5 shadow-sm">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
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
