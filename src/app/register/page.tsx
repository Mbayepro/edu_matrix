// src/app/register/page.tsx
import type { Metadata } from 'next'
import SignupForm from '@/components/SignupForm'

export const metadata: Metadata = {
  title: 'Inscrire votre école - EduMatrix',
  description: 'Créer votre espace directeur sur EduMatrix',
}

export default function RegisterPage() {
  return <SignupForm />
}
