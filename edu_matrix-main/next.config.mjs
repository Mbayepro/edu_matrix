/** @type {import('next').NextConfig} */
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: false,
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  // On gère nous-mêmes le retour en ligne via useNetwork + flushSyncQueue
  reloadOnOnline: false,
  // Page affichée si la navigation SPA échoue sans réseau
  fallbacks: {
    document: '/offline.html',
  },
  workboxOptions: {
    runtimeCaching: [
      // Assets Next.js statiques — CacheFirst (immuables car hashés)
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static-assets',
          expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // Images et médias Supabase Storage — CacheFirst 7 jours
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'supabase-storage',
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      // Polices Google Fonts
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      // Pages du dashboard — NetworkFirst (fraîcheur prioritaire, fallback cache)
      {
        urlPattern: /^https?:\/\/.*\/dashboard\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'dashboard-pages',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
    ],
  },
})

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
}

export default withPWA(nextConfig)

