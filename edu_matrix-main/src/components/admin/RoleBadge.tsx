interface RoleBadgeProps {
  role: 'superadmin' | 'director' | 'teacher'
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const styles = {
    superadmin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    director: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    teacher: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }

  const labels = {
    superadmin: 'Super Admin',
    director: 'Directeur',
    teacher: 'Enseignant',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[role] || styles.teacher}`}>
      {labels[role] || role}
    </span>
  )
}
