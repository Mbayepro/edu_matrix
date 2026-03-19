import Link from 'next/link'
import { GraduationCap, ArrowRight, ShieldCheck, BarChart3, Users, QrCode, MapPin, Phone, Mail, CheckCircle, Info, CreditCard, TrendingUp } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-600/20 transition-transform group-hover:scale-105">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">EduMatrix</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-10">
            {['À propos', 'Fonctionnalités', 'Contact'].map((item) => (
              <Link 
                key={item}
                href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "")}`} 
                className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 hover:text-emerald-600 transition-all relative group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-400 transition-all group-hover:w-full" />
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="hidden sm:block px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-emerald-600 transition-colors"
            >
              Connexion
            </Link>
            <Link 
              href="/login" 
              className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-slate-900 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-xl shadow-slate-900/10 hover:shadow-emerald-600/20"
            >
              Espace Élève
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-amber-400 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Nouvelle version 1.0 disponible
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-slate-900 max-w-4xl mx-auto">
            La gestion scolaire réinventée pour le Sénégal.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Une plateforme tout-en-un pour simplifier la vie des directeurs, enseignants et élèves. Suivi des notes, présences par QR Code et paiements en temps réel.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="px-8 py-3.5 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              Commencer maintenant
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </Link>
            <Link 
              href="#about" 
              className="px-8 py-3.5 text-base font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl transition-all border border-slate-200"
            >
              Découvrir la solution
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 border-t border-slate-100 bg-emerald-50/30 relative overflow-hidden">
        {/* Abstract background shape */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-amber-400/5 -skew-x-12 translate-x-1/2 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="aspect-square bg-white rounded-3xl border border-slate-200 shadow-2xl flex items-center justify-center p-12 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-4 bg-white/90 backdrop-blur p-4 rounded-2xl border border-slate-100 shadow-sm transition-transform hover:translate-x-2">
                    <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-slate-700">Digitalisation complète du cycle scolaire</p>
                  </div>
                  <div className="flex items-center gap-4 bg-white/90 backdrop-blur p-4 rounded-2xl border border-slate-100 shadow-sm ml-8 transition-transform hover:translate-x-2">
                    <CheckCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-slate-700">Adapté aux échelles de notes du Sénégal</p>
                  </div>
                  <div className="flex items-center gap-4 bg-white/90 backdrop-blur p-4 rounded-2xl border border-slate-100 shadow-sm transition-transform hover:translate-x-2">
                    <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                    <p className="text-sm font-bold text-slate-700">Automatisation des bulletins de notes</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">À propos d&apos;EduMatrix</h2>
              <p className="text-slate-600 leading-relaxed text-lg font-medium">
                EduMatrix est née de la volonté de moderniser le système éducatif sénégalais. Notre mission est d&apos;offrir aux établissements scolaires des outils technologiques de pointe pour optimiser leur gestion quotidienne.
              </p>
              <p className="text-slate-600 leading-relaxed">
                De la maternelle au lycée, notre plateforme s&apos;adapte aux spécificités locales, notamment les calculs de moyennes complexes et les exigences administratives des inspections d&apos;académie.
              </p>
              <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:bg-emerald-50">
                  <div className="text-2xl font-black text-emerald-600 mb-1">Simple</div>
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Prise en main immédiate</div>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all hover:bg-amber-50">
                  <div className="text-2xl font-black text-amber-500 mb-1">Local</div>
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Conçu à Dakar</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50 relative overflow-hidden">
        {/* Simple grid pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
             style={{ backgroundImage: `radial-gradient(#065f46 1px, transparent 1px)`, backgroundSize: '30px 30px' }} />

        <div className="max-w-7xl mx-auto px-6 text-center mb-16 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-4">
            Services
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Explorez nos solutions</h2>
          <p className="text-slate-600 max-w-2xl mx-auto font-medium">Tout ce dont vous avez besoin pour gérer votre établissement avec excellence.</p>
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6 text-amber-400" />}
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
              icon={<GraduationCap className="w-6 h-6 text-emerald-400" />}
              title="Bulletins Automatisés"
              description="Générez des bulletins de notes conformes aux normes sénégalaises en quelques secondes pour toute l'école."
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6 text-amber-400" />}
              title="Espace Enseignants"
              description="Un outil dédié pour simplifier la saisie des notes, la gestion des cours et l'organisation du temps scolaire."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
              title="Sécurité & Confidentialité"
              description="Vos données sont chiffrées et protégées. Accès sécurisé par rôle pour garantir que chacun ne voit que ce qui le concerne."
            />
          </div>
        </div>
      </section>

      {/* Subtle Stats Bar */}
      <section className="py-12 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 leading-none mb-1">500+</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Élèves inscrits</div>
              </div>
            </div>

            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 transition-transform group-hover:scale-110">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 leading-none mb-1">20+</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Écoles partenaires</div>
              </div>
            </div>

            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 leading-none mb-1">98%</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Satisfaction</div>
              </div>
            </div>

            <div className="flex items-center gap-4 group cursor-default">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 transition-transform group-hover:scale-110">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-slate-900 leading-none mb-1">24/7</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Support local</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="contact" className="bg-slate-900 pt-20 pb-10 relative overflow-hidden">
        {/* Abstract shapes in footer */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400/5 rounded-full blur-[80px] -ml-32 -mb-32" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 mb-16">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-emerald-600 p-2 rounded-2xl shadow-lg shadow-emerald-600/20">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="font-black text-2xl tracking-tight text-white">EduMatrix</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium">
                Le leader de la gestion scolaire digitale au Sénégal. Une solution robuste et innovante pour les établissements d&apos;excellence.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-black mb-8 uppercase tracking-widest text-[10px]">Navigation</h4>
              <ul className="space-y-5 text-sm">
                <li><Link href="#" className="text-slate-400 hover:text-amber-400 transition-colors">Accueil</Link></li>
                <li><Link href="#about" className="text-slate-400 hover:text-amber-400 transition-colors">À propos</Link></li>
                <li><Link href="#features" className="text-slate-400 hover:text-amber-400 transition-colors">Fonctionnalités</Link></li>
                <li><Link href="/login" className="text-slate-400 hover:text-amber-400 transition-colors">Espace réservé</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-black mb-8 uppercase tracking-widest text-[10px]">Contact</h4>
              <ul className="space-y-5 text-sm text-slate-400 font-medium">
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span>Dakar yeumbeul/ASECNA</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-amber-400" />
                  </div>
                  <span>770362616 / 774628987</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-emerald-400" />
                  </div>
                  <Link href="mailto:edumatrix445@gmail.com" className="hover:text-amber-400 transition-colors">
                    edumatrix445@gmail.com
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-10 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} EduMatrix Sénégal. Tous droits réservés.
            </p>
            <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <Link href="#" className="hover:text-white transition-colors">Confidentialité</Link>
              <Link href="#" className="hover:text-white transition-colors">CGU</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-[2rem] bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 group relative overflow-hidden">
      {/* Subtle background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-amber-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 transition-transform duration-500 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white">
          {icon}
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{title}</h3>
        <p className="text-slate-500 leading-relaxed font-medium">{description}</p>
      </div>
    </div>
  )
}
