'use client'

// src/app/dashboard/eleves/page.tsx
// Liste paginée des élèves + upload photo
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Eleve, Classe } from '@/lib/supabase'
import { 
  Plus, Search, Filter, Edit2, Trash2, 
  MoreVertical, Check, X, ShieldAlert,
  Download, Upload as UploadIcon, AlertCircle, FileText, Camera, Link as LinkIcon,
  Users, UploadCloud, Loader2, Printer, Upload, Edit, Eye, QrCode, ChevronLeft, ChevronRight
} from 'lucide-react'
import { compressImage } from '@/lib/imageCompression'
import { useVirtualizer } from '@tanstack/react-virtual'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import ExcelImportModal from '@/components/ExcelImportModal'
import { generateClassePDF } from '@/lib/pdfListGenerator'
import { SkeletonTable } from '@/components/Skeleton'
import type { Ecole } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

import { useNetwork } from '@/hooks/useNetwork'
import { db } from '@/lib/db'
import { syncFromSupabase } from '@/lib/syncService'

const StudentCard = dynamic(() => import('@/components/StudentCard'), { ssr: false })

const PAGE_SIZE = 50

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
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: eleves.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 76, // Hauteur approximative d'une ligne
    overscan: 5,
  })

  const { isOnline } = useNetwork();

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
    if (!ecoleId || !db) return
    try {
      setLoading(true)
      
      // 1. Lire depuis le cache local Dexie
      let cls = await db.classes.where('ecole_id').equals(ecoleId).sortBy('nom_classe')
      
      if (isTeacher) {
        cls = cls.filter(c => teacherClasseIds.includes(c.id))
      }
      
      setClasses(cls as unknown as Classe[])
      
      if (isTeacher && cls.length === 1 && !filterClasse) {
        setFilterClasse(cls[0].id)
      }

      // 2. Si online, Sync du fond
      if (isOnline) {
        syncFromSupabase(ecoleId).then(async () => {
          // Refresh local après sync si online
          let freshCls = await db.classes.where('ecole_id').equals(ecoleId).sortBy('nom_classe')
          if (isTeacher) freshCls = freshCls.filter(c => teacherClasseIds.includes(c.id))
          setClasses(freshCls as unknown as Classe[])
        }).catch(e => console.warn('Sync failed', e))
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadEleves() {
    if (!ecoleId || !db) return
    setLoading(true)
    try {
      // 1. Logic de filtrage locale dans Dexie (Totalement fonctionnelle hors-ligne)
      let collection = db.eleves.where('ecole_id').equals(ecoleId)
      
      // Filtre prof
      if (isTeacher) {
        if (teacherClasseIds.length === 0) {
          setEleves([])
          setTotal(0)
          return
        }
        if (filterClasse && teacherClasseIds.includes(filterClasse)) {
          collection = db.eleves.where('classe_id').equals(filterClasse).and(e => e.ecole_id === ecoleId)
        } else {
          // Filtrage complexe (in)
          collection = db.eleves.where('classe_id').anyOf(teacherClasseIds).and(e => e.ecole_id === ecoleId)
        }
      } else if (filterClasse) {
        collection = db.eleves.where('classe_id').equals(filterClasse).and(e => e.ecole_id === ecoleId)
      }

      // Filtre statut paiement
      if (filterStatut !== 'tous') {
        const prevCollection = collection
        collection = prevCollection.and(e => e.statut_paiement === filterStatut)
      }

      // Filtre recherche
      if (search.trim()) {
        const s = search.toLowerCase()
        const prevCollection = collection
        collection = prevCollection.and(e => 
          e.nom.toLowerCase().includes(s) || 
          e.prenom.toLowerCase().includes(s) || 
          (e.matricule?.toLowerCase().includes(s) ?? false)
        )
      }

      const allFiltered = await collection.toArray()
      const sorted = allFiltered.sort((a, b) => a.nom.localeCompare(b.nom))
      const count = sorted.length
      // Avec la virtualisation, on peut se permettre de charger plus de lignes ou tout charger
      // Mais gardons la pagination pour ne pas saturer la mémoire RAM globale
      const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

      // Récupérer les infos de classe pour chaque élève
      const elevesWithClasse = await Promise.all(pageData.map(async (e) => {
        const classe = await db.classes.get(e.classe_id)
        return {
          ...e,
          classe: classe ? { nom_classe: classe.nom_classe, niveau: (classe as any).niveau } : undefined
        }
      }))

      setEleves(elevesWithClasse as unknown as Eleve[])
      setTotal(count)

      // 2. Si Online, optionnellement déclencher loadEleves depuis Supabase pour sync 
      // Mais syncFromSupabase() appelé dans loadClasses ou via SyncInitializer suffit souvent.
    } catch (error) {
      console.error('Erreur loadEleves Dexie:', error)
      showToast('Erreur lors du chargement des élèves.', 'error')
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
      const compressedFile = await compressImage(file)
      const ext  = compressedFile.name.split('.').pop()
      const uniqueId = Date.now()
      const path = `photos/${eleveId}_${uniqueId}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('eleves-photos')
        .upload(path, compressedFile, { upsert: false })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('eleves-photos')
        .getPublicUrl(path)

      const { error: updateError } = await (supabase.from('eleves' as any) as any)
        .update({ photo_url: publicUrl } as any)
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

  const copyParentLink = async (pin: string | null | undefined) => {
    if (!pin) {
      showToast('Code PIN introuvable pour cet élève.', 'error')
      return
    }
    const url = `${window.location.origin}/p/${pin}`
    try {
      await navigator.clipboard.writeText(url)
      showToast("Lien de l'espace parent copié !", 'success')
    } catch (err) {
      showToast("Impossible de copier le lien.", 'error')
    }
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Gestion des Élèves</h1>
          </div>
          <div className="text-sm font-medium">
            {loading || profileLoading ? (
               <div className="flex items-center gap-3">
                  <div className="w-32 h-4 bg-white/5 rounded animate-pulse" />
                  <span className="text-slate-500 italic text-[10px] font-black uppercase tracking-widest">(Synchronisation…)</span>
               </div>
            ) : (
                <span className="text-slate-400">
                  Pilotez les inscriptions et les documents de vos <span className="text-emerald-400 font-black">{total.toLocaleString('fr-FR')}</span> élèves.
                </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-bold hover:bg-white/10 transition-all shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            Importer
          </button>
          <Link
            href="/dashboard/eleves/nouveau"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Nouvelle Inscription</span>
            <span className="sm:hidden">Inscrire</span>
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
      <div className="premium-glass p-4 rounded-[2rem] flex flex-col gap-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher un élève…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-12 pr-12 py-3.5 bg-white/5 border-none rounded-2xl text-sm font-bold text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all placeholder:text-slate-500"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 w-full sm:w-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Classe</span>
            <select
              value={filterClasse}
              onChange={(e) => { setFilterClasse(e.target.value); setPage(0) }}
              className="bg-transparent border-none p-0 pr-8 text-sm font-black text-white focus:ring-0 cursor-pointer appearance-none flex-1 sm:flex-none"
            >
              <option value="" className="bg-slate-900">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">{c.nom_classe}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 w-full sm:w-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paiement</span>
            <select
              value={filterStatut}
              onChange={(e) => { setFilterStatut(e.target.value as StatutPaiement); setPage(0) }}
              className="bg-transparent border-none p-0 pr-8 text-sm font-black text-white focus:ring-0 cursor-pointer appearance-none flex-1 sm:flex-none"
            >
              <option value="tous" className="bg-slate-900">Tous les statuts</option>
              <option value="payé" className="bg-slate-900">Payé</option>
              <option value="impayé" className="bg-slate-900">Impayé</option>
              <option value="partiel" className="bg-slate-900">Partiel</option>
            </select>
          </div>

          {filterClasse && (
            <div className="flex items-center gap-2 w-full sm:w-auto sm:pl-4 sm:ml-2 sm:border-l sm:border-white/10">
              <button
                onClick={handleExportPDF}
                disabled={generatingPDF}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-emerald-400 transition-all shadow-lg disabled:opacity-50"
                title="Exporter liste PDF"
              >
                {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>PDF</span>
              </button>
              <a
                href={`/dashboard/eleves/print-cartes?classeId=${filterClasse}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 text-sm font-bold hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/10"
                title="Imprimer les cartes QR"
              >
                <Printer className="w-4 h-4" />
                <span>Cartes QR</span>
              </a>
            </div>
          )}
        </div>
      </div>


      {/* Table Section */}
      <div className="premium-glass rounded-[2rem] overflow-hidden border border-white/5">
        {loading || profileLoading ? (
          <SkeletonTable rows={PAGE_SIZE} columns={5} />
        ) : eleves.length === 0 ? (
          <div className="py-24 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-pulse" />
              <Users className="w-10 h-10 text-slate-500 relative z-10" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-tight">Aucun résultat trouvé</h3>
            <p className="text-base text-slate-500 font-medium max-w-sm mx-auto">
              Nous n&apos;avons trouvé aucun élève correspondant à vos critères de recherche. Essayez de modifier vos filtres.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10" ref={tableContainerRef}>
              <table className="w-full text-sm relative">
                <thead className="sticky top-0 z-10 bg-slate-950/50 backdrop-blur-xl">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Informations Élève</th>
                    <th className="text-left px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Matricule</th>
                    <th className="text-left px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Classe</th>
                    <th className="text-left px-4 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Scolarité</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const e = eleves[virtualRow.index]
                    return (
                    <tr 
                      key={e.id} 
                      className="group hover:bg-white/5 transition-all duration-300 absolute w-full"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-5">
                          <button
                            onClick={() => triggerUpload(e.id)}
                            className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-sm group/photo transition-all duration-500 hover:border-emerald-500/30 hover:scale-105 shrink-0"
                            title="Changer la photo"
                          >
                            {uploading === e.id ? (
                              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                              </div>
                            ) : e.photo_url ? (
                              <>
                                <Image src={e.photo_url} alt="" fill sizes="56px" className="object-cover transition-transform duration-500 group-hover/photo:scale-110" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                  <Upload className="w-5 h-5 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="absolute inset-0 bg-slate-800 flex items-center justify-center group-hover/photo:bg-emerald-600 transition-colors">
                                <span className="text-white text-lg font-black">{e.prenom[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </button>
                          <div>
                            <p className="text-base font-black text-white leading-tight group-hover:text-emerald-400 transition-colors uppercase">
                              {e.prenom} {e.nom}
                            </p>
                            <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-1">
                              {e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date de naissance non définie'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                          {e.matricule}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-white/5 shadow-sm">
                          {(e.classe as any)?.nom_classe ?? 'NON ASSIGNÉ'}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border ${
                          e.statut_paiement === 'payé' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          e.statut_paiement === 'impayé' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {e.statut_paiement}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/eleves/${e.id}/modifier`}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-white/10 transition-all group/btn"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setViewing(e.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-white/10 transition-all group/btn"
                            title="Profil Complet"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewingQR(e.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-amber-400 hover:border-amber-500/30 hover:bg-white/10 transition-all group/btn"
                            title="QR ID Card"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => copyParentLink(e.pin_parent)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-blue-400 hover:border-blue-500/30 hover:bg-white/10 transition-all group/btn"
                            title="Copier le lien Espace Parent"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/5">
              {eleves.map((e) => (
                <div key={e.id} className="p-5 space-y-4 hover:bg-white/5 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => triggerUpload(e.id)}
                        className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-sm shrink-0"
                      >
                        {uploading === e.id ? (
                          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          </div>
                        ) : e.photo_url ? (
                          <Image src={e.photo_url} alt="" fill sizes="48px" className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-sm font-black">
                            {e.prenom[0]?.toUpperCase()}
                          </div>
                        )}
                      </button>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-white uppercase truncate">
                          {e.prenom} {e.nom}
                        </h3>
                        <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mt-0.5">
                          {e.matricule || 'Sans matricule'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/eleves/${e.id}/modifier`}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setViewing(e.id)}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewingQR(e.id)}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copyParentLink(e.pin_parent)}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-1">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-white/5 shadow-sm">
                      {(e.classe as any)?.nom_classe ?? '—'}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] border ${
                      e.statut_paiement === 'payé' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      e.statut_paiement === 'impayé' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {e.statut_paiement}
                    </span>
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
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Page <span className="text-white">{page + 1}</span> sur <span className="text-white">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-white/10 disabled:opacity-10 disabled:cursor-not-allowed transition-all shadow-sm"
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
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                        : 'bg-white/5 border border-white/10 text-slate-500 hover:text-emerald-400 hover:bg-white/10'
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
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-white/10 disabled:opacity-10 disabled:cursor-not-allowed transition-all shadow-sm"
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
