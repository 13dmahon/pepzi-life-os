import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.pepzi.io';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    await supabase.auth.exchangeCodeForSession(code);
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', session.user.id)
        .single();

      if (!profile || !profile.onboarding_complete) {
        if (!profile) {
          await supabase.from('users').insert({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'User',
            onboarding_complete: false,
          });
        }
        return NextResponse.redirect(new URL('/onboarding', SITE_URL));
      }
      return NextResponse.redirect(new URL('/today', SITE_URL));
    }
  }
  return NextResponse.redirect(new URL('/login', SITE_URL));
}
