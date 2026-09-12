'use client'

import { useState, useEffect, useRef } from 'react'
import {
  QrCode, CheckCircle2, AlertCircle, Clock,
  Loader2, UserCheck, RefreshCw, Camera
} from 'lucide-react'
import { useNetwork } from '@/hooks/useNetwork'
import { getTodayDate } from '@/lib/dateUtils'
import { db } from '@/lib/db'
import { syncFromSupabase, addToSyncQueue } from '@/lib/syncService'
import { supabase } from '@/lib/supabase'
import type { LocalClasse, LocalEleve } from '@/lib/db'
import { useProfile } from '@/hooks/useProfile'
import { verifySecureQRData } from '@/lib/qrSecurity'
import CameraQRCodeScanner from './CameraQRCodeScanner'

interface ScanResult {
  status: 'success' | 'already' | 'error' | 'not_found'
  message: string
  studentName?: string
  matricule?: string
  statutPaiement?: string
  paymentWarning?: string
}

const SCHOOL_MONTHS = [
  'Octobre', 'Novembre', 'Décembre', 'Janvier',
  'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet'
]

function getCurrentSchoolMonthIndex(): number {
  const date = new Date()
  const m = date.getMonth()
  const d = date.getDate()

  let currentMonthName = ''
  if (m === 9) currentMonthName = 'Octobre'
  else if (m === 10) currentMonthName = 'Novembre'
  else if (m === 11) currentMonthName = 'Décembre'
  else if (m === 0) currentMonthName = 'Janvier'
  else if (m === 1) currentMonthName = 'Février'
  else if (m === 2) currentMonthName = 'Mars'
  else if (m === 3) currentMonthName = 'Avril'
  else if (m === 4) currentMonthName = 'Mai'
  else if (m === 5) currentMonthName = 'Juin'
  else if (m === 6) currentMonthName = 'Juillet'
  
  let index = SCHOOL_MONTHS.indexOf(currentMonthName)
  
  if (index === -1) {
    if (m === 7 || m === 8) return SCHOOL_MONTHS.length - 1
    return 0
  }

  // Règle du 5 du mois : si on est avant le 5, le mois courant n'est pas encore "en retard"
  if (d < 5 && index > 0) {
    index -= 1
  } else if (d < 5 && index === 0) {
    return -1 // Pas encore de retard possible avant le 5 octobre
  }

  return index
}

// ─────────────────────────────────────────
// Process a scanned student ID (Offline-compatible)
// ─────────────────────────────────────────
async function processAttendance(studentId: string, classeId: string, ecoleId: string): Promise<ScanResult> {
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine
  
  try {
    let eleve = null

    // 1. Fetch Student: Try Supabase first if online
    if (isOnline) {
      // Check if studentId is a valid UUID to avoid 400 error on id.eq
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)
      
      let query = (supabase as any).from('eleves').select('*')
      if (isUUID) {
        query = query.or(`id.eq.${studentId},matricule.eq.${studentId}`)
      } else {
        query = query.eq('matricule', studentId)
      }
      
      const { data, error } = await query
        .eq('ecole_id', ecoleId)
        .maybeSingle()
      
      if (!error && data) {
        eleve = data
        if (db) {
          try {
            await db.table('eleves').put(data)
          } catch (e) {
            console.warn('Sync student fail:', e)
          }
        }
      }
    }

    // 2. Fallback to Dexie
    if (!eleve && db) {
      try {
        const eleveTable = db.table('eleves')
        eleve = await eleveTable.get(studentId)
        if (!eleve) {
          eleve = await eleveTable.where('matricule').equals(studentId).first()
        }
      } catch (e) {
        console.warn('Local student fetch fail:', e)
      }
    }

    if (!eleve) {
      return { status: 'not_found', message: 'Élève introuvable (Vérifiez la connexion ou le matricule).' }
    }

    const realStudentId = eleve.id
    const today = getTodayDate()
    const now   = new Date().toTimeString().split(' ')[0]

    // 3. Check for existing presence
    let existing = null
    if (isOnline) {
      const { data } = await (supabase as any)
        .from('presences')
        .select('*')
        .eq('eleve_id', realStudentId)
        .eq('date', today)
        .maybeSingle()
      existing = data
    }

    if (!existing && db) {
      try {
        const presenceTable = db.table('presences')
        existing = await presenceTable
          .where('eleve_id').equals(realStudentId)
          .and((p: any) => p.date === today)
          .first()
      } catch (e) {
        console.warn('Local presence check fail:', e)
      }
    }

    // 3.5 Check for payment warnings
    let paymentWarning: string | undefined = undefined
    try {
      let efs: any[] = []
      let frs: any[] = []
      let pmts: any[] = []

      if (isOnline) {
        const [resEf, resFr, resPmts] = await Promise.all([
          (supabase as any).from('eleves_frais').select('*').eq('eleve_id', realStudentId),
          (supabase as any).from('frais_scolaires').select('*').eq('ecole_id', ecoleId),
          (supabase as any).from('paiements').select('*').eq('eleve_id', realStudentId)
        ])
        efs = resEf.data || []
        frs = resFr.data || []
        pmts = resPmts.data || []
      } else if (db) {
        efs = await db.eleves_frais.where('eleve_id').equals(realStudentId).toArray()
        frs = await db.frais_scolaires.where('ecole_id').equals(ecoleId).toArray()
        pmts = await db.paiements.where('eleve_id').equals(realStudentId).toArray()
      }

      const currentIndex = getCurrentSchoolMonthIndex()
      
      if (currentIndex >= 0) {
        let retardsMensuels: string[] = []
        for (const ef of efs) {
          const f = frs.find((fr: any) => fr.id === ef.frais_id)
          if (f) {
            const lib = (f.libelle || '').toLowerCase()
            if (f.frequence === 'mensuel' || lib.includes('mensu') || lib.includes('scolarit')) {
              const moisPayes = pmts
                .filter((p: any) => p.frais_id === ef.frais_id)
                .map((p: any) => p.mois)
                .filter(Boolean)
              
              const pastMonths = SCHOOL_MONTHS.slice(0, currentIndex + 1)
              const missing = pastMonths.filter(m => !moisPayes.includes(m))
              retardsMensuels = [...retardsMensuels, ...missing]
            }
          }
        }
        
        retardsMensuels = Array.from(new Set(retardsMensuels))
        if (retardsMensuels.length > 0) {
          paymentWarning = `Mensualité(s) impayée(s) : ${retardsMensuels.join(', ')}`
        }
      }
    } catch (e) {
      console.warn('Error calculating payment warning:', e)
    }

    if (existing) {
      return {
        status: 'already',
        message: `Présence déjà enregistrée à ${existing.heure.slice(0, 5)}`,
        studentName: `${eleve.prenom} ${eleve.nom}`,
        matricule:   eleve.matricule ?? undefined,
        statutPaiement: eleve.statut_paiement,
        paymentWarning
      }
    }

    // 3.5 Fetch Ecole for settings
    let ecole = null
    if (isOnline) {
      const { data } = await (supabase as any)
        .from('ecoles')
        .select('heure_limite_retard')
        .eq('id', ecoleId)
        .maybeSingle()
      ecole = data
    }
    if (!ecole && db) {
      try {
        ecole = await db.ecoles.get(ecoleId)
      } catch (e) {
        console.warn('Local ecole fetch fail:', e)
      }
    }

    // 4. Calculate status
    const d = new Date()
    const hour = d.getHours()
    const min  = d.getMinutes()
    
    let limitHour = 8;
    let limitMin = 30;
    if (ecole?.heure_limite_retard) {
       const parts = ecole.heure_limite_retard.split(':');
       if (parts.length >= 2) {
         const h = parseInt(parts[0], 10);
         const m = parseInt(parts[1], 10);
         if (!isNaN(h) && !isNaN(m)) {
           limitHour = h;
           limitMin = m;
         }
       }
    }
    
    const statut = (hour > limitHour || (hour === limitHour && min >= limitMin)) ? 'retard' : 'présent'

    const presenceData = {
      id: crypto.randomUUID(),
      ecole_id: ecoleId,
      eleve_id:  realStudentId,
      classe_id: eleve.classe_id,
      date:      today,
      heure:     now,
      statut,
    }

    // 5. Save Presence: Try Supabase first if online
    if (isOnline) {
      try {
        const { error } = await (supabase as any)
          .from('presences')
          .insert(presenceData)
        
        if (error) {
          console.warn('[Attendance] Supabase error, falling back to local sync:', error)
          if (db) {
            await db.presences.put(presenceData as any)
            await addToSyncQueue('presences', 'INSERT', presenceData as any, ecoleId)
          }
        } else if (db) {
          // Success: update Dexie cache
          await db.presences.put(presenceData as any)
        }
      } catch (err) {
        console.warn('[Attendance] Network exception:', err)
          if (db) {
            await db.presences.put(presenceData as any)
            await addToSyncQueue('presences', 'INSERT', presenceData as any, ecoleId)
          }
      }
    } else if (db) {
      // Offline mode
      await db.presences.put(presenceData as any)
      await addToSyncQueue('presences', 'INSERT', presenceData as any, ecoleId)
    }

    return {
      status: 'success',
      message: statut === 'retard'
        ? `Présence enregistrée avec retard (${now.slice(0,5)})`
        : `Présence confirmée à ${now.slice(0,5)}`,
      studentName: `${eleve.prenom} ${eleve.nom}`,
      matricule:   eleve.matricule ?? undefined,
      statutPaiement: eleve.statut_paiement,
      paymentWarning
    }
  } catch (error) {
    console.error('Error in processAttendance:', error)
    return { status: 'error', message: 'Erreur technique lors de l\'enregistrement.' }
  }
}

// ─────────────────────────────────────────
// Result display
// ─────────────────────────────────────────
function ScanResultCard({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  const config = {
    success:   { bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: CheckCircle2, iconColor: 'text-emerald-600', titleColor: 'text-emerald-800' },
    already:   { bg: 'bg-amber-50',    border: 'border-amber-200',   icon: Clock,        iconColor: 'text-amber-600',   titleColor: 'text-amber-800' },
    error:     { bg: 'bg-red-50',      border: 'border-red-200',     icon: AlertCircle,  iconColor: 'text-red-600',     titleColor: 'text-red-800' },
    not_found: { bg: 'bg-slate-50',    border: 'border-slate-200',   icon: AlertCircle,  iconColor: 'text-slate-500',   titleColor: 'text-slate-700' },
  }
  const c   = config[result.status]
  const Icon = c.icon

  return (
    <div className={`rounded-3xl border-2 p-6 md:p-8 ${c.bg} ${c.border} shadow-lg transition-all animate-in zoom-in-95 duration-300`}>
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
        <Icon className={`w-12 h-12 shrink-0 ${c.iconColor} drop-shadow-sm`} />
        <div className="flex-1 w-full">
          {result.studentName && (
            <p className={`font-black text-xl md:text-2xl tracking-tight leading-tight ${c.titleColor}`}>{result.studentName}</p>
          )}
          {result.matricule && (
            <p className="text-sm font-bold opacity-60 uppercase tracking-widest mt-1 mb-2">{result.matricule}</p>
          )}
          <p className={`text-base font-medium ${c.titleColor}`}>{result.message}</p>
          
          {result.statutPaiement && (
            <div className="mt-4 pt-4 border-t border-black/5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Paiement Global</span>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest ${
                  result.statutPaiement === 'payé' ? 'bg-emerald-100 text-emerald-700' :
                  result.statutPaiement === 'partiel' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {result.statutPaiement}
                </span>
              </div>
              
              {result.paymentWarning && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 mt-2 animate-in slide-in-from-bottom-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-red-700">Retard de paiement</p>
                    <p className="text-xs font-medium text-red-600/80 mt-0.5">{result.paymentWarning}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onReset}
        className="mt-6 w-full flex items-center justify-center gap-2 text-sm font-bold bg-white border-2 border-slate-200/60 rounded-xl py-3.5 hover:bg-slate-50 transition-all text-slate-700 shadow-sm active:scale-95"
      >
        <RefreshCw className="w-4 h-4" />
        Scanner suivant
      </button>
    </div>
  )
}

// ─────────────────────────────────────────
// Main Scanner Component
// ─────────────────────────────────────────
export default function AttendanceScanner({ classeId }: { classeId: string }) {
  const [manualId, setManualId]   = useState('')
  const [result, setResult]       = useState<ScanResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const { isOnline, pendingCount } = useNetwork()
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { profile } = useProfile()
  const ecoleId = profile?.ecole_id

  useEffect(() => {
    loadTodayCount()
    // Auto-focus input for scanner device
    inputRef.current?.focus()
  }, [])

  async function loadTodayCount() {
    if (!db) return
    try {
      const today = getTodayDate()
      const presenceTable = db.table('presences')
      const count = await presenceTable
        .where('date').equals(today)
        .count()
      setTodayCount(count)
    } catch (e) {
      console.log('loadTodayCount dexie error', e)
    }
  }

  async function handleScan(scannedData: string) {
    if (!scannedData.trim() || !ecoleId) return
    const trimmedData = scannedData.trim()
    
    // Vérification de la signature du QR Code
    const studentId = verifySecureQRData(trimmedData)
    
    if (!studentId) {
      setResult({ status: 'error', message: 'QR Code invalide ou falsifié.' })
      setManualId('')
      return
    }

    setLoading(true)
    try {
      const r = await processAttendance(studentId, classeId, ecoleId)
      setResult(r)
      if (r.status === 'success') {
        setTodayCount((c) => c + 1)
      }
    } catch (err) {
      console.error('[Scanner] handleScan error:', err)
      setResult({ status: 'error', message: 'Une erreur inattendue est survenue.' })
    } finally {
      setLoading(false)
      setManualId('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleScan(manualId)
  }

  function reset() {
    setResult(null)
    setManualId('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div className="max-w-md mx-auto space-y-4">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-emerald-100 p-2 rounded-xl">
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Scanner de présences</h2>
            <p className="text-xs text-slate-400">{todayCount} élève(s) enregistré(s) aujourd&apos;hui</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
            isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </span>
          {isOnline && pendingCount === 0 && (
            <span className="text-slate-400">Tout synchronisé ✓</span>
          )}
          {pendingCount > 0 && (
            <span className="text-amber-600 font-bold">{pendingCount} en attente...</span>
          )}
        </div>
      </div>

      {/* Scanner input */}
      {!result && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-6 space-y-6">
          <button
            onClick={() => setShowCamera(true)}
            className="w-full bg-slate-50 border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-[1.5rem] flex flex-col items-center justify-center py-10 gap-4 transition-all group active:scale-[0.98]"
          >
            <div className="bg-white p-4 rounded-full shadow-sm group-hover:shadow-md transition-shadow group-hover:bg-emerald-500">
              <QrCode className="w-10 h-10 text-slate-400 group-hover:text-white transition-colors" />
            </div>
            <div className="text-center px-4">
              <p className="font-black text-slate-700 text-lg group-hover:text-emerald-700 transition-colors">Scanner par Caméra</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                Appuyez ici pour utiliser l'appareil photo de votre téléphone
              </p>
            </div>
          </button>

          <div className="relative flex items-center">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <CheckCircle2 className="w-5 h-5 text-slate-300" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ID élève manuel..."
              className="w-full border-2 border-slate-100 rounded-2xl pl-12 pr-16 py-4 text-base font-bold placeholder:font-medium focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-white transition-all shadow-sm"
              disabled={loading}
            />
            <button
              onClick={() => handleScan(manualId)}
              disabled={loading || !manualId.trim()}
              className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-4 rounded-xl transition-all shadow-sm flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'OK'}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
            Un scanner physique appuyera sur entrée automatiquement
          </p>
        </div>
      )}

      {/* Result */}
      {result && <ScanResultCard result={result} onReset={reset} />}

      {/* Camera Mode Overlay */}
      {showCamera && (
        <CameraQRCodeScanner 
          onScan={(id) => {
            handleScan(id)
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}