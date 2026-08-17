import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  target.headers.set("Cache-Control", "private, no-store");
  return target;
}

export async function updateSiteAdminSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase Auth proxy configuration is missing.");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const isLoginPage = request.nextUrl.pathname === "/painel/login";

  if (!isAuthenticated && !isLoginPage) {
    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL("/painel/login", request.url)),
    );
  }

  if (isAuthenticated && isLoginPage) {
    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL("/painel", request.url)),
    );
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
