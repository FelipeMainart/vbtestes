-- Veste Bem Admin - usuarios com login por username.
-- Execute no SQL Editor do Supabase antes de publicar a Edge Function admin-users.

alter table public.profiles
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists last_login_at timestamptz;

update public.profiles profile
set email = users.email
from auth.users users
where users.id = profile.id
  and profile.email is null;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

comment on column public.profiles.username is 'Login do usuario. Contas antigas podem continuar usando e-mail.';

-- Atualiza somente o último acesso do próprio usuário autenticado.
create or replace function public.record_profile_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_login_at = now()
  where id = auth.uid()
    and active = true;
end;
$$;

revoke all on function public.record_profile_login() from public;
grant execute on function public.record_profile_login() to authenticated;
