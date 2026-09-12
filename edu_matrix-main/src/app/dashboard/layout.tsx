// src/app/dashboard/layout.tsx
import DashboardLayout   from '@/components/DashboardLayout'
import OfflineBanner     from '@/components/OfflineBanner'
import NetworkStatus     from '@/components/NetworkStatus'
import SyncInitializer   from '@/components/SyncInitializer'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {/* Badge réseau discret en haut + synchronisation initiale en arrière-plan */}
      <NetworkStatus />
      <SyncInitializer />
      {children}
      {/* Bannière existante conservée en bas (rétrocompatibilité présences localStorage) */}
      <OfflineBanner />
    </DashboardLayout>
  )
}
