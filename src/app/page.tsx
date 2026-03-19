import Link from 'next/link'
import { GraduationCap, ArrowRight, ShieldCheck, BarChart3, Users, QrCode, MapPin, Phone, Mail, CheckCircle, Info, CreditCard } from 'lucide-react'

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
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link href="#about" className="hover:text-white transition-colors">À propos</Link>
            <Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link>
            <Link href="#contact" className="hover:text-white transition-colors">Contact</Link>
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
              href="#about" 
              className="px-8 py-3.5 text-base font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700"
            >
              Découvrir la solution
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-3xl border border-slate-800 flex items-center justify-center p-12">
                <Info className="w-full h-full text-emerald-500/10 absolute top-0 left-0 -z-10" />
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-slate-800/80 backdrop-blur p-4 rounded-2xl border border-slate-700 shadow-xl">
                    <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <p className="text-sm font-medium">Digitalisation complète du cycle scolaire</p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-800/80 backdrop-blur p-4 rounded-2xl border border-slate-700 shadow-xl ml-8">
                    <CheckCircle className="w-6 h-6 text-blue-400 flex-shrink-0" />
                    <p className="text-sm font-medium">Adapté aux échelles de notes du Sénégal</p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-800/80 backdrop-blur p-4 rounded-2xl border border-slate-700 shadow-xl">
                    <CheckCircle className="w-6 h-6 text-purple-400 flex-shrink-0" />
                    <p className="text-sm font-medium">Automatisation des bulletins de notes</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-white tracking-tight">À propos d&apos;EduMatrix</h2>
              <p className="text-slate-400 leading-relaxed text-lg">
                EduMatrix est née de la volonté de moderniser le système éducatif sénégalais. Notre mission est d&apos;offrir aux établissements scolaires des outils technologiques de pointe pour optimiser leur gestion quotidienne.
              </p>
              <p className="text-slate-400 leading-relaxed">
                De la maternelle au lycée, notre plateforme s&apos;adapte aux spécificités locales, notamment les calculs de moyennes complexes et les exigences administratives des inspections d&apos;académie.
              </p>
              <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  <div className="text-2xl font-bold text-white mb-1">Simple</div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Prise en main immédiate</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  <div className="text-2xl font-bold text-white mb-1">Local</div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Conçu à Dakar</div>
                </div>
              </div>
            </div>
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
              icon={<CreditCard className="w-6 h-6 text-amber-400" />}
              title="Gestion des Paiements"
              description="Suivez les frais de scolarité, gérez les impayés et générez des reçus professionnels en un clic."
            />
            <FeatureCard 
              icon={<GraduationCap className="w-6 h-6 text-indigo-400" />}
              title="Bulletins Automatisés"
              description="Générez des bulletins de notes conformes aux normes sénégalaises en quelques secondes pour toute l'école."
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6 text-pink-400" />}
              title="Espace Enseignants"
              description="Un outil dédié pour simplifier la saisie des notes, la gestion des cours et l'organisation du temps scolaire."
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

      {/* Footer / Contact */}
      <footer id="contact" className="border-t border-slate-800 bg-slate-950 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="bg-emerald-500 p-1.5 rounded-lg">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white">EduMatrix</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Le leader de la gestion scolaire digitale au Sénégal. Une solution robuste pour les établissements d&apos;excellence.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-xs">Navigation</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><Link href="#" className="hover:text-emerald-400 transition-colors">Accueil</Link></li>
                <li><Link href="#about" className="hover:text-emerald-400 transition-colors">À propos</Link></li>
                <li><Link href="#features" className="hover:text-emerald-400 transition-colors">Fonctionnalités</Link></li>
                <li><Link href="/login" className="hover:text-emerald-400 transition-colors">Espace réservé</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-6 uppercase tracking-wider text-xs">Contact</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Dakar yeumbeul/ASECNA</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>770362616 / 774628987</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-emerald-500 shrink-0" />
                  <Link href="mailto:edumatrix445@gmail.com" className="hover:text-emerald-400 transition-colors">
                    edumatrix445@gmail.com
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-800/60 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-xs">
              © {new Date().getFullYear()} EduMatrix Sénégal. Tous droits réservés.
            </p>
            <div className="flex gap-6 text-xs text-slate-500">
              <Link href="#" className="hover:text-white">Confidentialité</Link>
              <Link href="#" className="hover:text-white">CGU</Link>
            </div>
          </div>
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
