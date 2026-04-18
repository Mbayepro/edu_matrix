'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Classe } from '@/lib/supabase'
import { X, UploadCloud, Loader2, Table as TableIcon, CheckCircle2, AlertCircle } from 'lucide-react'
import { getTodayDate } from '@/lib/dateUtils'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

interface Props {
  ecoleId: string
  classes: Classe[]
  onClose: () => void
  onSuccess: () => void
}

interface ParsedEleve {
  prenom: string
  nom: string
  matricule?: string
  date_naissance?: string
}

export default function ExcelImportModal({ ecoleId, classes, onClose, onSuccess }: Props) {
  const [selectedClasseId, setSelectedClasseId] = useState('')
  const [parsedData, setParsedData] = useState<ParsedEleve[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    const fileExt = file.name.split('.').pop()?.toLowerCase()

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data as any[])
        },
        error: (err) => {
          setError(`Erreur lors de la lecture CSV: ${err.message}`)
        }
      })
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result
          const wb = XLSX.read(bstr, { type: 'binary' })
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data = XLSX.utils.sheet_to_json(ws)
          processData(data)
        } catch (err: any) {
          setError(`Erreur lors de la lecture Excel: ${err.message}`)
        }
      }
      reader.readAsBinaryString(file)
    } else {
      setError("Format de fichier non supporté. Veuillez utiliser .csv, .xls ou .xlsx")
    }
  }

  const processData = (data: any[]) => {
    const normalizedData: ParsedEleve[] = []
    
    for (const row of data) {
      // Find matching keys case-insensitively or by common aliases
      const getVal = (keys: string[]) => {
        const key = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()))
        return key ? String(row[key]).trim() : ''
      }

      const prenom = getVal(['prenom', 'prénom', 'first name', 'firstname', 'prenoms', 'prénoms'])
      const nom = getVal(['nom', 'nom de famille', 'last name', 'lastname'])
      const matricule = getVal(['matricule', 'id', 'mat', 'n° matricule'])
      const dateNaiss = getVal(['date_naissance', 'date_naiss', 'date de naissance', 'date naissance', 'dob'])

      if (prenom && nom) {
        normalizedData.push({
          prenom,
          nom,
          matricule: matricule || undefined,
          date_naissance: dateNaiss || undefined
        })
      }
    }

    if (normalizedData.length === 0) {
      setError("Aucune donnée valide trouvée. Assurez-vous d'avoir les colonnes 'Prénom' et 'Nom'.")
    } else {
      setParsedData(normalizedData)
    }
  }

  const handleImport = async () => {
    if (!selectedClasseId) {
      setError("Veuillez sélectionner une classe de destination.")
      return
    }
    if (parsedData.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const recordsToInsert = parsedData.map(eleve => ({
        ecole_id: ecoleId,
        classe_id: selectedClasseId,
        prenom: eleve.prenom,
        nom: eleve.nom,
        matricule: eleve.matricule || null,
        date_naissance: eleve.date_naissance ? formatOptionDate(eleve.date_naissance) : null,
        statut_paiement: 'impayé'
      }))

      // Supabase insert has limits, chunking per 100 to be safe
      const chunkSize = 100
      for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
        const chunk = recordsToInsert.slice(i, i + chunkSize)
        const { error: insertErr } = await supabase.from('eleves').insert(chunk)
        if (insertErr) throw insertErr
      }

      onSuccess()
    } catch (err: any) {
      console.error('Import error:', err)
      setError(`Erreur lors de l'import: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatOptionDate = (ds: string) => {
    // Basic standardizing. If invalid, returns null
    const d = new Date(ds)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return null
  }

  const reset = () => {
    setParsedData([])
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <TableIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Import Excel / CSV</h2>
              <p className="text-sm text-slate-500">Importer une liste complète d'élèves</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex gap-3 items-start border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {parsedData.length === 0 ? (
            <div 
              className="border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:border-emerald-500 hover:bg-emerald-50/50 bg-slate-50 transition-colors cursor-pointer group flex flex-col items-center justify-center text-center space-y-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 bg-white rounded-full border border-slate-100 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Cliquez pour importer un fichier</p>
                <p className="text-xs text-slate-500 mt-1">Formats supportés : .csv, .xls, .xlsx</p>
              </div>
              <div className="text-[11px] text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm mt-2">
                Colonnes attendues : <b>Prénom</b> et <b>Nom</b> (Matricule, Date de naissance optionnels)
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {parsedData.length} élèves détectés
                  </h3>
                  <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-700 underline mt-1">
                    Changer de fichier
                  </button>
                </div>

                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Classe de destination <span className="text-red-500">*</span></label>
                  <select
                    value={selectedClasseId}
                    onChange={(e) => setSelectedClasseId(e.target.value)}
                    className="w-full sm:w-64 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Sélectionner une classe...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.nom_classe}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Prénom</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Nom</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Matricule</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Date Naissance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedData.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-1.5 text-slate-800">{row.prenom}</td>
                          <td className="px-4 py-1.5 text-slate-800 font-medium">{row.nom}</td>
                          <td className="px-4 py-1.5 text-slate-500">{row.matricule || '—'}</td>
                          <td className="px-4 py-1.5 text-slate-500">{row.date_naissance || '—'}</td>
                        </tr>
                      ))}
                      {parsedData.length > 100 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-center text-xs text-slate-500 font-medium bg-slate-50">
                            + {parsedData.length - 100} autres lignes non affichées
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={parsedData.length === 0 || !selectedClasseId || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importation...
              </>
            ) : (
              'Valider l\'import'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
