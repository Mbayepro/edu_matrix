'use client'

// src/components/DashboardLayout.tsx
// Sidebar partagée pour toutes les pages du dashboard
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useProfile } from '@/hooks/useProfile'
import type { Profile, Ecole } from '@/lib/supabase'
import {
  GraduationCap, LayoutGrid, Users, BookOpen,
  TrendingUp, UserCheck, LogOut, Menu, X,
  Bell, ChevronRight, Settings, Calendar, FileText, BookMarked, UsersRound,
  ClipboardList, Wallet, Wifi, WifiOff, RefreshCw, Clock
} from 'lucide-react'
import { useNetwork } from '@/hooks/useNetwork'
import { ToastProvider } from '@/contexts/ToastContext'
import InstallButton from './InstallButton'
import QuickGuide from './QuickGuide'
import PremiumBackground from './PremiumBackground'

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
  { label: 'Cahier de Textes',    href: '/dashboard/teacher/emargement',    icon: ClipboardList, roles: ['teacher'] },
  { label: 'Cahier de Textes',    href: '/dashboard/emargements',            icon: ClipboardList, roles: ['director'] },
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
  { label: 'Caisse & Paiements',  href: '/dashboard/paiements',             icon: Wallet,        roles: ['superadmin', 'director'] },
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
  const router = useRouter()
  const { profile, ecole, loading } = useProfile()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Ferme sidebar sur changement de route (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function handleSignOut() {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error("Erreur lors de la déconnexion Supabase:", e)
    } finally {
      // Vider le localStorage
      localStorage.clear()
      
      // Vider IndexedDB
      if (typeof window !== 'undefined' && window.indexedDB) {
        try {
          await window.indexedDB.deleteDatabase('EduMatrixDB')
        } catch (e) {
          console.error("Erreur lors de la suppression de la base Dexie:", e)
        }
      }
      
      router.push('/login')
    }
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
             <span>{profile?.prenom} {profile?.nom}</span>
           </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -mr-64 -mt-64" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -ml-48 -mb-48" />
          
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-2 group">
              <Clock className="w-10 h-10 text-amber-500 group-hover:scale-110 transition-transform duration-500" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-black text-white tracking-tight">Compte en attente</h1>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Votre demande d&apos;adhésion est en cours d&apos;examen par les administrateurs d&apos;EduMatrix.
              </p>
            </div>

            <div className="p-5 bg-amber-500/5 rounded-2xl border border-amber-500/10 text-[11px] text-amber-200/70 font-bold uppercase tracking-widest leading-loose">
              Délai moyen de validation : <span className="text-amber-400">24h à 48h</span>
            </div>

            <div className="space-y-4 pt-4">
              <button 
                onClick={async () => {
                  window.location.reload(); // Hard refresh to force a full update from Supabase/Auth
                }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
              >
                Actualiser mon statut
              </button>
              
              <button 
                onClick={handleSignOut}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Déconnexion
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 pt-4">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">Vérification en temps réel</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Prevent ANY user from accessing a suspended school (except superadmin)
  if (profile?.role !== 'superadmin' && ecole?.statut === 'suspendu') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <header className="px-6 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="bg-red-500 p-2 rounded-xl shrink-0">
               <LogOut className="w-5 h-5 text-white" />
             </div>
             <p className="font-bold text-lg text-white">EduMatrix</p>
           </div>
           
           <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
             <span>{profile?.prenom} {profile?.nom}</span>
           </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[100px] -mr-64 -mt-64" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px] -ml-48 -mb-48" />
          
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <LogOut className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-black text-white tracking-tight">Accès Suspendu</h1>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                L'accès à la plateforme pour l'établissement <strong>{ecole.nom}</strong> a été temporairement suspendu par l'administration.
              </p>
            </div>

            <div className="p-5 bg-red-500/5 rounded-2xl border border-red-500/10 text-[11px] text-red-200/70 font-bold uppercase tracking-widest leading-loose">
              Veuillez contacter votre direction ou le support technique pour plus d'informations.
            </div>

            <div className="space-y-4 pt-4">
              <button 
                onClick={handleSignOut}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20 active:scale-95"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Chargement...</div>
  }

  const NetworkBadge = () => {
    const { isOnline, pendingCount, isSyncing } = useNetwork()
    return (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${
        isOnline 
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      }`}>
        <div className={`w-1 h-1 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
        {isOnline ? 'Connecté' : 'Hors-ligne'}
        {pendingCount > 0 && (
          <span className="ml-1 text-amber-400 flex items-center gap-0.5">
            ({pendingCount})
          </span>
        )}
        {isSyncing && <RefreshCw className="w-2 h-2 animate-spin ml-1" />}
      </div>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Logo Zone */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="bg-emerald-600 p-2.5 rounded-xl shrink-0 shadow-sm">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-lg text-white leading-none tracking-tight">EduMatrix</p>
          <div className="mt-1.5 flex items-center gap-2">
             <NetworkBadge />
          </div>
        </div>
      </div>

      {/* School badge */}
      {ecole && (
        <div className="mx-4 mb-4 bg-slate-800 rounded-xl px-4 py-3 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase font-bold mb-1">Localisation</p>
          <p className="text-sm text-slate-300 font-medium truncate flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
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
        <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-4 border border-slate-700">
          <div className="w-10 h-10 bg-emerald-600 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-white">
            {profile?.prenom?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {profile?.prenom}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              {roleLabel[profile?.role ?? ''] ?? profile?.role}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Déconnexion"
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-slate-950">
      <PremiumBackground />

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 fixed top-0 left-0 bottom-0 z-30 border-r border-slate-800">
        <SidebarContent />
      </aside>

      {/* ── Sidebar mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col z-50 shadow-2xl bg-slate-900">
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
        <header className="sticky top-0 z-20 bg-slate-900 px-4 lg:px-8 py-4 flex items-center gap-4 border-b border-slate-800 shadow-sm">
          <button
            className="lg:hidden p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
 
          {/* Page Title & Date */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white tracking-tight mb-1">
              {visibleNav.find(
                (n) => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
              )?.label ?? 'EduMatrix'}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400 font-medium hidden sm:block capitalize">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
 
          {/* Action icons */}
          <div className="flex items-center gap-2">
            <button className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-slate-800" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 bg-slate-950">
          <ToastProvider>
            {children}
            <QuickGuide />
          </ToastProvider>
        </main>
      </div>
    </div>
  )
}
