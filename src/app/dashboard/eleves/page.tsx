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
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

const StudentCard = dynamic(() => import('@/components/StudentCard'), { ssr: false })

const PAGE_SIZE = 15

type StatutPaiement = 'tous' | 'payé' | 'impayé' | 'partiel'

export default function ElevesPage() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const isTeacher = profile?.role === 'teacher'
  const { showToast } = useToast()

  // Professeur : récupère uniquement ses classes assignées
  const { classeIds: teacherClasseIds, loading: teacherLoading } = useTeacherClasses(
    isTeacher ? profile?.id : null
  )

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
    if (profileLoading) return
    if (!ecoleId) return
    // Pour un prof, attendre que les assignations soient chargées
    if (isTeacher && teacherLoading) return
    loadClasses()
  }, [ecoleId, profileLoading, isTeacher, teacherLoading, teacherClasseIds.join(',')])

  useEffect(() => { 
    if (profileLoading) return
    if (!ecoleId) { setLoading(false); return }
    // Pour un prof, attendre que les assignations soient chargées
    if (isTeacher && teacherLoading) return
    loadEleves()
  }, [page, search, filterClasse, filterStatut, ecoleId, profileLoading, isTeacher, teacherLoading, teacherClasseIds.join(',')])

  async function loadClasses() {
    if (!ecoleId) return
    try {
      setLoading(true)
      let cls: Classe[] = []

      if (isTeacher) {
        // Prof : uniquement ses classes assignées
        if (teacherClasseIds.length === 0) {
          setClasses([])
          return
        }
        const { data } = await supabase
          .from('classes')
          .select('*')
          .in('id', teacherClasseIds)
          .order('nom_classe')
        cls = data ?? []
      } else {
        // Directeur / superadmin : toutes les classes de l'école
        const { data } = await supabase
          .from('classes')
          .select('*')
          .eq('ecole_id', ecoleId)
          .order('nom_classe')
        cls = data ?? []
      }

      setClasses(cls)
      // Si prof et une seule classe, pré-sélectionner automatiquement
      if (isTeacher && cls.length === 1 && !filterClasse) {
        setFilterClasse(cls[0].id)
      }
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

      // Profeseur : restreindre aux classes assignées
      if (isTeacher) {
        if (teacherClasseIds.length === 0) {
          setEleves([])
          setTotal(0)
          return
        }
        // Si un filtre classe est actif, vérifier qu'il appartient au prof
        if (filterClasse && teacherClasseIds.includes(filterClasse)) {
          query = query.eq('classe_id', filterClasse)
        } else {
          // Sinon forcer toutes ses classes
          query = query.in('classe_id', teacherClasseIds)
        }
      } else {
        if (filterClasse) query = query.eq('classe_id', filterClasse)
      }

      if (search.trim()) {
        query = query.or(
          `nom.ilike.%${search}%,prenom.ilike.%${search}%,matricule.ilike.%${search}%`
        )
      }
      if (filterStatut !== 'tous')   query = query.eq('statut_paiement', filterStatut)

      const { data, count, error } = await query
      
      if (error) {
        console.error('Erreur loadEleves:', error)
        showToast('Erreur lors du chargement des élèves : ' + error.message, 'error')
        return
      }

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
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestion des Élèves</h1>
          </div>
          <div className="text-sm font-medium flex items-center gap-2">
            {loading || profileLoading ? (
               <div className="flex items-center gap-2">
                  <div className="w-24 h-4 bg-slate-100 rounded animate-pulse" />
                  <span className="text-slate-300 italic text-[10px] font-black uppercase tracking-widest">(Synchronisation…)</span>
               </div>
            ) : (
                <span className="text-slate-500">
                  Pilotez les inscriptions, les présences et les documents de vos <span className="text-emerald-600 font-black">{total.toLocaleString('fr-FR')}</span> élèves.
                </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            Importer Excel
          </button>
          <Link
            href="/dashboard/eleves/nouveau"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            Nouvelle Inscription
          </Link>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modern Filter Bar */}
      <div className="bg-white p-3 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou matricule…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-12 pr-12 py-3.5 bg-slate-50/50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/50 rounded-2xl border border-slate-100/50">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classe</span>
            <select
              value={filterClasse}
              onChange={(e) => { setFilterClasse(e.target.value); setPage(0) }}
              className="bg-transparent border-none p-0 pr-8 text-sm font-black text-slate-900 focus:ring-0 cursor-pointer appearance-none"
            >
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom_classe}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/50 rounded-2xl border border-slate-100/50">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paiement</span>
            <select
              value={filterStatut}
              onChange={(e) => { setFilterStatut(e.target.value as StatutPaiement); setPage(0) }}
              className="bg-transparent border-none p-0 pr-8 text-sm font-black text-slate-900 focus:ring-0 cursor-pointer appearance-none"
            >
              <option value="tous">Tous les statuts</option>
              <option value="payé">Payé</option>
              <option value="impayé">Impayé</option>
              <option value="partiel">Partiel</option>
            </select>
          </div>

          {filterClasse && (
            <div className="flex items-center gap-2 pl-4 ml-2 border-l border-slate-200">
              <button
                onClick={handleExportPDF}
                disabled={generatingPDF}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50"
                title="Exporter liste PDF"
              >
                {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              </button>
              <a
                href={`/dashboard/eleves/print-cartes?classeId=${filterClasse}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-amber-400 text-slate-900 hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/10"
                title="Imprimer les cartes QR"
              >
                <Printer className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>


      {/* Table Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200/50 shadow-sm overflow-hidden">
        {loading || profileLoading ? (
          <SkeletonTable rows={PAGE_SIZE} columns={5} />
        ) : eleves.length === 0 ? (
          <div className="py-24 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-pulse" />
              <Users className="w-10 h-10 text-slate-300 relative z-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Aucun résultat trouvé</h3>
            <p className="text-base text-slate-400 font-medium max-w-sm mx-auto">
              Nous n&apos;avons trouvé aucun élève correspondant à vos critères de recherche. Essayez de modifier vos filtres.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Informations Élève</th>
                    <th className="text-left px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Matricule</th>
                    <th className="text-left px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Classe</th>
                    <th className="text-left px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Scolarité</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {eleves.map((e) => (
                    <tr key={e.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-5">
                          <button
                            onClick={() => triggerUpload(e.id)}
                            className="relative w-14 h-14 rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm group/photo transition-all duration-500 hover:border-emerald-200 hover:scale-105 shrink-0"
                            title="Changer la photo"
                          >
                            {uploading === e.id ? (
                              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                              </div>
                            ) : e.photo_url ? (
                              <>
                                <img src={e.photo_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-110" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                  <Upload className="w-5 h-5 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center group-hover/photo:bg-emerald-600 transition-colors">
                                <span className="text-white text-lg font-black">{e.prenom[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </button>
                          <div>
                            <p className="text-base font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors uppercase">
                              {e.prenom} {e.nom}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mt-1">
                              {e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date de naissance non définie'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                          {e.matricule}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100/50 text-slate-700 text-[10px] font-black uppercase tracking-widest border border-slate-200/50 shadow-sm">
                          {(e.classe as any)?.nom_classe ?? 'NON ASSIGNÉ'}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border ${
                          e.statut_paiement === 'payé' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          e.statut_paiement === 'impayé' ? 'bg-red-50 text-red-600 border-red-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {e.statut_paiement}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-2 transition-all duration-300">
                          <Link
                            href={`/dashboard/eleves/${e.id}/modifier`}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm group/btn"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setViewing(e.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm group/btn"
                            title="Profil Complet"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewingQR(e.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all shadow-sm group/btn"
                            title="QR ID Card"
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Page <span className="text-slate-900">{page + 1}</span> sur <span className="text-slate-900">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 mx-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const p = page < 3 ? i : page - 2 + i
                if (p >= totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                      p === page
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                        : 'bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {p + 1}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
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
