'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Users, BookOpen, ClipboardType, UserCheck, Edit3, ChevronRight, Loader2,
  Clock, Calendar, AlertCircle, ArrowRight, BookMarked, Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { getTodayDate } from '@/lib/dateUtils'

interface DashboardStats {
  nbClasses: number;
  nbEleves: number;
  devoirsEnAttente: number;
}

interface AffectationDetails {
  id: string;
  classe_id: string;
  matiere_id: string;
  classe: { id: string; nom_classe: string; niveau: string };
  matiere: { id: string; nom: string } | null;
  nbEleves?: number;
}

export default function ProfDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [affectations, setAffectations] = useState<AffectationDetails[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    nbClasses: 0,
    nbEleves: 0,
    devoirsEnAttente: 0,
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function getClassesForProf(profId: string) {
    const { data, error } = await supabase
      .from('enseignants_classes')
      .select(`
        id,
        classe_id,
        matiere_id,
        classe:classes(id, nom_classe, niveau),
        matiere:matieres(id, nom)
      `)
      .eq('enseignant_id', profId);

    if (error) {
      console.error("Erreur lors de la récupération des affectations:", error);
      return [];
    }
    return data as any[];
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await (supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single() as any);

      if (!prof) return;
      setProfile(prof);

      const affData = await getClassesForProf(prof.id);
      
      let totalEleves = 0;
      const enrichies = await Promise.all(
        affData.map(async (aff) => {
          const { count } = await supabase
            .from('eleves')
            .select('*', { count: 'exact', head: true })
            .eq('classe_id', aff.classe_id);
          
          totalEleves += count || 0;
          return { ...aff, nbEleves: count || 0 } as AffectationDetails;
        })
      );

      setAffectations(enrichies);
      setStats({
        nbClasses: enrichies.length,
        nbEleves: totalEleves,
        devoirsEnAttente: 3 // Simulation
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 absolute inset-0 m-auto" />
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      
      {/* ── Smart Hero Section ── */}
      <div className="relative overflow-hidden rounded-[3rem] bg-slate-950 p-8 md:p-12 text-white shadow-2xl shadow-emerald-900/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] -mr-48 -mt-48 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/10 rounded-full blur-[100px] -ml-32 -mb-32" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Espace Enseignant
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
              {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-300">{profile?.prenom}!</span>
            </h1>
            <p className="text-slate-400 font-medium max-w-md">
              Il est <span className="text-white">{currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>. Voici l&apos;aperçu de vos priorités pédagogiques pour aujourd&apos;hui.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
             <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 text-center group hover:bg-white/10 transition-all">
                <p className="text-3xl font-black text-emerald-400 mb-1">{stats.nbClasses}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Classes</p>
             </div>
             <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 text-center group hover:bg-white/10 transition-all">
                <p className="text-3xl font-black text-amber-400 mb-1">{stats.devoirsEnAttente}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">À Noter</p>
             </div>
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: My Classes (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between ml-2">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-3">
              <BookMarked className="w-5 h-5 text-emerald-600" />
              Mes Classes
            </h2>
            <Link href="/dashboard/classes" className="text-xs font-black text-emerald-600 uppercase tracking-widest hover:underline">
              Voir tout
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {affectations.map((aff) => (
              <div key={aff.id} className="group relative bg-white rounded-[2.5rem] border border-slate-200/60 p-8 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/5 transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-emerald-600 font-black text-xl border border-slate-100 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                      {aff.classe.nom_classe[0]}
                    </div>
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-600">{aff.nbEleves}</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {aff.classe.nom_classe}
                  </h3>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                    {aff.matiere?.nom || 'Enseignant Titulaire'}
                  </p>

                  <div className="mt-8 flex flex-col gap-3">
                    <Link href={`/dashboard/prof/session/${aff.classe_id}`} className="w-full">
                      <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Démarrer le cours
                      </button>
                    </Link>
                    <div className="grid grid-cols-2 gap-3">
                      <Link href={`/dashboard/presences?classeId=${aff.classe_id}`} className="flex-1">
                        <button className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                          <UserCheck className="w-3.5 h-3.5" />
                          Appel seul
                        </button>
                      </Link>
                      <Link href={`/dashboard/notes?classeId=${aff.classe_id}`} className="flex-1">
                        <button className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                          <Edit3 className="w-3.5 h-3.5" />
                          Notes
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Shortcuts & Quick Insights (1/3) */}
        <div className="space-y-8">
          
          {/* Quick Actions Panel */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-8 shadow-sm">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-6">Actions Rapides</h2>
            <div className="space-y-4">
              {[
                { label: 'Cahier de Textes', icon: ClipboardType, color: 'text-blue-400 bg-blue-500/10', href: '/dashboard/teacher/emargement' },
                { label: 'Saisie de Notes',  icon: Edit3,         color: 'text-emerald-600 bg-emerald-50', href: '/dashboard/notes' },
                { label: 'Mes Bulletins',    icon: BookOpen,      color: 'text-amber-600 bg-amber-50', href: '/dashboard/bulletins' },
                { label: 'Liste Élèves',     icon: Users,         color: 'text-violet-600 bg-violet-50', href: '/dashboard/eleves' },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="group flex items-center gap-4 p-4 rounded-[2rem] border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3 ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="flex-1 text-sm font-black text-slate-700 group-hover:text-slate-900 transition-colors">{item.label}</span>
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Today's Context Card */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-all" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                   <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Calendrier</p>
                   <p className="text-sm font-bold">{currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                 <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Rappel</p>
                 </div>
                 <p className="text-xs text-slate-300 leading-relaxed font-medium">
                   N&apos;oubliez pas de clôturer vos notes pour le 1er trimestre avant vendredi soir.
                 </p>
              </div>

              <button className="w-full py-4 bg-white/10 hover:bg-white text-white hover:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                 Voir mon planning
                 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
