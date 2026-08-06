import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Atualize estes valores se você mudar o projeto Supabase.
export const SUPABASE_URL = 'https://rtjikqnszwutfgknemwt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0amlrcW5zend1dGZna25lbXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMzQzNzcsImV4cCI6MjA5OTcxMDM3N30.1r_EHL2A-Hpi-qazVaS-Xa97b8IqH9COpnKnlQEYqwY';

const AUTH_PERSISTENCE_KEY = 'vb-admin-auth-persistence';

const authStorage = {
  getItem(key) {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  },
  setItem(key, value) {
    const mode = window.sessionStorage.getItem(AUTH_PERSISTENCE_KEY);
    const remember = mode === 'local' || (mode === null && window.localStorage.getItem(key) !== null);
    const target = remember ? window.localStorage : window.sessionStorage;
    const stale = remember ? window.sessionStorage : window.localStorage;
    target.setItem(key, value);
    stale.removeItem(key);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function setAuthPersistence(remember) {
  window.sessionStorage.setItem(AUTH_PERSISTENCE_KEY, remember ? 'local' : 'session');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: authStorage,
  },
});
export const profilesTable = 'profiles';

export async function getProfileById(userId) {
  const { data, error } = await supabase
    .from(profilesTable)
    .select('*')
    .eq('id', userId)
    .single();

  return { profile: data, error };
}
