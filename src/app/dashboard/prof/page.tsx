'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Users, BookOpen, ClipboardType, UserCheck, Edit3, ChevronRight, Loader2
} from 'lucide-react'
import Link from 'next/link'

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

  useEffect(() => {
    loadDashboard();
  }, []);

  // ÉTAPE 2 : La fonction getClassesForProf(profId)
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

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!prof) return;
      setProfile(prof);

      // Récupération des classes affectées via la nouvelle fonction
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

      // Simulation pour "Devoirs en attente" (à connecter à vos vraies données d'évaluation)
      const devoirsAttente = 3; 

      setAffectations(enrichies);
      setStats({
        nbClasses: enrichies.length,
        nbEleves: totalEleves,
        devoirsEnAttente: devoirsAttente
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
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      
      {/* Header orienté Action */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
            Bonjour, {profile?.prenom} {profile?.nom}
          </h1>
          <p className="text-sm text-slate-500 font-medium max-w-2xl tracking-tight mt-2">
            Voici l'aperçu de vos classes et vos prochaines actions pédagogiques.
          </p>
        </div>
      </div>

      {/* ÉTAPE 3 : Cards de Statistiques Épurées */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex items-center gap-6 group hover:border-blue-200 transition-all">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
            <BookOpen className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Mes Classes</p>
            <p className="text-3xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{stats.nbClasses}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex items-center gap-6 group hover:border-emerald-200 transition-all">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
            <Users className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Mes Élèves</p>
            <p className="text-3xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{stats.nbEleves}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex items-center gap-6 group hover:border-amber-200 transition-all">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
            <ClipboardType className="w-6 h-6 text-amber-500 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Devoirs à Noter</p>
            <p className="text-3xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">{stats.devoirsEnAttente}</p>
          </div>
        </div>
      </div>

      {/* Section Principale : Liste structurée par Cartes */}
      <div>
        <h2 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-wider">Gérer Mes Classes</h2>
        
        {affectations.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-slate-200/60 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-lg font-bold text-slate-900">Aucune classe ne vous a été assignée.</p>
            <p className="text-sm text-slate-500 font-medium mt-2">Veuillez contacter la direction.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {affectations.map((aff) => (
              <div key={aff.id} className="bg-white rounded-[2rem] border border-slate-200/70 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 p-8 flex flex-col justify-between group">
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight">
                      {aff.classe.nom_classe}
                    </h3>
                    <p className="text-sm font-bold text-emerald-600 mt-1 uppercase tracking-wider">
                      {aff.matiere ? aff.matiere.nom : 'Généraliste'}
                    </p>
                  </div>
                  <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-600">{aff.nbEleves}</span>
                  </div>
                </div>

                {/* Call to Actions */}
                <div className="flex gap-3 mt-4">
                  <Link href={`/dashboard/notes?classeId=${aff.classe_id}`} className="flex-1">
                    <button className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 hover:shadow-emerald-600/30">
                      <Edit3 className="w-4 h-4" />
                      Saisir les notes
                    </button>
                  </Link>

                  <Link href={`/dashboard/eleves?classeId=${aff.classe_id}`} className="flex-1">
                    <button className="w-full py-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-black transition-all flex items-center justify-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Voir les élèves
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
