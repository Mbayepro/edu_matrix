import type { Metadata } from 'next'
import SignupForm from '@/components/SignupForm'

export const metadata: Metadata = {
  title: 'Inscription Directeur',
}

export default function SignupPage() {
  return <SignupForm />
}
