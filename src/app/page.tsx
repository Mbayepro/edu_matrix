import Link from 'next/link'
import { GraduationCap, ArrowRight, ShieldCheck, BarChart3, Users, QrCode } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans">
      {/* Navbar */}
      <nav className="border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-1.5 rounded-lg">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">EduMatrix</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Connexion
            </Link>
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              Espace Élève
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl mix-blend-screen" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl mix-blend-screen" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-emerald-400 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Nouvelle version 1.0 disponible
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent max-w-4xl mx-auto">
            La gestion scolaire réinventée pour le Sénégal.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Une plateforme tout-en-un pour simplifier la vie des directeurs, enseignants et élèves. Suivi des notes, présences par QR Code et paiements en temps réel.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="px-8 py-3.5 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              Commencer maintenant
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="#features" 
              className="px-8 py-3.5 text-base font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700"
            >
              En savoir plus
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-900/50 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6 text-blue-400" />}
              title="Suivi des performances"
              description="Visualisez les moyennes, classements et progressions des élèves avec des graphiques intuitifs et des rapports détaillés."
            />
            <FeatureCard 
              icon={<QrCode className="w-6 h-6 text-emerald-400" />}
              title="Présences Intelligentes"
              description="Fini l'appel papier. Scannez les cartes d'étudiants pour enregistrer les présences instantanément et notifier les parents."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6 text-purple-400" />}
              title="Sécurité & Confidentialité"
              description="Vos données sont chiffrées et protégées. Accès sécurisé par rôle pour garantir que chacun ne voit que ce qui le concerne."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <StatItem number="50+" label="Écoles partenaires" />
            <StatItem number="12k" label="Élèves inscrits" />
            <StatItem number="98%" label="Taux de satisfaction" />
            <StatItem number="24/7" label="Support technique" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-1.5 rounded-lg">
              <GraduationCap className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="font-semibold text-slate-300">EduMatrix</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} EduMatrix Sénégal. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:bg-slate-800/60 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4 border border-slate-700">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function StatItem({ number, label }: { number: string, label: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-bold text-white mb-1">{number}</div>
      <div className="text-sm text-emerald-500 font-medium uppercase tracking-wider">{label}</div>
    </div>
  )
}
