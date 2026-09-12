'use client';

import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

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

    // 3. Capturer le prompt d'installation (Chrome/Android/Desktop)
    // Vérifier si le prompt a déjà été capturé par le script dans le layout
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      console.log('✅ PWA Install Prompt Restored from window');
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e; // On le garde aussi de manière globale
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
    }
    setDeferredPrompt(null);
  };

  if (!checked || isInstalled || !isVisible) return null;

  // Si on est sur iOS, on affiche une petite bulle d'aide
  if (isIOS) {
    return (
      <div className="relative mx-3 mb-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm animate-in fade-in slide-in-from-bottom duration-500">
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 p-1 text-emerald-400 hover:text-emerald-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-tight mb-2">
          Installer EduMatrix
        </p>
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-2 text-[10px] text-emerald-700">
             <Share className="w-3.5 h-3.5 shrink-0" />
             <span>Appuyez sur <span className="font-bold">Partager</span></span>
           </div>
           <div className="flex items-center gap-2 text-[10px] text-emerald-700">
             <PlusSquare className="w-3.5 h-3.5 shrink-0" />
             <span>Puis <span className="font-bold underline">&quot;Sur l&apos;écran d&apos;accueil&quot;</span></span>
           </div>
        </div>
      </div>
    );
  }

  // Pour Android/Chrome/Desktop
  if (!deferredPrompt) return null;

  return (
    <div className="px-3 mb-6">
      <button
        id="pwa-install-btn"
        onClick={handleInstallClick}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 transition-all duration-200 shadow-sm group active:scale-[0.98]"
      >
        <Download className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
        <span>Installer EduMatrix</span>
      </button>
    </div>
  );
}
