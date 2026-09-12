import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { X, Phone, User, Calendar, MessageCircle, AlertCircle } from 'lucide-react'
import { getTodayDate, formatDateLong } from '@/lib/dateUtils'

interface TodayAbsencesModalProps {
  isOpen: boolean
  onClose: () => void
  ecoleId: string
}

export default function TodayAbsencesModal({ isOpen, onClose, ecoleId }: TodayAbsencesModalProps) {
  const [absences, setAbsences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadAbsences()
    }
  }, [isOpen])

  async function loadAbsences() {
    setLoading(true)
    try {
      const today = getTodayDate()
      // Récupérer toutes les présences de l'école pour aujourd'hui
      const presencesToday = await db.presences
        .where('date').equals(today)
        .toArray()

      // Filtrer pour ne garder que les absents et les retards
      const absencesOnly = presencesToday.filter(p => p.ecole_id === ecoleId && (p.statut === 'absent' || p.statut === 'retard'))
      
      // Récupérer les détails des élèves (noms, téléphone parents, classe)
      const eleveIds = absencesOnly.map(p => p.eleve_id)
      const eleves = await db.eleves.where('id').anyOf(eleveIds).toArray()
      
      const classeIds = eleves.map(e => e.classe_id)
      const classes = await db.classes.where('id').anyOf(classeIds).toArray()

      const enriched = absencesOnly.map(presence => {
        const eleve = eleves.find(e => e.id === presence.eleve_id)
        const classe = classes.find(c => c.id === eleve?.classe_id)
        return {
          ...presence,
          eleve,
          classe,
        }
      })

      // Trier par classe puis par nom
      enriched.sort((a, b) => {
        if (a.classe?.nom_classe !== b.classe?.nom_classe) {
          return (a.classe?.nom_classe || '').localeCompare(b.classe?.nom_classe || '')
        }
        return (a.eleve?.nom || '').localeCompare(b.eleve?.nom || '')
      })

      setAbsences(enriched)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-rose-500" />
              Absences et Retards du jour
            </h2>
            <p className="text-slate-400 text-sm mt-1">{formatDateLong(getTodayDate())}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : absences.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-white font-bold text-lg">Aucune absence signalée aujourd'hui !</p>
              <p className="text-slate-500 text-sm mt-1">Tous les élèves évalués sont présents.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {absences.map((item, idx) => {
                const telephone = item.eleve?.telephone_parent || item.eleve?.telephone_tuteur
                const hasPhone = !!telephone
                // Formatage simple pour WhatsApp (enlever les espaces)
                const phoneForWa = telephone ? telephone.replace(/\s+/g, '') : ''
                
                // Message pré-rempli
                const waMessage = item.statut === 'absent'
                  ? `Bonjour, sauf erreur de notre part, nous vous informons que votre enfant ${item.eleve?.prenom} ${item.eleve?.nom} est absent(e) ce jour (${getTodayDate()}). Merci de vous rapprocher de l'administration.`
                  : `Bonjour, nous vous informons que votre enfant ${item.eleve?.prenom} ${item.eleve?.nom} est arrivé(e) en retard ce jour (${getTodayDate()}).`

                const waLink = `https://wa.me/${phoneForWa}?text=${encodeURIComponent(waMessage)}`
                const telLink = `tel:${phoneForWa}`

                return (
                  <div key={idx} className="bg-slate-800/50 rounded-2xl p-4 border border-slate-800 flex items-center justify-between group hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.statut === 'absent' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">
                          {item.eleve?.prenom} {item.eleve?.nom}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md">
                            {item.classe?.nom_classe || 'Classe inconnue'}
                          </span>
                          <span className={`text-xs font-black uppercase tracking-wider ${item.statut === 'absent' ? 'text-rose-400' : 'text-amber-400'}`}>
                            {item.statut}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasPhone ? (
                        <>
                          <a 
                            href={telLink}
                            title="Appeler le parent"
                            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a 
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Envoyer un message WhatsApp"
                            className="w-10 h-10 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/20 transition-all"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </a>
                        </>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1 bg-slate-800 rounded-full">
                          Pas de contact
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
