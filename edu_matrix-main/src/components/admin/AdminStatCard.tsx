import { LucideIcon } from 'lucide-react'

interface AdminStatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  href?: string
}

export default function AdminStatCard({ icon, label, value, href }: AdminStatCardProps) {
  const Card = href ? 'a' : 'div'
  
  return (
    <Card
      href={href}
      className="bg-slate-900 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors">
          {icon}
        </div>
        <div>
          <p className="text-3xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-400 mt-1">{label}</p>
        </div>
      </div>
    </Card>
  )
}
