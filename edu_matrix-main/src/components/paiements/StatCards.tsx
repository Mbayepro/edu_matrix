import { Users, TrendingDown, TrendingUp, DollarSign } from 'lucide-react'

interface StatCardsProps {
  totalEleves: number
  totalRestant: number
  totalEncaisse: number
  tauxRecouvrement: number
  loading: boolean
}

export function StatCards({ totalEleves, totalRestant, totalEncaisse, tauxRecouvrement, loading }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="premium-glass p-6 group hover:border-emerald-500/30 transition-all duration-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:rotate-6 transition-all duration-500 border border-white/5">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total élèves</p>
            <div className="text-2xl font-black text-white leading-none">{totalEleves}</div>
          </div>
        </div>
      </div>

      <div className="premium-glass p-6 group hover:border-red-500/30 transition-all duration-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-rose-400 group-hover:rotate-6 transition-all duration-500 border border-white/5">
            <TrendingDown className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Reste à recouvrer</p>
            <div className="text-2xl font-black text-white leading-none">
              {loading ? '...' : totalRestant.toLocaleString('fr-FR')} <span className="text-[10px] font-black ml-1 uppercase text-slate-400">F</span>
            </div>
          </div>
        </div>
      </div>

      <div className="premium-glass p-6 group hover:border-emerald-500/30 transition-all duration-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:rotate-6 transition-all duration-500 border border-emerald-500/20">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Encaissé</p>
            <div className="text-2xl font-black text-emerald-400 leading-none">
              {loading ? '...' : totalEncaisse.toLocaleString('fr-FR')} <span className="text-[10px] font-black ml-1 uppercase opacity-60">F</span>
            </div>
          </div>
        </div>
      </div>

      <div className="premium-glass p-6 group hover:border-white/20 transition-all duration-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 bg-white/10 flex items-center justify-center text-white rounded-2xl group-hover:rotate-6 transition-all duration-500 border border-white/10">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Recouvrement</p>
            <div className="text-2xl font-black text-white leading-none">
              {tauxRecouvrement.toFixed(1)} <span className="text-[10px] font-black ml-1 uppercase text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
