import Link from 'next/link'
import Image from 'next/image'
import { GraduationCap, ArrowRight, ShieldCheck, BarChart3, Users, QrCode, MapPin, Phone, Mail, CheckCircle, CreditCard, TrendingUp, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-gradient-to-tr from-emerald-600 to-emerald-400 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30 transition-transform group-hover:scale-105">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-black text-2xl tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">EduMatrix</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-10">
            {['À propos', 'Fonctionnalités', 'Contact'].map((item) => (
              <Link 
                key={item}
                href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "")}`} 
                className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-all relative group"
              >
                {item}
                <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-emerald-500 transition-all group-hover:w-full" />
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="hidden sm:block px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors"
            >
              Connexion
            </Link>
            <Link 
              href="/parent" 
              className="px-7 py-3.5 text-sm font-bold bg-slate-900 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-xl shadow-slate-900/10 hover:shadow-emerald-600/30 hover:-translate-y-0.5"
            >
              Espace Parent
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden bg-white">
        {/* Background gradients */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-100/50 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-amber-100/40 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-sm font-bold text-emerald-700 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                Le Futur de l'Éducation au Sénégal
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-[1.1]">
                La gestion scolaire <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-amber-500">
                  réinventée.
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed font-medium max-w-2xl mx-auto lg:mx-0">
                Une plateforme tout-en-un premium pour directeurs, enseignants et élèves. De l'appel par QR Code à l'édition automatique des bulletins, simplifiez votre quotidien.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <Link 
                  href="/login" 
                  className="px-8 py-4 text-base font-bold bg-slate-900 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-xl shadow-slate-900/20 hover:shadow-emerald-600/30 flex items-center gap-2 group w-full sm:w-auto justify-center hover:-translate-y-1"
                >
                  Commencer maintenant
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link 
                  href="#fonctionnalites" 
                  className="px-8 py-4 text-base font-bold bg-white text-slate-900 rounded-xl transition-all border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 w-full sm:w-auto justify-center flex items-center shadow-sm"
                >
                  Découvrir
                </Link>
              </div>
            </div>
            
            <div className="relative lg:h-[600px] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-amber-500/20 rounded-[3rem] transform rotate-3 scale-105 blur-2xl opacity-60"></div>
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200/50 bg-white">
                <Image 
                  src="/images/hero_dashboard.png" 
                  alt="Dashboard EduMatrix" 
                  width={800} 
                  height={600}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1: Bulletins */}
      <section id="fonctionnalites" className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-emerald-500/10 rounded-[2rem] transform -rotate-2 scale-105 blur-xl"></div>
              <Image 
                src="/images/report_cards.png" 
                alt="Bulletins de notes" 
                width={700} 
                height={500}
                className="relative rounded-[2rem] shadow-xl border border-white"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Suivi et Bulletins Automatisés</h2>
              <p className="text-lg text-slate-600 font-medium leading-relaxed">
                Fini les heures passées à calculer des moyennes. EduMatrix s'adapte au système sénégalais, calcule automatiquement les moyennes par coefficient et génère des bulletins PDF impeccables en un clic.
              </p>
              <ul className="space-y-4 pt-4">
                {['Moyennes semestrielles automatisées', 'Classements et courbes de progression', 'Export PDF instantané'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Attendance */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6">
                <QrCode className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Présences Intelligentes par QR Code</h2>
              <p className="text-lg text-slate-600 font-medium leading-relaxed">
                Rendez votre école futuriste. Chaque élève reçoit une carte d'identité avec QR Code. Au portail ou en classe, un simple scan enregistre la présence et peut même notifier parents et administration instantanément.
              </p>
              <ul className="space-y-4 pt-4">
                {['Pointage ultra-rapide par scan', 'Notification WhatsApp aux parents (Absences/Retards)', 'Génération des cartes élèves avec photo'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-amber-500 shrink-0" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/10 rounded-[2rem] transform rotate-2 scale-105 blur-xl"></div>
              <Image 
                src="/images/attendance_qr.png" 
                alt="Scan QR Code Présences" 
                width={700} 
                height={500}
                className="relative rounded-[2rem] shadow-xl border border-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Finance */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-emerald-600/10 rounded-[2rem] transform -rotate-2 scale-105 blur-xl"></div>
              <Image 
                src="/images/financial_management.png" 
                alt="Gestion Financière" 
                width={700} 
                height={500}
                className="relative rounded-[2rem] shadow-xl border border-white"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
                <CreditCard className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Suivi Financier Simplifié</h2>
              <p className="text-lg text-slate-600 font-medium leading-relaxed">
                Gérez la scolarité et les frais divers avec une clarté absolue. Tableaux de bord financiers interactifs, suivi des impayés et édition automatique des reçus.
              </p>
              <ul className="space-y-4 pt-4">
                {['Historique des paiements par élève', 'Alerte pour les mensualités en retard', 'Impression immédiate des reçus'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-slate-900 text-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-800">
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-black text-emerald-400 mb-2">500+</div>
              <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Élèves gérés</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-black text-amber-400 mb-2">20+</div>
              <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Écoles</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-black text-emerald-400 mb-2">100%</div>
              <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Sécurisé</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-black text-amber-400 mb-2">24/7</div>
              <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-emerald-600 to-emerald-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]"></div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Prêt à digitaliser votre école ?</h2>
          <p className="text-xl text-emerald-100 mb-10 font-medium">Rejoignez le mouvement de l'excellence éducative au Sénégal.</p>
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 px-10 py-5 text-lg font-black bg-white text-emerald-700 rounded-xl transition-all hover:bg-slate-50 hover:scale-105 shadow-2xl"
          >
            Créer mon espace école
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-950 pt-20 pb-10 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-600 p-2 rounded-xl">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="font-black text-2xl tracking-tight text-white">EduMatrix</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-medium">
                La plateforme incontournable de gestion scolaire au Sénégal. Alliant innovation technologique et respect des normes éducatives locales.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6">Liens Rapides</h4>
              <ul className="space-y-4 text-sm font-medium">
                <li><Link href="#" className="text-slate-400 hover:text-emerald-400 transition-colors">Accueil</Link></li>
                <li><Link href="#fonctionnalites" className="text-slate-400 hover:text-emerald-400 transition-colors">Fonctionnalités</Link></li>
                <li><Link href="/login" className="text-slate-400 hover:text-emerald-400 transition-colors">Se connecter</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Contact</h4>
              <ul className="space-y-4 text-sm font-medium text-slate-400">
                <li className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-emerald-400" /> Dakar yeumbeul/ASECNA
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-emerald-400" /> 770362616 / 774628987
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-emerald-400" /> edumatrix445@gmail.com
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500">
            <p>© {new Date().getFullYear()} EduMatrix Sénégal. Tous droits réservés.</p>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-white transition-colors">Confidentialité</Link>
              <Link href="#" className="hover:text-white transition-colors">CGU</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
