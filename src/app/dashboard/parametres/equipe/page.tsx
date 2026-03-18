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
    const { error } = await supabase
      .from('profiles')
      .update({ ecole_id: null })
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Settings */}
      <div className="flex gap-2 mb-6 text-sm">
        <Link href="/dashboard/parametres" className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
          Général
        </Link>
        <Link href="/dashboard/parametres/frais" className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
          Frais scolaires
        </Link>
        <Link href="/dashboard/parametres/equipe" className="px-3 py-2 rounded-lg bg-emerald-600 text-white shadow-sm">
          Équipe
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Gestion de l&apos;équipe</h1>
            <p className="text-sm text-slate-500">Gérez les professeurs et administrateurs de {ecole?.nom}</p>
          </div>
        </div>
        
        <button
          onClick={() => { setShowInviteModal(true); setInviteCode(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Inviter
        </button>
      </div>

      {/* Team List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Membre</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Rôle</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {membres.map((membre) => (
              <tr key={membre.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                      {membre.prenom[0]}{membre.nom[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{membre.prenom} {membre.nom}</p>
                      <p className="text-xs text-slate-400">Collaborateur EduMatrix</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    membre.role === 'director' 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {membre.role === 'director' ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {membre.role === 'director' ? 'Administrateur' : 'Enseignant'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {membre.id !== profile?.id && (
                    <button
                      onClick={() => handleRemoveMembre(membre.id, membre.role)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Retirer de l'équipe"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
