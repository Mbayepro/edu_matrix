'use client';

import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare } from 'lucide-react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // 1. Détecter iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 2. Vérifier si déjà installé
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsInstalled(isAppInstalled);
    setChecked(true);

    // 3. Capturer le prompt d'installation (Chrome/Android)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('✅ PWA Install Prompt Captured');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
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

  if (!checked || isInstalled) return null;

  // Si on est sur iOS, on affiche une petite bulle d'aide car le bouton "Installer" ne peut pas fonctionner techniquement
  if (isIOS) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-2xl border border-emerald-100 max-w-[200px] animate-in fade-in slide-in-from-bottom duration-500">
        <p className="text-[10px] font-bold text-center text-slate-600">
          Pour installer l&apos;application sur iPhone :
        </p>
        <div className="flex items-center gap-2 text-[10px] bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
           Appuyez sur <Share className="w-3 h-3 text-blue-600" /> puis sur <PlusSquare className="w-3 h-3" /> <span className="font-black underline">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
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
