'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
  LayoutGrid,
  Receipt
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useNetwork } from '@/hooks/useNetwork'
import { useToast } from '@/contexts/ToastContext'
import { generatePaiementRecuPDF, printPaiementRecuPDF, sharePaiementRecu, PaiementRecuInfo, printThermalPaiementRecuPDF } from '@/lib/pdfRecuGenerator'
import { Skeleton } from '@/components/Skeleton'
import { StatCards } from '@/components/paiements/StatCards'
import { AssignFeeModal } from '@/components/paiements/AssignFeeModal'
import { PaymentForm } from '@/components/paiements/PaymentForm'
import { PaymentHistory } from '@/components/paiements/PaymentHistory'
import { StudentList } from '@/components/paiements/StudentList'
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

function PaiementsContent() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()
  const searchParams = useSearchParams()

  const initialTab = searchParams.get('tab') === 'impayes' ? 'impayes' : 'tous'

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
  const [activeTab, setActiveTab] = useState<'tous' | 'impayes'>(initialTab)
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

  const getCurrentSchoolMonthIndex = () => {
    // Obtenir le mois actuel en français
    const currentMonth = new Date().toLocaleString('fr-FR', { month: 'long' }).toLowerCase()
    const index = SCHOOL_MONTHS.findIndex(m => m.toLowerCase() === currentMonth)
    
    // Si on est en Août ou Septembre (hors année scolaire), 
    // on ne compte aucun retard pour la nouvelle année qui se prépare.
    if (index === -1) {
      return -1 // -1 signifie qu'aucun mois n'est encore écoulé pour les mensualités
    }
    return index
  }

  const getMoisEnRetard = (eleveId: string, itemFraisId: string) => {
    const f = frais.find(fr => fr.id === itemFraisId)
    if (!f) return []
    const lib = (f.libelle || '').toLowerCase()
    if (f.frequence !== 'mensuel' && !lib.includes('mensu') && !lib.includes('scolarit')) return []

    const moisPayes = paiements
      .filter(p => p.eleve_id === eleveId && p.frais_id === itemFraisId)
      .map(p => (p as any).mois)
      .filter(Boolean)

    const currentIndex = getCurrentSchoolMonthIndex()
    const pastMonths = SCHOOL_MONTHS.slice(0, currentIndex + 1)
    return pastMonths.filter(m => !moisPayes.includes(m))
  }

  const isEleveEnRetard = (eleveId: string) => {
    const efs = elevesFrais.filter(ef => ef.eleve_id === eleveId)
    let isLate = false
    
    for (const ef of efs) {
      const f = frais.find(fr => fr.id === ef.frais_id)
      if (f) {
        const lib = (f.libelle || '').toLowerCase()
        if (f.frequence === 'mensuel' || lib.includes('mensu') || lib.includes('scolarit')) {
          const retards = getMoisEnRetard(eleveId, ef.frais_id)
          if (retards.length > 0) isLate = true
        } else {
          const aPayer = Number(ef.montant_a_payer) || (Number(ef.montant_du) - (Number(ef.montant_remise) || 0)) || 0
          const paye = paiements.filter(p => p.eleve_id === eleveId && p.frais_id === ef.frais_id).reduce((s, p) => s + Number(p.montant), 0)
          if (aPayer > paye) isLate = true
        }
      }
    }
    return isLate
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

  async function enregistrerPaiement(e: React.FormEvent, autoPrint: boolean = true) {
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

      // Impression automatique si demandée
      if (autoPrint && ecole) {
        const info = buildRecuInfo(newPaiement as any)
        if (info) {
           printPaiementRecuPDF(ecole, info, profile).catch(e => console.warn("Erreur auto-print:", e))
        }
      }
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

  async function handlePrintThermalReceipt(paiement: Paiement) {
    const info = buildRecuInfo(paiement)
    if (!info || !ecole) return
    try { await printThermalPaiementRecuPDF(ecole, info, profile) }
    catch { showToast("Erreur lors de l'impression thermique", 'error') }
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
      return isEleveEnRetard(e.id)
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-none">Paiements Scolaires</h1>
          </div>
          <p className="text-sm text-slate-300 font-medium max-w-2xl tracking-tight">
            Pilotez les encaissements et le recouvrement. Le statut est synchronisé automatiquement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'director' && (
            <button
              onClick={() => setIsAssigning(true)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20 active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              Affecter des frais
            </button>
          )}

          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Flux en direct</span>
          </div>
        </div>
      </div>

      {/* KPIs Dashboard */}
      <StatCards
        totalEleves={totalEleves}
        totalRestant={totalRestant}
        totalEncaisse={totalEncaisse}
        tauxRecouvrement={tauxRecouvrement}
        loading={loading}
      />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="premium-glass p-8 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Répartition des statuts
            </h3>
            <PieChart className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Dossiers soldés</span>
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{elevesParStatut.payé} élèves</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3.5 p-1 border border-white/5 shadow-inner">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-emerald-500/30" 
                  style={{ width: `${(elevesParStatut.payé / totalEleves) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Paiements partiels</span>
                <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">{elevesParStatut.partiel} élèves</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3.5 p-1 border border-white/5 shadow-inner">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-amber-500/30" 
                  style={{ width: `${(elevesParStatut.partiel / totalEleves) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                <span className="text-slate-400">Dossiers en attente</span>
                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">{elevesParStatut.impayé} élèves</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3.5 p-1 border border-white/5 shadow-inner">
                <div 
                  className="bg-red-500 h-full rounded-full transition-all duration-1000 shadow-sm shadow-red-500/30" 
                  style={{ width: `${(elevesParStatut.impayé / totalEleves) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="premium-glass p-8 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Recettes Mensuelles
            </h3>
            <BarChart3 className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="space-y-3">
            {Object.entries(paiementsParMois).slice(0, 5).map(([mois, montant]) => (
              <div key={mois} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 shadow-sm hover:translate-x-1 transition-transform cursor-default">
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">{mois}</span>
                <span className="text-sm font-black text-white">
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
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl w-fit border border-white/5">
            <button
              onClick={() => setActiveTab('tous')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'tous' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous les dossiers
            </button>
            <button
              onClick={() => setActiveTab('impayes')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeTab === 'impayes' ? 'bg-white/10 text-rose-400 shadow-sm' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'impayes' ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`} />
              Retardataires ({eleves.filter(e => isEleveEnRetard(e.id)).length})
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un dossier élève…"
              className="w-full pl-12 pr-6 py-4.5 bg-white/5 border border-white/10 rounded-[2rem] text-sm font-bold text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>

          <div className="premium-glass rounded-[2.5rem] overflow-hidden min-h-[500px] flex flex-col">
            <StudentList
              loading={loading}
              profileLoading={profileLoading}
              filteredEleves={filteredEleves as any}
              selectedEleve={selectedEleve as any}
              setSelectedEleve={setSelectedEleve as any}
              elevesFrais={elevesFrais as any}
              frais={frais as any}
              paiements={paiements as any}
              activeTab={activeTab}
              getEleveBalance={getEleveBalance}
              getMoisEnRetard={getMoisEnRetard}
              handleWhatsAppReminder={handleWhatsAppReminder as any}
              editingPhoneId={editingPhoneId}
              setEditingPhoneId={setEditingPhoneId}
              tempPhone={tempPhone}
              setTempPhone={setTempPhone}
              handleUpdatePhone={handleUpdatePhone}
            />
          </div>
        </div>

        {/* Right Column: Payment Form & History */}
        <div className="w-full lg:w-[380px] space-y-6">
          <div className="premium-glass p-8 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500/20 group-focus-within:bg-emerald-500 transition-all" />
            
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Nouveau Versement
            </h2>
            
            <PaymentForm
              selectedEleve={selectedEleve as any}
              enregistrerPaiement={enregistrerPaiement}
              frais={frais as any}
              selectedFraisId={selectedFraisId}
              setSelectedFraisId={setSelectedFraisId}
              isMensuel={isMensuel}
              months={months}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              montant={montant}
              setMontant={setMontant}
              mode={mode}
              setMode={setMode}
              reference={reference}
              setReference={setReference}
              saving={saving}
              paiements={paiements.filter(p => p.eleve_id === selectedEleve?.id) as any}
              elevesFrais={elevesFrais.filter(ef => ef.eleve_id === selectedEleve?.id) as any}
            />
          </div>

          {/* History Section */}
          <PaymentHistory
            selectedEleve={selectedEleve as any}
            paiements={paiements as any}
            frais={frais as any}
            handleDownloadReceipt={handleDownloadReceipt}
            handlePrintThermalReceipt={handlePrintThermalReceipt}
            handlePrintReceipt={handlePrintReceipt}
          />
        </div>
      </div>

      {/* Modal d'affectation collective */}
      <AssignFeeModal
        isAssigning={isAssigning}
        setIsAssigning={setIsAssigning}
        assignFeeId={assignFeeId}
        setAssignFeeId={setAssignFeeId}
        assignClasseId={assignClasseId}
        setAssignClasseId={setAssignClasseId}
        frais={frais as any}
        classes={classes as any}
        eleves={eleves as any}
        saving={saving}
        onPerformAssignment={handlePerformAssignment}
      />
    </div>
  )
}

export default function PaiementsPage() {
  return (
    <Suspense fallback={<div className="p-8">Chargement du module paiements...</div>}>
      <PaiementsContent />
    </Suspense>
  )
}

