// middleware.ts  (racine du projet, même niveau que src/)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessibles sans être connecté
const PUBLIC_ROUTES = ['/login', '/register', '/signup', '/forgot-password']

// Routes qui peuvent être accédées même avec une école en_attente
const ATTENTE_ALLOWED = ['/dashboard/attente', '/login']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Si pas connecté et route protégée → /login
  if (!user && !PUBLIC_ROUTES.includes(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Si déjà connecté et tente d'accéder à /login ou /register → /dashboard
  if (user && PUBLIC_ROUTES.includes(pathname)) {
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  // Si connecté, vérifier si directeur avec école en_attente
  // (uniquement pour les routes dashboard non autorisées en mode attente)
  if (user && pathname.startsWith('/dashboard') && !ATTENTE_ALLOWED.includes(pathname)) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('role, ecole_id')
      .eq('user_id', user.id)
      .single()

    if (prof?.role === 'director' && prof.ecole_id) {
      const { data: ecole } = await supabase
        .from('ecoles')
        .select('statut')
        .eq('id', prof.ecole_id)
        .single()

      if (ecole?.statut === 'en_attente') {
        const attenteUrl = request.nextUrl.clone()
        attenteUrl.pathname = '/dashboard/attente'
        return NextResponse.redirect(attenteUrl)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Protège tout sauf :
     * - _next/static (fichiers statiques)
     * - _next/image  (optimisation images)
     * - favicon.ico
     * - manifest.json
     * - sw.js et autres fichiers JS/JSON de service worker
     * - fichiers avec extension (png, jpg, json, js…)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|js)$).*)',
  ],
}
