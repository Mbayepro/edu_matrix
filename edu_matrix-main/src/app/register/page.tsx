import { Suspense } from 'react'
import type { Metadata } from 'next'
import SignupForm from '@/components/SignupForm'

export const metadata: Metadata = {
  title: 'Inscrire votre école - EduMatrix',
  description: 'Créer votre espace directeur sur EduMatrix',
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Chargement...</div>}>
      <SignupForm />
    </Suspense>
  )
}
