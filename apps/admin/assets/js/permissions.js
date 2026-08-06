import { supabase, getProfileById } from './supabaseClient.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Erro ao obter sessão:', error.message);
    return null;
  }

  return data?.session || null;
}

export async function getCurrentProfile() {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const { profile, error } = await getProfileById(userId);
  if (error) {
    console.error('Erro ao carregar perfil:', error.message);
    return null;
  }

  return profile;
}

export async function requireAuth(redirectTo = 'login.html') {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${redirectTo}?redirect=${redirectParam}`;
    return null;
  }

  const { profile, error } = await getProfileById(userId);
  if (error || !profile || profile.active === false) {
    await supabase.auth.signOut();
    const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${redirectTo}?redirect=${redirectParam}`;
    return null;
  }

  return profile;
}

export async function redirectIfAuthenticated(defaultTarget = 'index.html') {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const { profile, error } = await getProfileById(userId);
  if (!error && profile && profile.active !== false) {
    window.location.href = defaultTarget;
  }

  return null;
}

export function isAdmin(profile) {
  return profile?.role === 'admin';
}

export function isSeller(profile) {
  return profile?.role === 'seller';
}
