"use client";

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  // Démarrer à false (inconnu), l'état réel sera calculé dans useEffect
  const [isInstalled, setIsInstalled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée (mode standalone)
    const isAppInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsInstalled(isAppInstalled);
    setChecked(true);

    // Capturer l'événement d'installation
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Détecter si l'utilisateur installe l'app avec succès
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
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

  // Ne pas afficher tant que le check hydration n'est pas fait
  // ou si l'app est déjà installée, ou s'il n'y a pas de prompt disponible
  if (!checked || isInstalled || !deferredPrompt) return null;

  return (
    <button
      id="pwa-install-btn"
      onClick={handleInstallClick}
      className="flex items-center gap-2 px-4 py-3 text-sm font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xl shadow-emerald-600/30 transition-all duration-200 animate-bounce"
      aria-label="Installer l'application EduMatrix"
    >
      <Download className="w-4 h-4" />
      Installer l'App
    </button>
  );
}
