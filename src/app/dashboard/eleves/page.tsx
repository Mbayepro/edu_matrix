'use client'

// src/app/dashboard/eleves/page.tsx
// Liste paginée des élèves + upload photo
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Eleve, Classe } from '@/lib/supabase'
import {
  Search, Plus, ChevronLeft, ChevronRight,
  Upload, User, Loader2, X, Eye, QrCode,
  Users, UploadCloud, FileText, Printer, Edit
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import ExcelImportModal from '@/components/ExcelImportModal'
import { generateClassePDF } from '@/lib/pdfListGenerator'
import { SkeletonTable } from '@/components/Skeleton'
import type { Ecole } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'

const StudentCard = dynamic(() => import('@/components/StudentCard'), { ssr: false })

const PAGE_SIZE = 15

type StatutPaiement = 'tous' | 'payé' | 'impayé' | 'partiel'

export default function ElevesPage() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [eleves,       setEleves]       = useState<Eleve[]>([])
  const [classes,      setClasses]      = useState<Classe[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(0)
  const [search,       setSearch]       = useState('')
  const [filterClasse, setFilterClasse] = useState('')
  const [filterStatut, setFilterStatut] = useState<StatutPaiement>('tous')
  const [loading,      setLoading]      = useState(true)
  const [uploading,    setUploading]    = useState<string | null>(null)  // eleveId en cours d'upload
  const [viewing,      setViewing]      = useState<string | null>(null)  // carte ouverte
  const [viewingQR,    setViewingQR]    = useState<string | null>(null)  // QR ouvert
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadingFor = useRef<string | null>(null)

  useEffect(() => {
    if (ecoleId) {
      loadClasses(ecoleId)
    }
  }, [ecoleId])

  useEffect(() => { 
    if (ecoleId) loadEleves() 
  }, [page, search, filterClasse, filterStatut, ecoleId])

  async function loadClasses(schoolId: string) {
    try {
      setLoading(true)
      const { data: cls } = await supabase
        .from('classes')
        .select('*')
        .eq('ecole_id', schoolId)
        .order('nom_classe')
      setClasses(cls ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  async function loadEleves() {
    if (!ecoleId) return
    setLoading(true)
    try {
      let query = supabase
        .from('eleves')
        .select('*, classe:classes(nom_classe, niveau)', { count: 'exact' })
        .eq('ecole_id', ecoleId)
        .order('nom')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (search.trim()) {
        query = query.or(
          `nom.ilike.%${search}%,prenom.ilike.%${search}%,matricule.ilike.%${search}%`
        )
      }
      if (filterClasse)              query = query.eq('classe_id', filterClasse)
      if (filterStatut !== 'tous')   query = query.eq('statut_paiement', filterStatut)

      const { data, count } = await query
      setEleves((data ?? []) as Eleve[])
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }

  // ── Photo upload ──
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file    = e.target.files?.[0]
    const eleveId = uploadingFor.current
    if (!file || !eleveId) return

    setUploading(eleveId)
    try {
      const ext  = file.name.split('.').pop()
      const path = `photos/${eleveId}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('eleves-photos')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('eleves-photos')
        .getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('eleves')
        .update({ photo_url: publicUrl })
        .eq('id', eleveId)
      await loadEleves()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(null)
      uploadingFor.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function triggerUpload(eleveId: string) {
    uploadingFor.current = eleveId
    fileRef.current?.click()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const statutBadge: Record<string, string> = {
    'payé':    'bg-emerald-100 text-emerald-700',
    'impayé':  'bg-red-100 text-red-700',
    'partiel': 'bg-amber-100 text-amber-700',
  }

  async function handleExportPDF() {
    if (!ecole || !filterClasse || eleves.length === 0) return
    const currentClasse = classes.find(c => c.id === filterClasse)
    if (!currentClasse) return
    
    setGeneratingPDF(true)
    try {
      // Need to fetch full list if paginated? The user might want the whole class.
      // If we are paginating, we only get PAGE_SIZE. So we should fetch all students for this class.
      const { data: classEleves } = await supabase
        .from('eleves')
        .select('*')
        .eq('classe_id', filterClasse)
        .order('nom')
      
      if (!classEleves || classEleves.length === 0) return
      await generateClassePDF(ecole, currentClasse, classEleves as Eleve[])
      showToast('PDF généré avec succès.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Erreur lors de la génération du PDF.', 'error')
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un élève…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <select
          value={filterClasse}
          onChange={(e) => { setFilterClasse(e.target.value); setPage(0) }}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-600"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.nom_classe}</option>
          ))}
        </select>

        <select
          value={filterStatut}
          onChange={(e) => { setFilterStatut(e.target.value as StatutPaiement); setPage(0) }}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-600"
        >
          <option value="tous">Tous les statuts</option>
          <option value="payé">Payé</option>
          <option value="impayé">Impayé</option>
          <option value="partiel">Partiel</option>
        </select>

        {filterClasse && (
          <div className="flex gap-2 items-center">
            <button
              onClick={handleExportPDF}
              disabled={generatingPDF}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0 disabled:opacity-50"
            >
              {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              PDF
            </button>
            <a
              href={`/dashboard/eleves/print-cartes?classeId=${filterClasse}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
            >
              <Printer className="w-4 h-4" />
              Cartes
            </a>
          </div>
        )}

        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          Importer
        </button>

        <a
          href="/dashboard/eleves/nouveau"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Inscrire
        </a>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-400">
        {total.toLocaleString('fr-FR')} élève{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
        {search && ` pour "${search}"`}
      </p>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading || profileLoading ? (
          <SkeletonTable rows={PAGE_SIZE} columns={5} />
        ) : eleves.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun élève trouvé.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Élève</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Matricule</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Classe</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Paiement</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {eleves.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {/* Photo / upload */}
                          <button
                            onClick={() => triggerUpload(e.id)}
                            className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-slate-200 hover:border-emerald-400 transition-colors shrink-0 group"
                            title="Changer la photo"
                          >
                            {uploading === e.id ? (
                              <div className="absolute inset-0 bg-white flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                              </div>
                            ) : e.photo_url ? (
                              <>
                                <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Upload className="w-3 h-3 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{e.prenom[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </button>
                          <div>
                            <p className="font-medium text-slate-800">{e.prenom} {e.nom}</p>
                            {e.date_naissance && (
                              <p className="text-xs text-slate-400">
                                {new Date(e.date_naissance).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-500">{e.matricule}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600 text-xs">
                          {(e.classe as any)?.nom_classe ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statutBadge[e.statut_paiement] ?? ''}`}>
                          {e.statut_paiement}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/eleves/${e.id}/modifier`}
                            className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setViewing(e.id)}
                            className="p-2 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                            title="Voir la carte"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewingQR(e.id)}
                            className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                            title="QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-50">
              {eleves.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 shrink-0">
                    {e.photo_url ? (
                      <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                        {e.prenom[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{e.prenom} {e.nom}</p>
                    <p className="text-xs text-slate-400">{(e.classe as any)?.nom_classe ?? '—'} · {e.matricule}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 w-24">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statutBadge[e.statut_paiement]}`}>
                      {e.statut_paiement}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <Link href={`/dashboard/eleves/${e.id}/modifier`} className="text-slate-500 hover:text-slate-700">
                        <Edit className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => setViewing(e.id)} className="text-emerald-600 text-xs">Voir carte</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Page {page + 1} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = page < 3 ? i : page - 2 + i
              if (p >= totalPages) return null
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-xl text-xs font-semibold transition-colors ${
                    p === page
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p + 1}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}

      {/* Student card modal */}
      {viewing && (
        <StudentCard eleveId={viewing} onClose={() => setViewing(null)} />
      )}

      {/* Student card modal — QR tab */}
      {viewingQR && (
        <StudentCard eleveId={viewingQR} defaultTab="qr" onClose={() => setViewingQR(null)} />
      )}

      {/* Excel Import Modal */}
      {showImportModal && ecoleId && (
        <ExcelImportModal
          ecoleId={ecoleId}
          classes={classes}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            loadEleves()
          }}
        />
      )}
    </div>
  )
}

// Fix manquant dans ce fichier
// function Users({ className }: { className?: string }) {
//   return (
//     <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
//       <path strokeLinecap="round" strokeLinejoin="round"
//         d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
//     </svg>
//   )
// }
