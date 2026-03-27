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
  Bell, ChevronRight, Settings, Calendar, FileText, BookMarked, UsersRound,
} from 'lucide-react'
import { ToastProvider } from '@/contexts/ToastContext'
import InstallButton from './InstallButton'

interface NavItem {
  label:    string
  href:     string
  icon:     React.ElementType
  roles:    ('superadmin' | 'director' | 'teacher')[]
  badge?:   number
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Vue Globale',         href: '/dashboard/superadmin',            icon: LayoutGrid,    roles: ['superadmin'] },
  { label: 'Tableau de bord',     href: '/dashboard',                       icon: LayoutGrid,    roles: ['director'] },
  { label: 'Mon tableau de bord', href: '/dashboard/teacher',               icon: LayoutGrid,    roles: ['teacher'] },
  { label: 'Validation',          href: '/dashboard/admin/validation',      icon: BookOpen,      roles: ['superadmin'] },
  { label: 'Toutes les écoles',   href: '/dashboard/admin/ecoles',          icon: LayoutGrid,    roles: ['superadmin'] },
  { label: 'Classes',             href: '/dashboard/classes',               icon: BookOpen,      roles: ['director', 'superadmin'] },
  { label: 'Matières',            href: '/dashboard/matieres',              icon: BookMarked,    roles: ['director', 'superadmin'] },
  { label: 'Enseignants',         href: '/dashboard/enseignants',           icon: GraduationCap, roles: ['director', 'superadmin'] },
  { label: 'Emploi du temps',     href: '/dashboard/admin/emploi-du-temps', icon: Calendar,      roles: ['director'] },
  { label: 'Élèves',              href: '/dashboard/eleves',                icon: Users,         roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Notes',               href: '/dashboard/notes',                 icon: TrendingUp,    roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Bulletins',           href: '/dashboard/bulletins',             icon: FileText,      roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Conseil de Classe',   href: '/dashboard/conseil-classe',        icon: UsersRound,    roles: ['superadmin', 'director'] },
  { label: 'Présences',           href: '/dashboard/presences',             icon: UserCheck,     roles: ['superadmin', 'director', 'teacher'] },
  { label: 'Paiements',           href: '/dashboard/paiements',             icon: TrendingUp,    roles: ['superadmin', 'director'] },
  { label: 'Paramètres',          href: '/dashboard/parametres',            icon: Settings,      roles: ['superadmin', 'director'] },
]

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative
        ${active
          ? 'bg-emerald-600/10 text-emerald-400 font-semibold border-l-4 border-amber-400 pl-2'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
        }`}
    >
      <item.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-amber-400' : 'group-hover:text-emerald-400'}`} />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="bg-amber-500 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
          {item.badge}
        </span>
      ) : null}
      {active && <div className="absolute inset-y-2 right-2 w-1.5 h-1.5 bg-amber-400 rounded-full blur-[2px] animate-pulse" />}
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
      {/* Logo Zone */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-2.5 rounded-2xl shrink-0 shadow-lg shadow-emerald-500/20">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-lg text-white leading-none tracking-tight">EduMatrix</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest truncate">
              {ecole?.nom ?? 'Chargement…'}
            </p>
          </div>
        </div>
      </div>

      {/* School badge */}
      {ecole && (
        <div className="mx-4 mb-4 bg-emerald-500/5 rounded-2xl px-4 py-3 border border-emerald-500/10">
          <p className="text-[9px] text-emerald-500/60 uppercase font-black tracking-widest mb-1">Localisation</p>
          <p className="text-xs text-slate-300 font-medium truncate flex items-center gap-2">
            <span className="w-1 h-1 bg-amber-400 rounded-full" />
            {ecole.ville}
          </p>
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

      {/* PWA Install Button */}
      <InstallButton />

      {/* User zone */}
      <div className="px-4 pb-6 mt-auto">
        <div className="flex items-center gap-3 bg-slate-800/40 rounded-2xl px-4 py-4 border border-slate-700/30 backdrop-blur-sm">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-amber-400 rounded-full p-[2px] shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-sm font-black text-white">
              {profile?.prenom?.[0]?.toUpperCase() ?? '?'}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {profile?.prenom}
            </p>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-tighter">
              {roleLabel[profile?.role ?? ''] ?? profile?.role}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Déconnexion"
            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex relative overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>

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
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 lg:px-8 py-4 flex items-center gap-4">
          <button
            className="lg:hidden p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-all duration-200"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
 
          {/* Page Title & Date */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">
              {visibleNav.find(
                (n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
              )?.label ?? 'EduMatrix'}
            </h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
 
          {/* Action icons */}
          <div className="flex items-center gap-2">
            <button className="relative p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-all group">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-amber-500 rounded-full border-2 border-white animate-bounce" />
            </button>
          </div>
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
