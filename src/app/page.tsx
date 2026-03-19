import Link from 'next/link'
import { GraduationCap, ArrowRight, ShieldCheck, BarChart3, Users, QrCode, MapPin, Phone, Mail, CheckCircle, Info, CreditCard, TrendingUp, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative">
      {/* Global Background Ornaments */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-[20%] -left-[10%] w-[500px] h-[500px] bg-emerald-200 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] -right-[5%] w-[400px] h-[400px] bg-amber-200 rounded-full blur-[100px]" />
      </div>
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
      <section className="relative pt-20 pb-32 overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-amber-400">
        {/* Decorative Mesh / Bubbles */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-20 right-20 w-full h-full bg-emerald-900/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest text-white mb-8 animate-fade-in backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Nouvelle version 1.0 disponible
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 text-white max-w-5xl mx-auto drop-shadow-2xl">
            La gestion scolaire <span className="text-slate-900">réinventée</span> pour le Sénégal.
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-12 leading-relaxed font-medium drop-shadow-lg">
            Une plateforme tout-en-un pour simplifier la vie des directeurs, enseignants et élèves. Suivi des notes, présences par QR Code et paiements en temps réel.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link 
              href="/login" 
              className="px-10 py-4.5 text-lg font-black bg-slate-900 hover:bg-emerald-900 text-white rounded-2xl transition-all shadow-2xl shadow-black/20 flex items-center gap-3 group"
            >
              Commencer maintenant
              <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="#about" 
              className="px-10 py-4.5 text-lg font-black bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all border border-white/30 backdrop-blur-md"
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
      <footer id="contact" className="bg-slate-950 pt-20 pb-10 relative overflow-hidden">
        {/* Artistic Background blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] -ml-48 -mb-48" />
        
        <div className="absolute inset-0 opacity-[0.02]"
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />

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
    <div className="p-10 rounded-[2.5rem] bg-white border border-slate-100/80 hover:border-emerald-200 hover:shadow-[0_20px_50px_-15px_rgba(16,185,129,0.15)] transition-all duration-500 group relative overflow-hidden flex flex-col items-start text-left">
      {/* Dynamic background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10 w-full">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-500/20">
          {icon}
        </div>
        <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight group-hover:text-emerald-700 transition-colors">{title}</h3>
        <p className="text-slate-500 leading-relaxed font-medium group-hover:text-slate-600 transition-colors">{description}</p>
        
        <div className="mt-8 pt-6 border-t border-slate-100 w-full flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="w-5 h-5 text-emerald-400" />
        </div>
      </div>
    </div>
  )
}
