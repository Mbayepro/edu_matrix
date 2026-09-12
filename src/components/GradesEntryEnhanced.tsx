'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, FileText, Plus, X, Trash2, Edit2, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { getTodayDate } from '@/lib/dateUtils'
import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/lib/db'
import { addToSyncQueue, syncFromSupabase } from '@/lib/syncService'

interface Matiere {
  id: string
  nom: string
  coefficient: number
  is_obligatoire: boolean
}

interface Evaluation {
  id: string
  type: 'controle' | 'devoir' | 'composition'
  date: string
  coef: number
  bareme: number
  matiere_id: string
  libelle?: string
  ecole_id?: string
  classe_id?: string
  trimestre?: number
  annee_scolaire?: string
  created_at?: string
}

interface Note {
  id: string
  evaluation_id: string
  eleve_id: string
  note: number
  professeur_id?: string
}

interface Eleve {
  id: string
  nom: string
  prenom: string
}

interface GradesEntryEnhancedProps {
  classeId: string
  trimestre: number
}

type FocusMode = 'table' | 'student'

export default function GradesEntryEnhanced({ classeId, trimestre }: GradesEntryEnhancedProps) {
  const [matieres, setMatieres] = useState<Matiere[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNewEvalModal, setShowNewEvalModal] = useState(false)
  const { profile } = useProfile()
  const ecoleId = profile?.ecole_id
  const [selectedMatiereId, setSelectedMatiereId] = useState<string>('')
  
  // Focus mode
  const [focusMode, setFocusMode] = useState<FocusMode>('table')
  const [focusedStudentIndex, setFocusedStudentIndex] = useState(0)
  const [focusedEvalIndex, setFocusedEvalIndex] = useState(0)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const [newEval, setNewEval] = useState({
    type: 'controle' as 'controle' | 'devoir' | 'composition',
    date: getTodayDate(),
    coef: 1,
    bareme: 20,
    libelle: ''
  })

  const [niveau, setNiveau] = useState<any>(null)
  const [serie, setSerie] = useState<any>(null)
  const [toastMessage, setToastMessage] = useState<{title: string, type: 'success' | 'error' | 'warning'} | null>(null)

  const showToast = (title: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ title, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const { isOnline, pendingCount } = useNetwork()

  useEffect(() => {
    if (classeId) loadData()
  }, [classeId, trimestre])

  async function loadData() {
    if (!classeId) return
    setLoading(true)
    try {
      if (db) {
        const cachedEleves = await db.eleves.where('classe_id').equals(classeId).toArray()
        const cachedEvals = await db.evaluations
          .where('classe_id').equals(classeId)
          .and(e => e.trimestre === trimestre)
          .toArray()
        const cachedNotes = await db.notes
          .where('evaluation_id').anyOf(cachedEvals.map(e => e.id))
          .toArray()
        
        if (cachedEleves.length > 0) {
          setEleves(cachedEleves)
          setEvaluations(cachedEvals as unknown as Evaluation[])
          setNotes(cachedNotes as unknown as Note[])
          setLoading(false)
        }

        const classe = await db.classes.get(classeId)
        if (classe) {
          const niv = classe.niveau_id ? await db.niveaux.get(classe.niveau_id) : null
          const ser = classe.serie_id ? await db.series.get(classe.serie_id) : null
          setNiveau(niv)
          setSerie(ser)
        }

        if (classe && ecoleId) {
          const fetchedMatieres = await db.matieres.where('ecole_id').equals(ecoleId).toArray()
          setMatieres(fetchedMatieres as unknown as Matiere[])
        }
      }

      if (navigator.onLine && ecoleId) {
        await syncFromSupabase(ecoleId)
        
        if (db) {
          const freshEleves = await db.eleves.where('classe_id').equals(classeId).toArray()
          const freshEvals = await db.evaluations
            .where('classe_id').equals(classeId)
            .and(e => e.trimestre === trimestre)
            .toArray()
          const freshNotes = await db.notes
            .where('evaluation_id').anyOf(freshEvals.map(ev => ev.id))
            .toArray()
          
          setEleves(freshEleves)
          setEvaluations(freshEvals as unknown as Evaluation[])
          setNotes(freshNotes as unknown as Note[])
        }
      }
    } catch (e) {
      console.warn('[GradesEntryEnhanced] Erreur loadData:', e)
    } finally {
      setLoading(false)
    }
  }

  const validateNote = (value: string, bareme: number): { valid: boolean, error?: string } => {
    const trimmed = value.trim()
    if (trimmed === '') return { valid: true }
    
    const num = parseFloat(trimmed.replace(',', '.'))
    if (isNaN(num)) return { valid: false, error: 'Nombre invalide' }
    if (num < 0) return { valid: false, error: 'Note négative' }
    if (num > bareme) return { valid: false, error: `Note > ${bareme}` }
    
    return { valid: true }
  }

  const handleNoteChange = async (eleveId: string, evalId: string, val: string) => {
    const trimmed = val.trim()
    const evaluation = evaluations.find(e => e.id === evalId)
    if (!evaluation) return

    const validation = validateNote(trimmed, evaluation.bareme)
    if (!validation.valid) {
      showToast(validation.error || 'Erreur de validation', 'warning')
      return
    }

    if (trimmed === '') {
      const existing = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId)
      if (existing) {
        setNotes(prev => prev.filter(n => n.id !== existing.id))
        if (db) {
          await db.notes.delete(existing.id)
        }
        if (ecoleId) {
          await addToSyncQueue('notes', 'DELETE', { id: existing.id } as any, ecoleId)
        }
      }
      return
    }

    const num = parseFloat(trimmed.replace(',', '.'))
    const existingNote = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId)
    const noteId = existingNote?.id || crypto.randomUUID()

    const today = new Date()
    const year = today.getFullYear()
    const currentAnneeScolaire = today.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`

    const noteData: Note = { 
      id: noteId, 
      ecole_id: ecoleId!,
      eleve_id: eleveId, 
      evaluation_id: evalId, 
      note: num,
      professeur_id: profile?.id,
      annee_scolaire: currentAnneeScolaire
    } as any

    try {
      if (db) {
        await db.notes.put(noteData as any)
        setNotes(prev => {
          const filtered = prev.filter(n => n.id !== noteId)
          return [...filtered, noteData]
        })
      }

      if (ecoleId) {
        const action = existingNote ? 'UPDATE' : 'INSERT'
        await addToSyncQueue('notes', action, noteData as any, ecoleId)
      }
      showToast("Note enregistrée avec succès !")
      
    } catch (e) {
      console.error('Erreur note change:', e)
    }
  }

  const handleNoteInputChange = (eleveId: string, evalId: string, val: string) => {
    const trimmed = val.trim()
    if (trimmed === '') {
      setNotes(prev => prev.filter(n => !(n.eleve_id === eleveId && n.evaluation_id === evalId)))
      return
    }
    const num = parseFloat(trimmed.replace(',', '.'))
    if (isNaN(num)) return
    
    const existingNote = notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId)
    const noteId = existingNote?.id || crypto.randomUUID()

    const today = new Date()
    const year = today.getFullYear()
    const currentAnneeScolaire = today.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`

    const noteData: Note = { 
      id: noteId, 
      ecole_id: ecoleId!,
      eleve_id: eleveId, 
      evaluation_id: evalId, 
      note: num, 
      professeur_id: profile?.id,
      annee_scolaire: currentAnneeScolaire 
    } as any
    setNotes(prev => {
      const filtered = prev.filter(n => n.id !== noteId)
      return [...filtered, noteData]
    })
  }

  const getNote = (eleveId: string, evalId: string) => {
    return notes.find(n => n.eleve_id === eleveId && n.evaluation_id === evalId)?.note ?? null
  }

  const getNoteValidation = (eleveId: string, evalId: string) => {
    const evaluation = evaluations.find(e => e.id === evalId)
    if (!evaluation) return { valid: true }
    
    const note = getNote(eleveId, evalId)
    if (note === null) return { valid: true }
    
    if (note < 0) return { valid: false, error: 'Note négative' }
    if (note > evaluation.bareme) return { valid: false, error: `Note > ${evaluation.bareme}` }
    
    return { valid: true }
  }

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, eleveId: string, evaluationId: string) => {
    if (focusMode !== 'student') return

    const currentEvals = evaluations.filter(e => e.matiere_id === selectedMatiereId)
    
    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          // Previous student
          setFocusedStudentIndex(prev => Math.max(0, prev - 1))
        } else {
          // Next student
          setFocusedStudentIndex(prev => Math.min(eleves.length - 1, prev + 1))
        }
        break
      case 'ArrowRight':
        e.preventDefault()
        setFocusedEvalIndex(prev => Math.min(currentEvals.length - 1, prev + 1))
        break
      case 'ArrowLeft':
        e.preventDefault()
        setFocusedEvalIndex(prev => Math.max(0, prev - 1))
        break
      case 'Escape':
        setFocusMode('table')
        break
    }
  }, [focusMode, evaluations, selectedMatiereId, eleves.length])

  // Focus on input when indices change
  useEffect(() => {
    if (focusMode === 'student' && selectedMatiereId) {
      const currentEvals = evaluations.filter(e => e.matiere_id === selectedMatiereId)
      if (focusedStudentIndex < eleves.length && focusedEvalIndex < currentEvals.length) {
        const eleve = eleves[focusedStudentIndex]
        const evaluation = currentEvals[focusedEvalIndex]
        const key = `${eleve.id}-${evaluation.id}`
        setTimeout(() => {
          inputRefs.current.get(key)?.focus()
        }, 50)
      }
    }
  }, [focusedStudentIndex, focusedEvalIndex, focusMode, selectedMatiereId, evaluations, eleves])

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-600" /></div>

  const currentEvals = evaluations.filter(e => e.matiere_id === selectedMatiereId)
  const currentStudent = eleves[focusedStudentIndex]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Espace Notes</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {niveau?.nom} • Trimestre {trimestre}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFocusMode(focusMode === 'table' ? 'student' : 'table')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              focusMode === 'table'
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {focusMode === 'table' ? 'Mode Focus' : 'Mode Tableau'}
          </button>
          {pendingCount > 0 && (
            <div className="flex flex-col items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-black tracking-widest leading-none">Synchro. en attente</span>
              <span className="text-xl font-black mt-1">{pendingCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Focus Mode */}
      {focusMode === 'student' && selectedMatiereId && currentStudent && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 shadow-lg p-6 animate-in zoom-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-emerald-700">
                  {currentStudent.prenom[0]}{currentStudent.nom[0]}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {currentStudent.prenom} {currentStudent.nom}
                </h3>
                <p className="text-sm text-slate-500">
                  Élève {focusedStudentIndex + 1} / {eleves.length}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFocusMode('table')}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentEvals.map((evaluation, idx) => {
              const val = getNote(currentStudent.id, evaluation.id)
              const validation = getNoteValidation(currentStudent.id, evaluation.id)
              const isFocused = idx === focusedEvalIndex
              
              return (
                <div
                  key={evaluation.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isFocused ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-900">{evaluation.libelle || evaluation.type.toUpperCase()}</p>
                      <p className="text-xs text-slate-500">Barème: {evaluation.bareme}</p>
                    </div>
                    {!validation.valid && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <input
                    ref={ref => {
                      const key = `${currentStudent.id}-${evaluation.id}`
                      if (ref) inputRefs.current.set(key, ref)
                      else inputRefs.current.delete(key)
                    }}
                    type="text"
                    inputMode="decimal"
                    value={val?.toString() ?? ''}
                    onChange={(e) => handleNoteInputChange(currentStudent.id, evaluation.id, e.target.value)}
                    onBlur={(e) => handleNoteChange(currentStudent.id, evaluation.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, currentStudent.id, evaluation.id)}
                    placeholder="--"
                    className={`w-full h-12 bg-white border-2 rounded-lg text-center text-lg font-bold focus:outline-none transition-colors ${
                      isFocused ? 'border-emerald-500' : 'border-slate-300 focus:border-emerald-300'
                    } ${val !== null ? (val >= (evaluation.bareme/2) ? 'text-emerald-700' : 'text-red-600') : 'text-slate-300'}`}
                  />
                  {!validation.valid && (
                    <p className="text-xs text-red-500 mt-1">{validation.error}</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={() => setFocusedStudentIndex(prev => Math.max(0, prev - 1))}
              disabled={focusedStudentIndex === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Précédent
            </button>
            <div className="flex gap-2">
              <span className="text-sm text-slate-500 self-center">
                Raccourcis: Tab = Élève suivant, Flèches = Évaluation, Échap = Quitter
              </span>
            </div>
            <button
              onClick={() => setFocusedStudentIndex(prev => Math.min(eleves.length - 1, prev + 1))}
              disabled={focusedStudentIndex === eleves.length - 1}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table Mode */}
      {focusMode === 'table' && (
        <>
          {matieres.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500">Aucune matière configurée pour cette classe.</p>
            </div>
          ) : (
            matieres.map(matiere => (
              <div key={matiere.id} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden w-full max-w-full">
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between gap-4">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs truncate min-w-0">{matiere.nom}</h3>
                  <button
                    onClick={() => { setSelectedMatiereId(matiere.id); setShowNewEvalModal(true); }}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nouvelle Éval.</span>
                  </button>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="sticky left-0 bg-white z-20 px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 min-w-[150px]">Élève</th>
                        {evaluations.filter(e => e.matiere_id === matiere.id).map(ev => (
                          <th key={ev.id} className="px-4 py-4 text-center min-w-[100px] border-r border-slate-50 relative group">
                            <div className="text-[10px] font-black text-slate-900 flex items-center justify-center gap-2">
                              {ev.libelle || ev.type.toUpperCase()}
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => { setSelectedMatiereId(matiere.id); setFocusMode('student'); setFocusedEvalIndex(evaluations.filter(e => e.matiere_id === matiere.id).findIndex(e => e.id === ev.id)); }}
                                  className="p-1 text-emerald-600 hover:scale-110"
                                  title="Mode focus"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                <button onClick={() => { /* handleDeleteEval */ }} className="p-1 text-red-400">
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">/{ev.bareme}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {eleves.map((eleve, studentIdx) => (
                        <tr key={eleve.id} className="hover:bg-emerald-50/20 transition-colors group">
                          <td className="sticky left-0 bg-white group-hover:bg-emerald-50/20 z-10 px-6 py-3 font-bold text-slate-700 text-[10px] border-r border-slate-100 uppercase">
                            {eleve.prenom} {eleve.nom}
                          </td>
                          {evaluations.filter(e => e.matiere_id === matiere.id).map(ev => {
                            const val = getNote(eleve.id, ev.id)
                            const validation = getNoteValidation(eleve.id, ev.id)
                            return (
                              <td key={ev.id} className="px-4 py-3 text-center border-r border-slate-50">
                                <div className="relative">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={val?.toString() ?? ''}
                                    onChange={(e) => handleNoteInputChange(eleve.id, ev.id, e.target.value)}
                                    onBlur={(e) => handleNoteChange(eleve.id, ev.id, e.target.value)}
                                    placeholder="--"
                                    className={`w-12 h-8 bg-slate-50 border border-slate-100 rounded-lg text-center text-xs font-black focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-colors ${
                                      !validation.valid ? 'border-red-500 bg-red-50' : ''
                                    } ${val !== null ? (val >= (ev.bareme/2) ? 'text-emerald-700' : 'text-red-600') : 'text-slate-300'}`}
                                  />
                                  {!validation.valid && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                      <AlertCircle className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-right duration-300 ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' :
          toastMessage.type === 'error' ? 'bg-red-600 text-white' :
          'bg-amber-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <Check className="w-4 h-4" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toastMessage.type === 'warning' && <AlertCircle className="w-4 h-4" />}
            <span className="font-medium">{toastMessage.title}</span>
          </div>
        </div>
      )}
    </div>
  )
}
