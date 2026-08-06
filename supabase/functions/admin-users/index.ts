import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('ADMIN_ALLOWED_ORIGINS') || 'http://127.0.0.1:5500,http://localhost:5500')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'Content-Type': 'application/json' } });
}

function normalizeUsername(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function safeError(error: unknown) {
  console.error('admin-users:', error instanceof Error ? error.message : error);
  return 'Não foi possível concluir a operação. Tente novamente.';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json(request, { error: 'Serviço de usuários indisponível.' }, 503);

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return json(request, { error: 'Dados inválidos.' }, 400); }

    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json(request, { error: 'Sessão não informada.' }, 401);
    const accessToken = authorization.slice(7).trim();
    if (!accessToken) return json(request, { error: 'Sessão não informada.' }, 401);

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller }, error: userError } = await authClient.auth.getUser(accessToken);
    if (userError || !caller) {
      console.error('admin-users auth validation failed:', {
        message: userError?.message || 'caller ausente',
        status: userError?.status || null,
        hasAuthorizationHeader: Boolean(authorization),
        hasBearerToken: authorization.startsWith('Bearer '),
      });
      return json(request, { error: 'Sessão inválida ou expirada. Entre novamente.' }, 401);
    }

    const adminClient = createClient(url, serviceKey);
    const { data: callerProfile, error: profileError } = await adminClient.from('profiles').select('id, role, active').eq('id', caller.id).maybeSingle();
    if (profileError || !callerProfile) return json(request, { error: 'Perfil administrativo não encontrado.' }, 403);
    if (callerProfile.role !== 'admin' || callerProfile.active === false) return json(request, { error: 'Acesso restrito.' }, 403);

    if (body.action === 'create') {
      const name = String(body.name || '').trim();
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');
      const role = body.role === 'admin' ? 'admin' : body.role === 'seller' ? 'seller' : null;
      if (!name || name.length > 120 || !role || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return json(request, { error: 'Informe nome, usuário e perfil válidos.' }, 422);
      if (password.length < 8 || password.length > 128) return json(request, { error: 'A senha deve ter entre 8 e 128 caracteres.' }, 422);

      const { data: existing } = await adminClient.from('profiles').select('id').ilike('username', username).maybeSingle();
      if (existing) return json(request, { error: 'Este usuário já está em uso.' }, 409);

      const authEmail = `${username}@users.vestebem.local`;
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({ email: authEmail, password, email_confirm: true, user_metadata: { name, username } });
      if (authError || !authData.user) return json(request, { error: 'Não foi possível criar a conta.' }, 400);

      // Upsert makes this safe if a future auth.users trigger creates profiles automatically.
      const { error: profileError } = await adminClient.from('profiles').upsert({ id: authData.user.id, name, username, email: authEmail, role, active: true }, { onConflict: 'id' });
      if (profileError) {
        console.error('admin-users profile upsert:', profileError.message);
        await adminClient.auth.admin.deleteUser(authData.user.id);
        return json(request, { error: 'A conta não pôde ser finalizada.' }, 400);
      }
      return json(request, { user: { id: authData.user.id, name, username, role, active: true } }, 201);
    }

    if (body.action === 'update') {
      const id = String(body.id || '');
      const name = String(body.name || '').trim();
      const role = body.role === 'admin' ? 'admin' : body.role === 'seller' ? 'seller' : null;
      const active = body.active !== false;
      if (!id || !name || name.length > 120 || !role) return json(request, { error: 'Dados do usuário inválidos.' }, 422);
      const { data: target } = await adminClient.from('profiles').select('id, name, role, active').eq('id', id).maybeSingle();
      if (!target) return json(request, { error: 'Usuário não encontrado.' }, 404);
      if (id === caller.id && (!active || role !== 'admin')) return json(request, { error: 'Você não pode desativar ou rebaixar sua própria conta.' }, 403);
      if (target.role === 'admin' && target.active && (!active || role !== 'admin')) {
        const { count, error: countError } = await adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
        if (countError) return json(request, { error: 'Não foi possível validar administradores ativos.' }, 500);
        if ((count || 0) <= 1) return json(request, { error: 'Mantenha pelo menos um administrador ativo.' }, 409);
      }
      const { error: profileError } = await adminClient.from('profiles').update({ name, role, active }).eq('id', id);
      if (profileError) return json(request, { error: 'Não foi possível atualizar o perfil.' }, 400);
      const { error: authError } = await adminClient.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' });
      if (authError) {
        await adminClient.from('profiles').update({ name: target.name, role: target.role, active: target.active }).eq('id', id);
        return json(request, { error: 'Não foi possível atualizar o acesso da conta.' }, 400);
      }
      return json(request, { ok: true });
    }

    if (body.action === 'reset_password') {
      const id = String(body.id || '');
      const password = String(body.password || '');
      if (!id || password.length < 8 || password.length > 128) return json(request, { error: 'A senha deve ter entre 8 e 128 caracteres.' }, 422);
      const { error } = await adminClient.auth.admin.updateUserById(id, { password });
      if (error) return json(request, { error: 'Não foi possível redefinir a senha.' }, 400);
      return json(request, { ok: true });
    }

    return json(request, { error: 'Ação não suportada.' }, 400);
  } catch (error) {
    return json(request, { error: safeError(error) }, 500);
  }
});
