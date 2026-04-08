'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, CalendarX, FileText, School } from 'lucide-react'
import BulletinGenerator from '@/components/BulletinGenerator'

export default function EspaceParentPage() {
  const { pin } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eleve, setEleve] = useState<any>(null)
  const [absences, setAbsences] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'bulletin' | 'absences'>('bulletin')
  const [selectedTrimestre, setSelectedTrimestre] = useState<number>(1)

  useEffect(() => {
    if (pin) {
      loadData(pin as string)
    }
  }, [pin])

  async function loadData(pinCode: string) {
    try {
      setLoading(true)
      // Chercher l'élève par son code PIN via RPC sécurisé
      const { data: eleveData, error: err } = await supabase.rpc('get_eleve_by_pin', { p_pin: pinCode })

      if (err) throw err
      if (!eleveData) {
        setError("Code PIN invalide ou élève introuvable.")
        setLoading(false)
        return
      }

      setEleve(eleveData)

      // Charger les absences via RPC sécurisé
      const { data: absencesData, error: absErr } = await supabase.rpc('get_absences_by_pin', { p_pin: pinCode })

      if (absencesData && !absErr) {
        setAbsences(absencesData)
      }
    } catch (e: any) {
      console.error(e)
      setError("Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (error || !eleve) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarX className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Accès refusé</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* En-tête */}
      <div className="bg-emerald-700 text-white pt-12 pb-24 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {eleve.classe?.ecole?.logo_url ? (
              <img src={eleve.classe.ecole.logo_url} alt="Logo École" className="w-16 h-16 rounded-xl bg-white p-1" />
            ) : (
              <div className="w-16 h-16 bg-emerald-600/50 rounded-xl flex items-center justify-center">
                <School className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">{eleve.prenom} {eleve.nom}</h1>
              <p className="text-emerald-100 font-medium">{eleve.classe?.nom_classe} • {eleve.classe?.ecole?.nom}</p>
            </div>
          </div>
          <div className="bg-emerald-800/50 rounded-xl px-4 py-2 border border-emerald-600/30 text-center sm:text-right backdrop-blur-sm">
            <p className="text-xs uppercase tracking-widest text-emerald-200/70 font-bold mb-1">Espace Parent</p>
            <p className="text-sm font-medium">Vue Simplifiée</p>
          </div>
        </div>
      </div>

      {/* Navigation et Contenu */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('bulletin')}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'bulletin' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" />
              Bulletins
            </button>
            <button
              onClick={() => setActiveTab('absences')}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'absences' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <CalendarX className="w-4 h-4" />
              Absences & Retards
              {absences.length > 0 && (
                <span className="ml-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">{absences.length}</span>
              )}
            </button>
          </div>

          {/* Contenu de l'onglet Bulletins */}
          {activeTab === 'bulletin' && (
            <div className="p-4 sm:p-6 bg-slate-50/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-slate-800 text-lg">Consulter le bulletin</h2>
                <select
                  value={selectedTrimestre}
                  onChange={(e) => setSelectedTrimestre(Number(e.target.value))}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  <option value={1}>1er Trimestre</option>
                  <option value={2}>2ème Trimestre</option>
                  <option value={3}>3ème Trimestre</option>
                </select>
              </div>
              
              <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-100">
                {/* On utilise le générateur de bulletin avec l'ID de l'élève */}
                <div className="transform scale-[0.8] sm:scale-[0.9] lg:scale-100 origin-top-left min-w-[800px]">
                  <BulletinGenerator 
                    eleveId={eleve.id} 
                    classeId={eleve.classe_id} 
                    trimestre={selectedTrimestre} 
                    pinCode={pin as string}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contenu de l'onglet Absences */}
          {activeTab === 'absences' && (
            <div className="p-4 sm:p-6">
              <h2 className="font-bold text-slate-800 text-lg mb-6">Historique des Absences et Retards</h2>
              
              {absences.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CalendarX className="w-6 h-6" />
                  </div>
                  <p className="text-slate-600 font-medium">Aucune absence ou retard enregistré.</p>
                  <p className="text-sm text-slate-400 mt-1">Bravo pour cette assiduité !</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {absences.map((abs) => (
                    <div key={abs.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${abs.statut === 'absent' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                          {abs.statut === 'absent' ? 'A' : 'R'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 capitalize">{abs.statut}</p>
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <CalendarX className="w-3.5 h-3.5" />
                            {new Date(abs.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Heure</p>
                        <p className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {abs.heure ? abs.heure.substring(0, 5) : '--:--'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
