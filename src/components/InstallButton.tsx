'use client';

import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare } from 'lucide-react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // 1. Détecter iOS incluant iPadOS récent
    const isIOSDevice = (navigator.userAgent.match(/iPad|iPhone|iPod/g) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && 
                        !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 2. Vérifier si déjà installé
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsInstalled(isAppInstalled);
    setChecked(true);

    // 3. Capturer le prompt d'installation (Chrome/Android)
    // On vérifie d'abord si un prompt a déjà été capturé globalement
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e; // On le garde aussi en global
      console.log('✅ PWA Install Prompt Captured');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
    });

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      (window as any).deferredPrompt = null;
    }
    setDeferredPrompt(null);
  };

  if (!checked || isInstalled) return null;

  // Si on est sur iOS, on affiche une petite bulle d'aide car le bouton "Installer" ne peut pas fonctionner techniquement
  if (isIOS) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-lg border border-emerald-200 max-w-[220px] animate-in fade-in slide-in-from-bottom duration-500 ring-4 ring-emerald-500/10">
        <p className="text-[11px] font-black text-center text-slate-700 uppercase tracking-tight">
          Installer sur votre iPhone :
        </p>
        <div className="flex flex-col gap-1.5 w-full">
           <div className="flex items-center gap-2 text-[10px] bg-slate-50 px-2.5 py-2 rounded-xl border border-slate-100">
             <Share className="w-3.5 h-3.5 text-blue-600 shrink-0" />
             <span>Appuyez sur <span className="font-bold">Partager</span></span>
           </div>
           <div className="flex items-center gap-2 text-[10px] bg-slate-50 px-2.5 py-2 rounded-xl border border-slate-100">
             <PlusSquare className="w-3.5 h-3.5 shrink-0" />
             <span>Puis <span className="font-bold underline uppercase">&quot;Sur l&apos;écran d&apos;accueil&quot;</span></span>
           </div>
        </div>
      </div>
    );
  }

  // Pour Android/Chrome/Desktop
  if (!deferredPrompt) return null;

  return (
    <button
      id="pwa-install-btn"
      onClick={handleInstallClick}
      className="flex items-center gap-3 px-5 py-3.5 text-xs font-black rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-2xl shadow-emerald-600/40 transition-all duration-300 animate-bounce uppercase tracking-widest border-2 border-white/20"
    >
      <Download className="w-4 h-4" />
      Installer l&apos;App
    </button>
  );
}
