'use client'

// src/components/DashboardLayout.tsx
// Sidebar partagée pour toutes les pages du dashboard
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import type { Profile, Ecole } from '@/lib/supabase'
import {
  GraduationCap, LayoutGrid, Users, BookOpen,
  TrendingUp, UserCheck, LogOut, Menu, X,
  Bell, ChevronRight, Settings, Calendar, FileText,
} from 'lucide-react'
import { ToastProvider } from '@/contexts/ToastContext'

interface NavItem {
  label:    string
  href:     string
  icon:     React.ElementType
  roles:    ('superadmin' | 'director' | 'teacher')[]
  badge?:   number
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Vue Globale',       href: '/dashboard/superadmin',            icon: LayoutGrid,    roles: ['superadmin'] },
  { label: 'Tableau de bord',   href: '/dashboard',                       icon: LayoutGrid,    roles: ['director'] },
  { label: 'Validation',        href: '/dashboard/admin/validation',      icon: BookOpen,      roles: ['superadmin'] },
  { label: 'Toutes les écoles', href: '/dashboard/admin/ecoles',          icon: LayoutGrid,    roles: ['superadmin'] },
  { label: 'Classes',           href: '/dashboard/classes',               icon: BookOpen,      roles: ['director', 'superadmin'] },
  { label: 'Mes classes',       href: '/dashboard/teacher',               icon: BookOpen,      roles: ['teacher'] },
  { label: 'Enseignants',       href: '/dashboard/admin/enseignants',     icon: GraduationCap, roles: ['director'] },
  { label: 'Emploi du temps',   href: '/dashboard/admin/emploi-du-temps', icon: Calendar,      roles: ['director'] },
  { label: 'Élèves',            href: '/dashboard/eleves',                icon: Users,         roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Notes',             href: '/dashboard/notes',                 icon: TrendingUp,    roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Bulletins',         href: '/dashboard/bulletins',             icon: FileText,      roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Présences',         href: '/dashboard/presences',             icon: UserCheck,     roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Paiements',         href: '/dashboard/paiements',             icon: TrendingUp,    roles: ['superadmin', 'director'] },
  { label: 'Paramètres',        href: '/dashboard/parametres',            icon: Settings,      roles: ['superadmin', 'director'] },
]

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group
        ${active
          ? 'bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-900/30'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
          {item.badge}
        </span>
      ) : null}
      {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, ecole, loading } = useProfile()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Ferme sidebar sur changement de route (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!profile?.role) return false
    return item.roles.includes(profile.role as any)
  })

  const roleLabel: Record<string, string> = {
    superadmin: 'Super Admin',
    director:   'Directeur',
    teacher:    'Enseignant',
  }

  // Prevent pending directors from using the nav
  if (profile?.role === 'director' && ecole?.statut === 'en_attente') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Simplified header for pending wall */}
        <header className="px-6 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="bg-emerald-500 p-2 rounded-xl shrink-0">
               <GraduationCap className="w-5 h-5 text-white" />
             </div>
             <p className="font-bold text-lg text-white">EduMatrix</p>
           </div>
           
           <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
             <span>{profile.prenom} {profile.nom}</span>
           </div>
        </header>

        <main className="flex-1">
          <ToastProvider>
            {children}
          </ToastProvider>
        </main>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Chargement...</div>
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="bg-emerald-500 p-2 rounded-xl shrink-0">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-white leading-none">EduMatrix</p>
          <p className="text-slate-400 text-xs mt-0.5 truncate">
            {ecole?.nom ?? 'Chargement…'}
          </p>
        </div>
      </div>

      {/* School badge */}
      {ecole && (
        <div className="mx-3 mt-3 bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-700/40">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">École</p>
          <p className="text-xs text-slate-300 font-medium truncate mt-0.5">{ecole.ville}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
            onClick={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

      {/* User zone */}
      <div className="px-3 pb-4 border-t border-slate-700/50 pt-3">
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-3 py-2.5 border border-slate-700/30">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0">
            {profile?.prenom?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {profile?.prenom} {profile?.nom}
            </p>
            <p className="text-[10px] text-slate-400">
              {roleLabel[profile?.role ?? ''] ?? profile?.role}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Déconnexion"
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 shrink-0 fixed top-0 left-0 bottom-0 z-30">
        <SidebarContent />
      </aside>

      {/* ── Sidebar mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 flex flex-col z-50 shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3">
          <button
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          {/* Breadcrumb-style title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {visibleNav.find(
                (n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
              )?.label ?? 'EduMatrix'}
            </p>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Notif bell */}
          <button className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 animate-fade-in">
          <ToastProvider>
            {children}
          </ToastProvider>
        </main>
      </div>
    </div>
  )
}
