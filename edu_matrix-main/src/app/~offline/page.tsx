"use client";

export default function FallbackOfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 text-center">
      <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-8 mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238L5.343 6.414M3 3l18 18" />
        </svg>
      </div>
      <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Vous êtes hors ligne</h1>
      <p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">
        EduMatrix a détecté que vous n'avez plus de connexion internet. L'application se mettra à jour et vos modifications seront envoyées automatiquement dès que le réseau reviendra.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-emerald-600 hover:bg-slate-900 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-emerald-600/20"
      >
        Réessayer la connexion
      </button>
    </div>
  )
}
