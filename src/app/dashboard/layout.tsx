// src/app/dashboard/layout.tsx
import DashboardLayout from '@/components/DashboardLayout'
import OfflineBanner   from '@/components/OfflineBanner'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
      <OfflineBanner />
    </DashboardLayout>
  )
}
