// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s · EduMatrix',
    default:  'EduMatrix — Gestion scolaire',
  },
  description: 'Plateforme de gestion scolaire moderne pour les établissements du Sénégal.',
  manifest: '/manifest.json',
  icons: { 
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png'
  },
  appleWebApp: {
    statusBarStyle: 'default',
    title: 'EduMatrix',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
  }
}

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#059669',
}

import InstallButton from '../components/InstallButton'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${outfit.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
          });
        `}} />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        {children}
        <div className="fixed bottom-6 right-6 z-50">
          <InstallButton />
        </div>
      </body>
    </html>
  )
}
