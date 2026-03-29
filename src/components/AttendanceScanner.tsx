'use client'

// src/components/AttendanceScanner.tsx
// QR-based attendance registration
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  QrCode, CheckCircle2, AlertCircle, Clock,
  Loader2, UserCheck, X, RefreshCw, Camera
} from 'lucide-react'

interface ScanResult {
  status: 'success' | 'already' | 'error' | 'not_found'
  message: string
  studentName?: string
  matricule?: string
  statutPaiement?: string
  paymentDetails?: string
}

import CameraQRCodeScanner from './CameraQRCodeScanner'

interface OfflineAttendanceEvent {
  eleve_id: string
  classe_id: string
  created_at: string
}

const OFFLINE_KEY = 'edumatrix_offline_attendance'

// ─────────────────────────────────────────
// Process a scanned student ID
// ─────────────────────────────────────────
async function processAttendance(studentId: string, classeId: string): Promise<ScanResult> {
  try {
    // 1. Fetch student
    let { data: eleve, error: eleveError } = await supabase
      .from('eleves')
      .select('id, prenom, nom, matricule, classe_id, statut_paiement')
      .eq('id', studentId)
      .single()

    // Fallback: search by matricule if not found by UUID
    if (eleveError || !eleve) {
      const { data: eleveByMatricule, error: matError } = await supabase
        .from('eleves')
        .select('id, prenom, nom, matricule, classe_id, statut_paiement')
        .eq('matricule', studentId)
        .single()
      
      if (matError || !eleveByMatricule) {
        return { status: 'not_found', message: 'Élève introuvable dans le système.' }
      }
      eleve = eleveByMatricule
    }

    // CRITICAL: Use the resolved UUID from the database, not the input string (which might be a matricule)
    const realStudentId = eleve.id
    const today = new Date().toISOString().split('T')[0]
    const now   = new Date().toTimeString().split(' ')[0]

    // 2. Check if already registered today
    const { data: existing } = await supabase
      .from('presences')
      .select('id, statut, heure')
      .eq('eleve_id', realStudentId)
      .eq('date', today)
      .maybeSingle() // Use maybeSingle to avoid 406 errors if not found

    const { data: payDetails } = await supabase.rpc('get_payment_coverage_status', { p_eleve_id: realStudentId })

    if (existing) {
      return {
        status: 'already',
        message: `Présence déjà enregistrée à ${existing.heure.slice(0, 5)}`,
        studentName: `${eleve.prenom} ${eleve.nom}`,
        matricule:   eleve.matricule ?? undefined,
        statutPaiement: eleve.statut_paiement,
        paymentDetails: payDetails ?? 'Statut inconnu'
      }
    }

    // 3. Determine status (retard if after 8:30)
    const hour = new Date().getHours()
    const min  = new Date().getMinutes()
    const statut = (hour > 8 || (hour === 8 && min >= 30)) ? 'retard' : 'présent'

    // 4. Insert presence
    const { error: insertError } = await supabase
      .from('presences')
      .insert({
        eleve_id:  realStudentId,
        classe_id: eleve.classe_id,
        date:      today,
        heure:     now,
        statut,
      })

    if (insertError) throw insertError

    return {
      status: 'success',
      message: statut === 'retard'
        ? `Présence enregistrée avec retard (${now.slice(0,5)})`
        : `Présence confirmée à ${now.slice(0,5)}`,
      studentName: `${eleve.prenom} ${eleve.nom}`,
      matricule:   eleve.matricule ?? undefined,
      statutPaiement: eleve.statut_paiement,
      paymentDetails: payDetails ?? 'Statut inconnu'
    }
  } catch (error) {
    console.error('Error in processAttendance:', error)
    return { status: 'error', message: 'Erreur lors de l\'enregistrement. Réessayez.' }
  }
}

function loadOfflineQueue(): OfflineAttendanceEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(OFFLINE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveOfflineQueue(events: OfflineAttendanceEvent[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OFFLINE_KEY, JSON.stringify(events))
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
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Paiement</span>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest ${
                  result.statutPaiement === 'payé' ? 'bg-emerald-100 text-emerald-700' :
                  result.statutPaiement === 'partiel' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {result.statutPaiement}
                </span>
              </div>
              {result.paymentDetails && (
                <div className="flex items-center gap-3 bg-black/5 p-3 rounded-xl border border-black/5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${result.statutPaiement === 'payé' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                  <span className="text-xs font-bold text-slate-700 leading-tight">{result.paymentDetails}</span>
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
// Uses manual input as fallback (no camera API needed)
// ─────────────────────────────────────────
export default function AttendanceScanner({ classeId }: { classeId: string }) {
  const [manualId, setManualId]   = useState('')
  const [result, setResult]       = useState<ScanResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [isOnline, setIsOnline]   = useState(true)
  const [pendingOffline, setPendingOffline] = useState(0)
  const [showCamera, setShowCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadTodayCount()
    // Auto-focus input for scanner device
    inputRef.current?.focus()
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const updateOnline = () => setIsOnline(true)
    const updateOffline = () => setIsOnline(false)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOffline)
    // initial pending
    setPendingOffline(loadOfflineQueue().length)
    // try sync on mount
    if (navigator.onLine) {
      void syncOfflineEvents()
    }
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOffline)
    }
  }, [])

  async function syncOfflineEvents() {
    const queue = loadOfflineQueue()
    if (!queue.length) return
    const remaining: OfflineAttendanceEvent[] = []
    for (const ev of queue) {
      try {
        const r = await processAttendance(ev.eleve_id, ev.classe_id)
        if (r.status === 'success' || r.status === 'already') {
          // ok, do not requeue
        } else {
          remaining.push(ev)
        }
      } catch {
        remaining.push(ev)
      }
    }
    saveOfflineQueue(remaining)
    setPendingOffline(remaining.length)
    // refresh count from server
    await loadTodayCount()
  }

  async function loadTodayCount() {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('presences')
      .select('id', { count: 'exact', head: true })
      .eq('date', today)
    setTodayCount(count ?? 0)
  }

  async function handleScan(studentId: string) {
    if (!studentId.trim()) return
    const trimmed = studentId.trim()

    // Offline: stocker localement puis afficher un message
    if (!isOnline) {
      const queue = loadOfflineQueue()
      const ev: OfflineAttendanceEvent = {
        eleve_id: trimmed,
        classe_id: classeId,
        created_at: new Date().toISOString(),
      }
      const updated = [...queue, ev]
      saveOfflineQueue(updated)
      setPendingOffline(updated.length)
      setTodayCount((c) => c + 1)
      setResult({
        status: 'success',
        message: 'Présence enregistrée hors ligne. Elle sera synchronisée dès que la connexion reviendra.',
      })
      setManualId('')
      return
    }

    setLoading(true)
    const r = await processAttendance(trimmed, classeId)
    setResult(r)
    if (r.status === 'success') {
      setTodayCount((c) => c + 1)
    }
    setLoading(false)
    setManualId('')
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

      {/* ── Offline Banner ── */}
      {!isOnline && (
        <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 animate-pulse">
          <span className="text-2xl">📶</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-800 text-sm">Mode Hors-Ligne activé</p>
            <p className="text-amber-600 text-xs mt-0.5 leading-tight">
              Les présences sont sauvegardées localement.
              Elles seront <strong>synchronisées automatiquement</strong> dès le retour du réseau.
            </p>
          </div>
        </div>
      )}

      {/* ── Pending sync banner (shown when back online with pending items) ── */}
      {isOnline && pendingOffline > 0 && (
        <button
          type="button"
          onClick={() => void syncOfflineEvents()}
          className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-left hover:bg-blue-100 transition-colors group"
        >
          <span className="text-xl">🔄</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-blue-800 text-sm">Synchronisation en attente</p>
            <p className="text-blue-600 text-xs">
              {pendingOffline} présence(s) hors-ligne à synchroniser. Cliquez pour synchroniser maintenant.
            </p>
          </div>
        </button>
      )}

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
          {isOnline && pendingOffline === 0 && (
            <span className="text-slate-400">Tout synchronisé ✓</span>
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