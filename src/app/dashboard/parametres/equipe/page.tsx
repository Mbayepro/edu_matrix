'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Ecole } from '@/lib/supabase'
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  Mail,
  UserPlus,
  Copy,
  CheckCircle2,
  ShieldCheck,
  X,
  User
} from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/contexts/ToastContext'
import Link from 'next/link'

export default function EquipeManagementPage() {
  const { profile, ecole, loading: profileLoading } = useProfile()
  const ecoleId = profile?.ecole_id || null
  const { showToast } = useToast()

  const [membres, setMembres] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'teacher' | 'director'>('teacher')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ecoleId) {
      loadEquipe()
    }
  }, [ecoleId])

  async function loadEquipe() {
    if (!ecoleId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('ecole_id', ecoleId)
        .order('role', { ascending: true })
        .order('nom')
      
      setMembres(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  function generateInviteLink() {
    if (!ecoleId) return
    // On simule un lien d'invitation avec le code de l'école (ID par exemple ou un hash)
    const baseUrl = window.location.origin
    const link = `${baseUrl}/signup?school=${ecoleId}&role=${inviteRole}`
    setInviteCode(link)
  }

  function copyToClipboard() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('Lien copié !', 'success')
    }
  }

  async function handleRemoveMembre(id: string, role: string) {
    if (role === 'director' && membres.filter(m => m.role === 'director').length <= 1) {
      showToast("Impossible de supprimer le dernier compte directeur.", "error")
      return
    }
    
    if (!confirm('Voulez-vous vraiment retirer ce membre de l\'équipe ?')) return
    
    // Dans une vraie app, on supprimerait aussi l'accès Auth. 
    // Ici on vide juste l'ecole_id du profil.
    const { error } = await (supabase.from('profiles' as any) as any)
      .update({ ecole_id: null } as any)
      .eq('id', id)
      
    if (!error) {
      showToast('Membre retiré de l\'équipe.', 'success')
      loadEquipe()
    } else {
      showToast('Erreur lors de la suppression.', 'error')
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestion de l&apos;Équipe</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium tracking-tight">
            Gérez les accès et les rôles des collaborateurs de <span className="text-slate-900 font-bold">{ecole?.nom}</span>.
          </p>
        </div>

        <nav className="flex p-1.5 bg-slate-100 rounded-[1.25rem] border border-slate-200 shadow-inner">
          <Link
            href="/dashboard/parametres"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600"
          >
            Général
          </Link>
          <Link
            href="/dashboard/parametres/frais"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600"
          >
            Frais
          </Link>
          <Link
            href="/dashboard/parametres/equipe"
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white text-emerald-600 shadow-sm"
          >
            Équipe
          </Link>
        </nav>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { setShowInviteModal(true); setInviteCode(null); }}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-emerald-600 text-white text-sm font-black rounded-xl transition-all shadow-xl shadow-slate-900/10"
        >
          <UserPlus className="w-4 h-4" />
          Inviter un membre
        </button>
      </div>

      {/* Team List */}
      <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Membres de l&apos;Équipe</h2>
        </div>
        
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/30">
              <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilisateur</th>
              <th className="text-left px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rôle & Privilèges</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {membres.map((m) => (
              <tr key={m.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-sm font-black transition-transform group-hover:scale-110">
                      {m.prenom[0]?.toUpperCase()}{m.nom[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900 leading-tight">{m.prenom} {m.nom}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID: {m.id.split('-')[0]}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5">
                  <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                    m.role === 'director' 
                      ? 'bg-amber-50 border-amber-200 text-amber-700' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {m.role === 'director' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    {m.role === 'director' ? 'Directeur' : 'Enseignant'}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  {m.id !== profile?.id && (
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleRemoveMembre(m.id, m.role)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Révoquer l'accès"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600" />
                Inviter un collaborateur
              </h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!inviteCode ? (
                <>
                  <p className="text-sm text-slate-500">
                    Générez un lien d&apos;invitation sécurisé pour permettre à un enseignant ou un co-directeur de rejoindre votre école.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Compte à créer</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setInviteRole('teacher')}
                          className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                            inviteRole === 'teacher' 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          Enseignant
                        </button>
                        <button 
                          onClick={() => setInviteRole('director')}
                          className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                            inviteRole === 'director' 
                              ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          Administrateur
                        </button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={generateInviteLink}
                    className="w-full py-4 bg-slate-800 text-white rounded-2xl text-sm font-bold hover:bg-slate-900 transition-all shadow-lg"
                  >
                    Générer le lien d&apos;invitation
                  </button>
                </>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                      Lien généré ! Envoyez ce lien à votre futur collaborateur. Il pourra s&apos;inscrire et sera directement rattaché à votre établissement.
                    </p>
                  </div>

                  <div className="relative group">
                    <input 
                      readOnly
                      value={inviteCode}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 pr-12 text-xs font-mono text-slate-600 focus:outline-none"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white rounded-xl text-slate-400 hover:text-emerald-600 transition-all"
                    >
                      {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  <button 
                    onClick={() => setShowInviteModal(false)}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    Terminer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
