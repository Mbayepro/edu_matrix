import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Activation du compte - EduMatrix',
}

export default function InscriptionReussie() {
  const whatsappUrl = "https://wa.me/221770362616?text=Bonjour,%20je%20viens%20de%20cr%C3%A9er%20un%20compte%20EduMatrix%20pour%20mon%20%C3%A9cole%20et%20je%20souhaite%20finaliser%20la%20configuration.";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-10 md:p-12 shadow-2xl animate-fade-in text-center">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full"></div>
            <div className="relative bg-emerald-500 p-5 rounded-3xl rotate-12 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-white -rotate-12" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl md:text-3xl font-bold text-white mb-6 leading-tight">
          Félicitations, votre école est inscrite sur EduMatrix ! 🎉
        </h1>

        <p className="text-slate-400 text-lg mb-10 leading-relaxed max-w-sm mx-auto">
          Pour des raisons de sécurité et pour finaliser la configuration de votre établissement, veuillez contacter notre équipe.
        </p>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-center gap-4 w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] shadow-xl shadow-emerald-900/30 text-xl"
        >
          <svg
            className="w-8 h-8 fill-current transition-transform group-hover:rotate-12"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          Activer mon compte sur WhatsApp
        </a>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-500 text-sm">
            EduMatrix &copy; {new Date().getFullYear()} - Système de gestion scolaire
          </p>
        </div>
      </div>
    </div>
  );
}
