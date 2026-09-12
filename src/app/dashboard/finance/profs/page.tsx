'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import { SCHOOL_MONTHS, formatMontantCFA, getCurrentAnnéeScolaire } from '@/lib/financeEngine'
import type { Profile, PaiementStaff } from '@/lib/supabase'
import {
  GraduationCap,
  Plus,
  Loader2,
  X,
  Save,
  CheckCircle2,
  Clock,
  ChevronDown,
  Download,
} from 'lucide-react'
import jsPDF from 'jspdf'

interface ProfWithPaiements {
  profile: Profile
  paiements: PaiementStaff[]
  totalPaye: number
}

export default function ProfsPage() {
  const { profile: myProfile, ecole } = useProfile()
  const { showToast } = useToast()
  const ecoleId = myProfile?.ecole_id

  const [profs, setProfs] = useState<Profile[]>([])
  const [paiementsStaff, setPaiementsStaff] = useState<PaiementStaff[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedProf, setSelectedProf] = useState<Profile | null>(null)

  const annee = getCurrentAnnéeScolaire()

  const [form, setForm] = useState({
    profile_id: '',
    montant: '',
    mois: SCHOOL_MONTHS[0],
    annee_scolaire: annee,
    mode: 'Espèces' as PaiementStaff['mode'],
    reference: '',
    note: '',
  })

  useEffect(() => {
    if (ecoleId) loadAll(ecoleId)
  }, [ecoleId])

  async function loadAll(id: string) {
    setLoading(true)
    try {
      if (!db) return
      const [p, ps] = await Promise.all([
        db.table('profiles').where('ecole_id').equals(id).toArray(),
        db.table('paiements_staff').where('ecole_id').equals(id).toArray(),
      ])
      
      const teachersAndDirectors = p.filter(pr => pr.role === 'teacher' || pr.role === 'director').sort((a, b) => a.nom.localeCompare(b.nom))
      const sortedPayments = ps.sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime())

      setProfs(teachersAndDirectors as any)
      setPaiementsStaff(sortedPayments as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const profsWithPaiements = useMemo((): ProfWithPaiements[] => {
    return profs.map(p => {
      const paiements = paiementsStaff.filter(ps => ps.profile_id === p.id)
      const totalPaye = paiements.reduce((s, ps) => s + Number(ps.montant), 0)
      return { profile: p, paiements, totalPaye }
    })
  }, [profs, paiementsStaff])

  // Mois déjà payé ce prof ?
  function getMoisNonPaye(profId: string): string[] {
    const paiementsProf = paiementsStaff.filter(p => p.profile_id === profId && p.annee_scolaire === annee)
    const moisPayes = paiementsProf.map(p => p.mois)
    return SCHOOL_MONTHS.filter(m => !moisPayes.includes(m))
  }

  async function handleSave() {
    if (!ecoleId || !form.profile_id || !form.montant || !form.mois) return
    
    // Vérifier doublon
    const exists = paiementsStaff.find(p =>
      p.profile_id === form.profile_id &&
      p.mois === form.mois &&
      p.annee_scolaire === form.annee_scolaire
    )
    if (exists) {
      if (!confirm(`Un paiement pour ${form.mois} ${form.annee_scolaire} existe déjà. Ajouter quand même ?`)) return
    }

    setSaving(true)
    try {
      if (!db) throw new Error('DB locale indisponible')
      
      const newPaiement = {
        id: crypto.randomUUID(),
        ecole_id: ecoleId,
        profile_id: form.profile_id,
        montant: parseFloat(form.montant),
        mois: form.mois,
        annee_scolaire: form.annee_scolaire,
        mode: form.mode,
        reference: form.reference.trim() || null,
        note: form.note.trim() || null,
        created_by: myProfile?.id,
        date_paiement: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await db.table('paiements_staff').add(newPaiement)
      
      // Essayer d'insérer en ligne aussi, ou l'ajouter à la file d'attente
      ;(supabase as any).from('paiements_staff').insert(newPaiement).then(({error}: any) => {
         if (error) console.error("Erreur insertion paiement staff en ligne", error)
      })
      showToast('Paiement enregistré !', 'success')
      setShowModal(false)
      setForm(f => ({ ...f, montant: '', reference: '', note: '' }))
      await loadAll(ecoleId)
    } catch (e: any) {
      showToast('Erreur : ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Génération bulletin de salaire PDF simple
  async function genererBulletinSalaire(pmt: PaiementStaff, prof: Profile) {
    if (!ecole) return
    const doc = new jsPDF()
    const pw = doc.internal.pageSize.getWidth()

    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(15, 23, 42)
    doc.text(ecole.nom.toUpperCase(), pw / 2, 25, { align: 'center' })
    
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(100, 116, 139)
    if (ecole.adresse) doc.text(ecole.adresse, pw / 2, 32, { align: 'center' })
    if (ecole.telephone) doc.text(`Tél: ${ecole.telephone}`, pw / 2, 38, { align: 'center' })

    doc.setDrawColor(226, 232, 240)
    doc.line(14, 45, pw - 14, 45)

    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(5, 150, 105)
    doc.text('BULLETIN DE SALAIRE', pw / 2, 58, { align: 'center' })

    doc.setFontSize(11).setTextColor(51, 65, 85)
    doc.setFont('helvetica', 'bold')
    doc.text('Informations employé', 14, 75)
    doc.setFont('helvetica', 'normal')
    doc.text(`Nom & Prénom : ${prof.prenom} ${prof.nom}`, 14, 84)
    doc.text(`Rôle : ${prof.role === 'teacher' ? 'Enseignant' : 'Directeur'}`, 14, 91)
    doc.text(`Période : ${pmt.mois} ${pmt.annee_scolaire}`, 14, 98)
    doc.text(`Date de paiement : ${new Date(pmt.date_paiement).toLocaleDateString('fr-FR')}`, 14, 105)

    doc.line(14, 113, pw - 14, 113)

    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(15, 23, 42)
    doc.text('SALAIRE NET VERSÉ', 14, 128)
    doc.setFontSize(20).setTextColor(5, 150, 105)
    doc.text(`${pmt.montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F CFA`, pw - 14, 128, { align: 'right' })

    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139)
    doc.text(`Mode : ${pmt.mode}`, 14, 142)
    if (pmt.reference) doc.text(`Référence : ${pmt.reference}`, 14, 149)
    if (pmt.note) doc.text(`Note : ${pmt.note}`, 14, 156)

    doc.line(14, 165, pw - 14, 165)
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(15, 23, 42)
    doc.text('Signature employeur', pw - 55, 185)

    doc.setFontSize(8).setTextColor(148, 163, 184)
    doc.text('Généré par EduMatrix · Module Finance', pw / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

    doc.save(`Bulletin_${prof.nom}_${pmt.mois}_${pmt.annee_scolaire}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Salaires profs</h1>
            <p className="text-sm text-slate-400 font-medium">Année scolaire {annee}</p>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true) }}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
        >
          <Plus className="w-4 h-4" />
          Enregistrer un paiement
        </button>
      </div>

      {/* Liste des profs */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="grid gap-4">
          {profsWithPaiements.map(({ profile: prof, paiements, totalPaye }) => {
            const moisNonPayes = getMoisNonPaye(prof.id)
            const isExpanded = selectedProf?.id === prof.id
            const moisDuYear = SCHOOL_MONTHS.length
            const moisPayesCount = moisDuYear - moisNonPayes.length

            return (
              <div key={prof.id} className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/3 transition-colors"
                  onClick={() => setSelectedProf(isExpanded ? null : prof)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-blue-400">
                      {prof.prenom[0]}{prof.nom[0]}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white">{prof.prenom} {prof.nom}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                      {prof.role === 'teacher' ? 'Enseignant' : 'Directeur'}
                    </p>
                  </div>

                  {/* Progress mois */}
                  <div className="hidden md:flex items-center gap-3">
                    <div className="w-24 space-y-1">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">Mois</span>
                        <span className={moisNonPayes.length === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {moisPayesCount}/{moisDuYear}
                        </span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div
                          className={`h-full rounded-full transition-all ${moisNonPayes.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${(moisPayesCount / moisDuYear) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-emerald-400">{formatMontantCFA(totalPaye)}</p>
                    <p className="text-[10px] text-slate-500">payé cette année</p>
                  </div>

                  {moisNonPayes.length === 0
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    : <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  }
                  <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Détail mois */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-5 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    {/* Grille des mois */}
                    <div className="grid grid-cols-5 gap-2 mb-4">
                      {SCHOOL_MONTHS.map(mois => {
                        const pmtMois = paiements.find(p => p.mois === mois && p.annee_scolaire === annee)
                        return (
                          <div
                            key={mois}
                            className={`p-2 rounded-xl text-center border text-[10px] font-black uppercase tracking-wide ${
                              pmtMois
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-white/3 border-white/5 text-slate-600'
                            }`}
                          >
                            {mois.substring(0, 3)}
                            {pmtMois && (
                              <p className="text-[9px] font-bold text-emerald-300/70 mt-0.5">
                                {(pmtMois.montant / 1000).toFixed(0)}k
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Historique des paiements */}
                    {paiements.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historique</p>
                        {paiements.slice(0, 6).map(pmt => (
                          <div key={pmt.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                            <div className="flex-1">
                              <p className="text-xs font-black text-white">{pmt.mois} {pmt.annee_scolaire}</p>
                              <p className="text-[10px] text-slate-500">{pmt.mode} · {new Date(pmt.date_paiement).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <span className="text-xs font-black text-emerald-400">{pmt.montant.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F</span>
                            <button
                              onClick={() => genererBulletinSalaire(pmt, prof)}
                              title="Télécharger le bulletin de salaire"
                              className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bouton payer ce prof */}
                    <button
                      onClick={() => {
                        setForm(f => ({ ...f, profile_id: prof.id }))
                        setShowModal(true)
                      }}
                      className="w-full py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Enregistrer un paiement pour {prof.prenom}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal paiement */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white">Enregistrer un salaire</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 hover:text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sélection prof */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Professeur *</label>
                <select
                  value={form.profile_id}
                  onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500/30 focus:outline-none appearance-none"
                >
                  <option value="">Sélectionner…</option>
                  {profs.map(p => (
                    <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                  ))}
                </select>
              </div>

              {/* Mois + Année */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Mois *</label>
                  <select
                    value={form.mois}
                    onChange={e => setForm(f => ({ ...f, mois: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500/30 focus:outline-none appearance-none"
                  >
                    {SCHOOL_MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Année scolaire</label>
                  <input
                    type="text"
                    value={form.annee_scolaire}
                    onChange={e => setForm(f => ({ ...f, annee_scolaire: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Montant */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Montant (F CFA) *</label>
                <input
                  type="number"
                  value={form.montant}
                  onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                  placeholder="Ex: 75000"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                />
              </div>

              {/* Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Mode</label>
                  <select
                    value={form.mode}
                    onChange={e => setForm(f => ({ ...f, mode: e.target.value as any }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500/30 focus:outline-none appearance-none"
                  >
                    {(['Espèces', 'Mobile Money', 'Virement', 'Chèque'] as const).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Référence</label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="Wave ID…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Note</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Bonus, avance…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 text-sm font-black hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.profile_id || !form.montant || !form.mois}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
