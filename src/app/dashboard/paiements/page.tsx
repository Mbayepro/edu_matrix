'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase, Eleve, FraisScolaire, EleveFrais, Paiement } from '@/lib/supabase'
import {
  Loader2,
  Search,
  CreditCard,
  Euro,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  PieChart,
  BarChart3,
  Download,
  Printer,
  Share2,
  MessageCircle,
  Mail,
  Copy,
  X,
  PlusCircle,
  Check,
  RotateCcw,
  LayoutGrid
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useNetwork } from '@/hooks/useNetwork'
import { useToast } from '@/contexts/ToastContext'
import { generatePaiementRecuPDF, printPaiementRecuPDF, sharePaiementRecu, PaiementRecuInfo } from '@/lib/pdfRecuGenerator'
import { Skeleton } from '@/components/Skeleton'
import { db } from '@/lib/db'
import { syncFromSupabase, addToSyncQueue } from '@/lib/syncService'
import { formatDate, formatMonthYear, formatDateTime } from '@/lib/dateUtils'
import type { 
  LocalEleve, 
  LocalFraisScolaire, 
  LocalEleveFrais, 
  LocalPaiement,
  LocalClasse
} from '@/lib/db'

interface EleveWithClasse extends Omit<Eleve, 'classe'> {
  classe?: { nom_classe: string }
}

export default function PaiementsPage() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [eleves, setEleves] = useState<EleveWithClasse[]>([])
  const [frais, setFrais] = useState<FraisScolaire[]>([])
  const [elevesFrais, setElevesFrais] = useState<EleveFrais[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedEleve, setSelectedEleve] = useState<EleveWithClasse | null>(null)
  const [selectedFraisId, setSelectedFraisId] = useState<string>('')
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'tous' | 'impayes'>('tous')
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null)
  const [tempPhone, setTempPhone] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignFeeId, setAssignFeeId] = useState('')
  const [assignClasseId, setAssignClasseId] = useState('all')
  const [classes, setClasses] = useState<LocalClasse[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const SCHOOL_MONTHS = ['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet']
  
  const selectedFrais = useMemo(() => frais.find(f => f.id === selectedFraisId), [frais, selectedFraisId])
  const isMensuel = useMemo(() => {
    if (!selectedFrais) return false
    const lib = (selectedFrais.libelle || '').toLowerCase()
    return selectedFrais.frequence === 'mensuel' || lib.includes('mensu') || lib.includes('scolarit')
  }, [selectedFrais])

  const getMoisImpayes = (eleveId: string, itemFraisId: string) => {
    // 1. Trouver le frais pour vérifer s'il est mensuel
    const f = frais.find(fr => fr.id === itemFraisId)
    if (!f) return []
    const lib = (f.libelle || '').toLowerCase()
    if (f.frequence !== 'mensuel' && !lib.includes('mensu') && !lib.includes('scolarit')) return []

    // 2. Lister les mois déjà payés pour ce frais
    const moisPayes = paiements
      .filter(p => p.eleve_id === eleveId && p.frais_id === itemFraisId)
      .map(p => (p as any).mois)
      .filter(Boolean)

    // 3. Retourner les mois du calendrier non présents dans moisPayes
    return SCHOOL_MONTHS.filter(m => !moisPayes.includes(m))
  }

  const { isOnline } = useNetwork()

  useEffect(() => {
    if (ecoleId) {
      loadAllData(ecoleId)
    } else if (!profileLoading && !ecoleId) {
      setLoading(false)
    }
  }, [ecoleId, profileLoading])

  async function loadAllData(schoolId: string) {
    if (!db) return
    setLoading(true)
    try {
      // 1. Load from DEXIE (Local First)
      await Promise.all([
        loadElevesLocal(schoolId),
        loadFraisLocal(schoolId),
        loadElevesFraisLocal(schoolId),
        loadPaiementsLocal(schoolId),
      ])

      // 2. If online, trigger background refresh
      if (isOnline) {
        await syncFromSupabase(schoolId)
        // Re-load after sync to get latest
        await Promise.all([
          loadElevesLocal(schoolId),
          loadFraisLocal(schoolId),
          loadElevesFraisLocal(schoolId),
          loadPaiementsLocal(schoolId),
        ])
      }
    } finally {
      setLoading(false)
    }
  }

  // Local Loaders
  async function loadElevesLocal(schoolId: string) {
    try {
      const table = db.table('eleves')
      const data = await table.where('ecole_id').equals(schoolId).toArray()
      let filtered = data
      if (search.trim()) {
        const s = search.toLowerCase()
        filtered = data.filter((e: LocalEleve) => 
          e.nom.toLowerCase().includes(s) || 
          e.prenom.toLowerCase().includes(s) || 
          (e.matricule && e.matricule.toLowerCase().includes(s))
        )
      }
      
      // Enrich with class name
      const classTable = db.table('classes')
      const classes = await classTable.where('ecole_id').equals(schoolId).toArray()
      const classMap = new Map(classes.map((c: LocalClasse) => [c.id, c.nom_classe]))
      
      setEleves(filtered.map((e: LocalEleve) => ({
        ...e,
        classe: { nom_classe: classMap.get(e.classe_id) || 'N/A' }
      })) as EleveWithClasse[])
    } catch (err) {
      console.warn('loadElevesLocal fail:', err)
    }
  }

  async function loadFraisLocal(schoolId: string) {
    try {
      const table = db.table('frais_scolaires')
      const data = await table.where('ecole_id').equals(schoolId).toArray()
      setFrais(data.filter((f: LocalFraisScolaire) => f.is_active) as any)
    } catch (err) {
      console.warn('loadFraisLocal fail:', err)
    }
  }

  async function loadElevesFraisLocal(schoolId: string) {
    try {
      const table = db.table('eleves_frais')
      let data = await table.where('ecole_id').equals(schoolId).toArray()

      // Sécurité : si la base locale est vide, tenter une lecture directe sur Supabase
      if (data.length === 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        const { data: remoteData, error } = await supabase
          .from('eleves_frais')
          .select('*')
          .eq('ecole_id', schoolId)
          
        if (!error && remoteData && remoteData.length > 0) {
          await table.bulkPut(remoteData as any)
          data = remoteData as any
        }
      }
      setElevesFrais(data as any)
    } catch (err) {
      console.warn('loadElevesFraisLocal fail:', err)
    }
  }

  async function loadPaiementsLocal(schoolId: string) {
    try {
      const table = db.table('paiements')
      const data = await table.where('ecole_id').equals(schoolId).toArray()
      setPaiements(data.sort((a: LocalPaiement, b: LocalPaiement) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime()) as any)
      
      // Also load classes for the assignment tool
      const classTable = db.table('classes')
      const cls = await classTable.where('ecole_id').equals(schoolId).toArray()
      setClasses(cls as any)
    } catch (err) {
      console.warn('loadPaiementsLocal fail:', err)
    }
  }

  // Re-filter when search changes
  useEffect(() => {
    if (ecoleId) void loadElevesLocal(ecoleId)
  }, [search])

  async function enregistrerPaiement(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEleve || !selectedFraisId || !montant || !ecoleId || !db) return
    setSaving(true)

    const m = Number(montant.replace(',', '.'))
    const newPaiement: LocalPaiement = {
      id: crypto.randomUUID(),
      ecole_id: ecoleId,
      eleve_id: selectedEleve.id,
      frais_id: selectedFraisId,
      montant: m,
      mode: mode || null,
      reference: reference || null,
      mois: selectedMonth || null,
      date_paiement: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    try {
      if (isOnline) {
        // 1. Try DIRECT Supabase
        const { error } = await (supabase as any).from('paiements').insert({
          id: newPaiement.id,
          ecole_id: newPaiement.ecole_id,
          eleve_id: newPaiement.eleve_id,
          frais_id: newPaiement.frais_id,
          montant: newPaiement.montant,
          mode: newPaiement.mode,
          reference: newPaiement.reference,
          date_paiement: newPaiement.date_paiement,
          mois: (newPaiement as any).mois // Inclusion du mois si la colonne existe
        })
        
        if (error) throw error

        // 2. Update local Dexie for cache
        try {
          const paiementTable = db.table('paiements')
          await paiementTable.add(newPaiement)
          // Update student balance locally too
          const efTable = db.table('eleves_frais')
          const ef = await efTable.where({ eleve_id: selectedEleve.id, frais_id: selectedFraisId }).first()
          if (ef) {
             const updatedAcompte = (ef as any).montant_paye ? (ef as any).montant_paye + m : m
             await efTable.update(ef.id, { montant_paye: updatedAcompte } as any)
          }
        } catch (e) {
          console.warn('Local save fail:', e)
        }

        // Force recalcul local du statut pour l'instantanéité UI
        await db!.recalculateEleveStatus(selectedEleve.id)

        showToast('Paiement enregistré (En ligne) !', 'success')
      } else {
        // 3. Offline Fallback
        try {
          const paiementTable = db.table('paiements')
          await paiementTable.add(newPaiement)
          await addToSyncQueue('paiements', 'INSERT', newPaiement as any, ecoleId)
          
          // Local balance update
          const efTable = db.table('eleves_frais')
          const ef = await efTable.where({ eleve_id: selectedEleve.id, frais_id: selectedFraisId }).first()
          if (ef) {
             const updatedAcompte = (ef as any).montant_paye ? (ef as any).montant_paye + m : m
             await efTable.update(ef.id, { montant_paye: updatedAcompte } as any)
          }
        } catch (e) {
          console.warn('Local save fail:', e)
        }

        // Force recalcul local du statut
        await db!.recalculateEleveStatus(selectedEleve.id)

        showToast('Paiement enregistré (Hors-ligne) !', 'success')
      }

      setMontant('')
      setMode('')
      setReference('')
      setSelectedMonth('')
      
      // Reload UI: ON RECHARGE AUSSI LES ELEVES POUR LE STATUT
      await Promise.all([
        loadElevesLocal(ecoleId),
        loadElevesFraisLocal(ecoleId),
        loadPaiementsLocal(ecoleId)
      ])
    } catch (err: any) {
      console.error(err)
      showToast('Erreur : ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function buildRecuInfo(paiement: Paiement): PaiementRecuInfo | null {
    if (!ecole || !selectedEleve) return null
    const fraisDetails = frais.find(f => f.id === paiement.frais_id)
    return {
      id: paiement.id,
      date_paiement: paiement.date_paiement,
      montant: paiement.montant,
      mode_paiement: paiement.mode || 'Non spécifié',
      reference: paiement.reference,
      eleve_nom: selectedEleve.nom,
      eleve_prenom: selectedEleve.prenom,
      eleve_matricule: selectedEleve.matricule,
      classe_nom: selectedEleve.classe?.nom_classe || 'Niveau non défini',
      frais_libelle: fraisDetails?.libelle || 'Scolarité',
    }
  }

  async function handleDownloadReceipt(paiement: Paiement) {
    const info = buildRecuInfo(paiement)
    if (!info || !ecole) return
    try { await generatePaiementRecuPDF(ecole, info, profile) }
    catch { showToast('Erreur lors de la génération du reçu PDF', 'error') }
  }

  async function handlePrintReceipt(paiement: Paiement) {
    const info = buildRecuInfo(paiement)
    if (!info || !ecole) return
    try { await printPaiementRecuPDF(ecole, info, profile) }
    catch { showToast("Erreur lors de l'impression", 'error') }
  }

  function handleShare(paiement: Paiement, method: 'whatsapp' | 'email' | 'copy') {
    const info = buildRecuInfo(paiement)
    if (!info || !ecole) return
    sharePaiementRecu(info, ecole, method)
    if (method === 'copy') {
      setCopied(true)
      showToast('Texte copié dans le presse-papier !', 'success')
      setTimeout(() => setCopied(false), 2000)
    }
    setShareOpenId(null)
  }

  const balancesMap = useMemo(() => {
    const map = new Map<string, { du: number; paye: number; reste: number }>()

    // Initialisation
    eleves.forEach(e => map.set(e.id, { du: 0, paye: 0, reste: 0 }))

    // Cumul des frais dus
    elevesFrais.forEach(ef => {
      const current = map.get(ef.eleve_id) || { du: 0, paye: 0, reste: 0 }
      const aPayer = Number(ef.montant_a_payer) || (Number(ef.montant_du) - (Number(ef.montant_remise) || 0)) || 0
      const newDu = current.du + aPayer
      map.set(ef.eleve_id, { ...current, du: newDu, reste: newDu - current.paye })
    })

    // Cumul des paiements effectués
    paiements.forEach(p => {
      const current = map.get(p.eleve_id) || { du: 0, paye: 0, reste: 0 }
      const newPaye = current.paye + (Number(p.montant) || 0)
      map.set(p.eleve_id, { ...current, paye: newPaye, reste: current.du - newPaye })
    })

    return map
  }, [eleves, elevesFrais, paiements])

  const getEleveBalance = (eleveId: string) => {
    return balancesMap.get(eleveId) || { du: 0, paye: 0, reste: 0 }
  }

  const handleUpdatePhone = async (eleveId: string) => {
    if (!tempPhone.trim() || !db) return
    let phone = tempPhone.trim()
    // Auto-add +221 for Senegal if 9 digits
    if (phone.length === 9 && !phone.startsWith('+')) {
      phone = '+221' + phone
    }
    
    try {
      const eleveTable = db.table('eleves')
      await eleveTable.update(eleveId, { telephone_parent: phone })
      await addToSyncQueue('eleves', 'UPDATE', { id: eleveId, telephone_parent: phone }, ecoleId!)
      setEleves(prev => prev.map(e => e.id === eleveId ? { ...e, telephone_parent: phone } : e))
      setEditingPhoneId(null)
      showToast('Téléphone mis à jour !', 'success')
    } catch (err) {
      showToast('Erreur lors de la mise à jour.', 'error')
    }
  }

  const handlePerformAssignment = async () => {
    if (!db || !ecoleId || !assignFeeId) return
    setSaving(true)
    
    const targetFee = frais.find(f => f.id === assignFeeId)
    if (!targetFee) return

    try {
      // 1. Filter students based on targeted class or all
      const targets = assignClasseId === 'all' 
        ? eleves 
        : eleves.filter(e => e.classe_id === assignClasseId)

      if (targets.length === 0) {
        showToast('Aucun élève trouvé pour cette cible.', 'error')
        return
      }

      let count = 0
      for (const eleve of targets) {
        // 2. Avoid duplicates : check if EleveFrais already exists locally
        const exists = elevesFrais.find(ef => ef.eleve_id === eleve.id && ef.frais_id === assignFeeId)
        if (!exists) {
          const newEF: EleveFrais = {
            id: crypto.randomUUID(),
            ecole_id: ecoleId,
            eleve_id: eleve.id,
            frais_id: assignFeeId,
            montant_du: targetFee.montant,
            montant_remise: 0,
            montant_a_payer: targetFee.montant
          }
          
          // Store locally
          try {
            await db.table('eleves_frais').add(newEF)
            // Queue for Supabase
            await addToSyncQueue('eleves_frais', 'INSERT', newEF as any, ecoleId)
            count++
          } catch (e) {
            console.warn('EleveFrais add fail:', e)
          }
        }
      }

      showToast(`${count} affectation(s) réussie(s) !`, 'success')
      setIsAssigning(false)
      
      // Reload UI states
      await loadElevesFraisLocal(ecoleId)
    } catch (err) {
      console.error(err)
      showToast('Erreur lors de l\'affectation.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleWhatsAppReminder = async (eleve: EleveWithClasse, reste: number) => {
    if (!eleve.telephone_parent || !db || !ecole) return
    
    const message = `Bonjour, l'école ${ecole.nom} vous informe que le solde de ${eleve.prenom} ${eleve.nom} présente un retard de ${reste.toLocaleString('fr-FR')} F. Merci de régulariser au plus vite.`
    const encoded = encodeURIComponent(message)
    const url = `https://wa.me/${eleve.telephone_parent.replace(/\s+/g, '').replace('+', '')}?text=${encoded}`
    
    window.open(url, '_blank')
    
    // Update last reminder date locally
    const today = formatDate(new Date())
    try {
      const efTable = db.table('eleves_frais')
      const efs = elevesFrais.filter(ef => ef.eleve_id === eleve.id)
      for (const ef of efs) {
        await efTable.update(ef.id, { derniere_relance_le: today } as any)
      }
      // Reload local data to reflect date
      if (ecoleId) await loadElevesFraisLocal(ecoleId)
    } catch (err) {
      console.warn('Error updating last reminder date:', err)
    }
  }

  const filteredEleves = eleves.filter(e => {
    if (activeTab === 'impayes') {
      const { reste } = getEleveBalance(e.id)
      // Secours : si le calcul du solde (reste) est 0 mais que le statut dit "impayé", on le montre
      return reste > 0 || e.statut_paiement === 'impayé' || e.statut_paiement === 'partiel'
    }
    return true
  })

  // Calculate KPIs
  const totalEleves = eleves.length
  
  // Correction: "Total attendu" = somme de l'argent qu'on attend de récupérer
  // Si on veut le "Reste total à recouvrer" (ce qui manque) :
  const totalRestant = Array.from(balancesMap.values()).reduce((sum, bal) => sum + Math.max(0, bal.reste), 0)
  
  // Si on veut le "Chiffre d'affaire total prévu" (ce que l'école devrait gagner au total) :
  const totalDu = Array.from(balancesMap.values()).reduce((sum, bal) => sum + bal.du, 0)
  
  const totalEncaisse = Array.from(balancesMap.values()).reduce((sum, bal) => sum + bal.paye, 0)
  const tauxRecouvrement = totalDu > 0 ? (totalEncaisse / totalDu) * 100 : 0

  const elevesParStatut = {
    payé: eleves.filter(e => e.statut_paiement === 'payé').length,
    partiel: eleves.filter(e => e.statut_paiement === 'partiel').length,
    impayé: eleves.filter(e => e.statut_paiement === 'impayé').length,
  }

  // Monthly payments data for chart
  const paiementsParMois = paiements.reduce((acc, paiement) => {
    const mois = formatMonthYear(paiement.date_paiement)
    if (!acc[mois]) acc[mois] = 0
    acc[mois] += paiement.montant
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Paiements Scolaires</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium max-w-2xl tracking-tight">
            Pilotez les encaissements et le recouvrement. Le statut est synchronisé automatiquement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'director' && (
            <button
              onClick={() => setIsAssigning(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:border-emerald-500 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Attribuer des frais
            </button>
          )}

          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Flux en direct</span>
          </div>
        </div>
      </div>

      {/* KPIs Dashboard */}
      {/* KPIs Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:rotate-6 transition-all duration-500">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total élèves</p>
              <div className="text-2xl font-black text-slate-900 leading-none">{totalEleves}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 group-hover:rotate-6 transition-all duration-500">
              <TrendingDown className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Reste à recouvrer</p>
              <div className="text-2xl font-black text-slate-900 leading-none">
                {loading ? '...' : totalRestant.toLocaleString('fr-FR')} <span className="text-[10px] font-black ml-1 uppercase text-slate-400">F</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:rotate-6 transition-all duration-500 shadow-sm">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Encaissé</p>
              <div className="text-2xl font-black text-emerald-600 leading-none">
                {loading ? '...' : totalEncaisse.toLocaleString('fr-FR')} <span className="text-[10px] font-black ml-1 uppercase opacity-60">F</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-6 group hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-900/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-slate-900 flex items-center justify-center text-white rounded-2xl group-hover:rotate-6 transition-all duration-500 shadow-lg shadow-slate-900/10">
              <DollarSign className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Recouvrement</p>
              <div className="text-2xl font-black text-slate-900 leading-none">
                {tauxRecouvrement.toFixed(1)} <span className="text-[10px] font-black ml-1 uppercase text-slate-400">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 group hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Répartition des statuts
            </h3>
            <PieChart className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Dossiers soldés</span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{elevesParStatut.payé} élèves</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-3.5 p-1 border border-slate-100 shadow-inner">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-emerald-500/30" 
                  style={{ width: `${(elevesParStatut.payé / totalEleves) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Paiements partiels</span>
                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{elevesParStatut.partiel} élèves</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-3.5 p-1 border border-slate-100 shadow-inner">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-amber-500/30" 
                  style={{ width: `${(elevesParStatut.partiel / totalEleves) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Dossiers en attente</span>
                <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{elevesParStatut.impayé} élèves</span>
              </div>
              <div className="w-full bg-slate-50 rounded-full h-3.5 p-1 border border-slate-100 shadow-inner">
                <div 
                  className="bg-red-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-red-500/30" 
                  style={{ width: `${(elevesParStatut.impayé / totalEleves) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-8 group hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Recettes Mensuelles
            </h3>
            <BarChart3 className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="space-y-3">
            {Object.entries(paiementsParMois).slice(0, 5).map(([mois, montant]) => (
              <div key={mois} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm hover:translate-x-1 transition-transform cursor-default">
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">{mois}</span>
                <span className="text-sm font-black text-slate-900">
                  {montant.toLocaleString('fr-FR')} <span className="text-[10px] text-slate-400">F</span>
                </span>
              </div>
            ))}
            {Object.entries(paiementsParMois).length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">Aucun historique mensuel</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Student Selection */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('tous')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'tous' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tous les dossiers
            </button>
            <button
              onClick={() => setActiveTab('impayes')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeTab === 'impayes' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-red-600'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'impayes' ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
              Retardataires ({eleves.filter(e => {
                const { reste } = getEleveBalance(e.id);
                return reste > 0 || e.statut_paiement === 'impayé' || e.statut_paiement === 'partiel';
              }).length})
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un dossier élève…"
              className="w-full pl-12 pr-6 py-4.5 bg-white border border-slate-200/60 rounded-[2rem] text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            {loading || profileLoading ? (
              <div className="p-8 space-y-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEleves.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 px-10 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Users className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1 tracking-tight">Aucun résultat</h3>
                <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto">
                  Aucun élève ne correspond à votre recherche pour le moment.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 overflow-y-auto max-h-[600px] custom-scrollbar">
                {filteredEleves.map((e) => (
                  <li
                    key={e.id}
                    className={`px-8 py-5 flex items-center gap-5 cursor-pointer transition-all duration-500 relative group overflow-hidden ${
                      selectedEleve?.id === e.id ? 'bg-emerald-50/50' : 'hover:bg-slate-50/80 hover:translate-x-1'
                    }`}
                    onClick={() => setSelectedEleve(e)}
                  >
                    {selectedEleve?.id === e.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 shadow-[2px_0_10px_rgba(16,185,129,0.3)] animate-in slide-in-from-left duration-300" />
                    )}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg transition-transform duration-500 group-hover:scale-105 ${
                      selectedEleve?.id === e.id ? 'bg-emerald-600 rotate-3' : 'bg-slate-900 grayscale-[0.2] group-hover:grayscale-0'
                    }`}>
                      {e.prenom[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-base font-black truncate transition-colors uppercase tracking-tight ${selectedEleve?.id === e.id ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {e.prenom} {e.nom}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-400 font-bold tracking-[0.1em] uppercase mt-0.5">
                          {(e.classe as any)?.nom_classe ?? 'NON ASSIGNÉ'} · <span className="text-slate-500 font-black">{e.matricule}</span>
                        </p>
                        {getEleveBalance(e.id).reste > 0 && (
                          <span className="text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                            Reste: {getEleveBalance(e.id).reste.toLocaleString('fr-FR')} F
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg border shadow-sm ${
                        e.statut_paiement === 'payé'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : e.statut_paiement === 'partiel'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {e.statut_paiement}
                      </span>
                      {/* Affichage des mois impayés si frais mensuels assignés */}
                      {(() => {
                        const mensuelFrais = elevesFrais.find(ef => {
                          const fr = frais.find(f => f.id === ef.frais_id)
                          return ef.eleve_id === e.id && (fr?.frequence === 'mensuel' || fr?.libelle?.toLowerCase().includes('scolarit'))
                        })
                        if (mensuelFrais) {
                          const impayes = getMoisImpayes(e.id, mensuelFrais.frais_id)
                          if (impayes.length > 0) {
                            return (
                              <div className="mt-1 flex flex-wrap gap-1 justify-end max-w-[150px]">
                                <span className="text-[7px] font-black text-red-500 uppercase w-full text-right bg-red-50 px-1 rounded">
                                  Dû: {impayes.slice(0, 3).join(', ')}{impayes.length > 3 ? '...' : ''}
                                </span>
                              </div>
                            )
                          }
                        }
                        return null
                      })()}
                      {activeTab === 'impayes' && (
                        <div className="flex items-center gap-2">
                           {e.telephone_parent ? (
                             <button
                               onClick={(evt) => {
                                 evt.stopPropagation()
                                 const { reste } = getEleveBalance(e.id)
                                 handleWhatsAppReminder(e, reste)
                               }}
                               className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                               title="Relancer sur WhatsApp"
                             >
                               <MessageCircle className="w-5 h-5" />
                             </button>
                           ) : (
                             <div className="flex items-center gap-1" onClick={(evt) => evt.stopPropagation()}>
                               {editingPhoneId === e.id ? (
                                 <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                                   <input
                                     autoFocus
                                     type="text"
                                     value={tempPhone}
                                     onChange={(ev) => setTempPhone(ev.target.value)}
                                     placeholder="+221..."
                                     className="w-24 px-2 py-1.5 bg-slate-100 border-none rounded-lg text-[10px] font-bold outline-none"
                                     onKeyDown={(ev) => ev.key === 'Enter' && handleUpdatePhone(e.id)}
                                   />
                                   <button onClick={() => handleUpdatePhone(e.id)} className="p-1.5 bg-emerald-500 text-white rounded-lg"><CheckCircle2 className="w-3 h-3"/></button>
                                 </div>
                               ) : (
                                 <button
                                   onClick={() => { setEditingPhoneId(e.id); setTempPhone('') }}
                                   className="text-[9px] font-black uppercase text-slate-400 hover:text-emerald-600 flex items-center gap-1"
                                 >
                                   <CreditCard className="w-3 h-3" /> Ajouter Tel.
                                 </button>
                               )}
                             </div>
                           )}
                        </div>
                      )}
                      
                      {activeTab === 'impayes' && elevesFrais.find(ef => ef.eleve_id === e.id)?.derniere_relance_le && (
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Relancé le {elevesFrais.find(ef => ef.eleve_id === e.id)?.derniere_relance_le}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column: Payment Form & History */}
        <div className="w-full lg:w-[380px] space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm p-8 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500/10 group-focus-within:bg-emerald-500/20 transition-all" />
            
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Nouveau Versement
            </h2>
            
            {!selectedEleve ? (
              <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 animate-in zoom-in-95 duration-500">
                <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-8 leading-relaxed">
                  Veuillez d&apos;abord sélectionner un élève dans la liste de gauche.
                </p>
              </div>
            ) : (
              <form onSubmit={enregistrerPaiement} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Frais</label>
                    <select
                      value={selectedFraisId}
                      onChange={(e) => setSelectedFraisId(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="">Sélectionner…</option>
                      {frais.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.libelle} ({f.montant.toLocaleString('fr-FR')} F)
                        </option>
                      ))}
                    </select>
                  </div>

                  {isMensuel && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mois concerné</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Sélectionner le mois…</option>
                        {months.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Montant versé (F CFA)</label>
                    <input
                      type="text"
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                      placeholder="Ex: 25 000"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all placeholder:text-slate-300"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mode</label>
                      <input
                        type="text"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        placeholder="Espèces/Mobile"
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Réf. Transaction</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Ex: Wave ID, Chèque…"
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-5 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white text-sm font-black tracking-widest uppercase transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {saving ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement…</>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5" /> Valider le versement</>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* History Section */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden group">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                Derniers règlements
              </h3>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {!selectedEleve ? (
                <div className="py-12 text-center opacity-30">
                  <Printer className="w-10 h-10 mx-auto mb-4 text-slate-200" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Aucune donnée</p>
                </div>
              ) : (
                paiements
                  .filter(p => p.eleve_id === selectedEleve.id)
                  .map((p) => {
                    const fLibelle = frais.find(f => f.id === p.frais_id)?.libelle || 'Scolarité'
                    return (
                      <div key={p.id} className="p-5 bg-white border border-slate-100 rounded-3xl group/item hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5 transition-all duration-300">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-lg font-black text-slate-900 leading-none">
                              {p.montant.toLocaleString('fr-FR')} <span className="text-xs uppercase text-slate-400">F</span>
                            </p>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                              {fLibelle} {(p as any).mois ? `— ${(p as any).mois}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleDownloadReceipt(p)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title="Télécharger Reçu PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handlePrintReceipt(p)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                              title="Imprimer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-slate-50 mt-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {formatDateTime(p.date_paiement)}
                          </span>
                          <span className="text-[10px] font-black text-slate-400 uppercase italic">
                            {p.reference || p.mode || 'N/A'}
                          </span>
                        </div>
                      </div>
                    )
                  })
              )}
              {selectedEleve && paiements.filter(p => p.eleve_id === selectedEleve.id).length === 0 && (
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 text-center py-10">Aucun historique pour cet élève</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal d'affectation collective */}
      {isAssigning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Affectation collective</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">Attribuer un frais à plusieurs élèves</p>
                </div>
                <button onClick={() => setIsAssigning(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Frais</label>
                  <select
                    value={assignFeeId}
                    onChange={(e) => setAssignFeeId(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-emerald-500/10 focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Choisir un frais…</option>
                    {frais.map((f) => (
                      <option key={f.id} value={f.id}>{f.libelle} ({f.montant.toLocaleString('fr-FR')} F)</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cible</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAssignClasseId('all')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-2 ${
                        assignClasseId === 'all' 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-900/5' 
                          : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <LayoutGrid className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-left">Toute l'école</span>
                    </button>
                    <div className="relative group">
                      <select
                        value={assignClasseId === 'all' ? '' : assignClasseId}
                        onChange={(e) => setAssignClasseId(e.target.value)}
                        className={`w-full h-full p-4 rounded-2xl border-2 transition-all appearance-none cursor-pointer text-[10px] font-black uppercase tracking-widest ${
                          assignClasseId !== 'all'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-900/5'
                            : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <option value="">Par classe…</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.nom_classe}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {assignFeeId && (
                  <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900">Estimation</p>
                      <p className="text-[10px] font-medium text-amber-700 mt-1 uppercase tracking-tight">
                        L'attribution sera appliquée à{' '}
                        <span className="font-black">
                          {assignClasseId === 'all' 
                            ? eleves.length 
                            : eleves.filter(e => e.classe_id === assignClasseId).length
                          } élèves
                        </span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsAssigning(false)}
                  className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handlePerformAssignment}
                  disabled={saving || !assignFeeId}
                  className="flex-2 py-5 px-10 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Traitement…</>
                  ) : (
                    <><Check className="w-4 h-4" /> Valider l'affectation</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

