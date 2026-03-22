"use client";

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(true); // Default to true hidden to prevent layout jank

  useEffect(() => {
    // Check if app is already installed natively
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
      
    setIsInstalled(isAppInstalled);

    // Capture the install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detection si l'utilisateur installe l'app sucessfully
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
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the EduMatrix PWA installation');
      setIsInstalled(true);
    } else {
      console.log('User dismissed the EduMatrix PWA installation');
    }
    
    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
  };

  if (isInstalled || !deferredPrompt) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-2 px-4 py-2 mt-4 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-all"
    >
      <Download className="w-4 h-4" />
      Installer l'Application
    </button>
  );
}
