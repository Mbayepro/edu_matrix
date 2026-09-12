import { X, LayoutGrid, Users, Loader2, Check } from 'lucide-react'
import type { LocalFraisScolaire, LocalClasse } from '@/lib/db'

interface EleveBase {
  id: string
  classe_id: string
}

interface AssignFeeModalProps {
  isAssigning: boolean
  setIsAssigning: (val: boolean) => void
  assignFeeId: string
  setAssignFeeId: (val: string) => void
  assignClasseId: string
  setAssignClasseId: (val: string) => void
  frais: LocalFraisScolaire[]
  classes: LocalClasse[]
  eleves: EleveBase[]
  saving: boolean
  onPerformAssignment: () => void
}

export function AssignFeeModal({
  isAssigning,
  setIsAssigning,
  assignFeeId,
  setAssignFeeId,
  assignClasseId,
  setAssignClasseId,
  frais,
  classes,
  eleves,
  saving,
  onPerformAssignment
}: AssignFeeModalProps) {
  if (!isAssigning) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="premium-glass shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-10 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight leading-none">Affectation collective</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">Attribuer un frais à plusieurs élèves</p>
            </div>
            <button onClick={() => setIsAssigning(false)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type de Frais</label>
              <select
                value={assignFeeId}
                onChange={(e) => setAssignFeeId(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm font-black text-white focus:ring-4 focus:ring-emerald-500/10 focus:bg-white/10 transition-all appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">Choisir un frais…</option>
                {frais.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">{f.libelle} ({f.montant.toLocaleString('fr-FR')} F)</option>
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
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-900/20' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
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
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-900/20'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <option value="" className="bg-slate-900 text-white">Par classe…</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.nom_classe}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {assignFeeId && (
              <div className="bg-amber-500/10 p-6 rounded-3xl border border-amber-500/20 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-amber-400 shadow-sm shrink-0 border border-white/5">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-200">Estimation</p>
                  <p className="text-[10px] font-medium text-amber-400 mt-1 uppercase tracking-tight">
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
              className="flex-1 py-5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
            >
              Annuler
            </button>
            <button
              onClick={onPerformAssignment}
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
  )
}
