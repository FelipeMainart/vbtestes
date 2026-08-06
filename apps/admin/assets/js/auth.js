import { applyBrandLogo } from './config/branding.js';
import { supabase, getProfileById, setAuthPersistence } from './supabaseClient.js';

const loginForm = document.querySelector('#login-form');
const messageElement = document.querySelector('#login-message');
const loginCompanyLogo = document.querySelector('[data-login-company-logo]');
const loginCompanyLogoImage = document.querySelector('[data-login-company-logo-image]');
const mobileCompanyLogo = document.querySelector('[data-login-mobile-logo]');
const passwordInput = document.querySelector('#password');
const passwordToggle = document.querySelector('[data-password-toggle]');

function showMessage(message, type = 'error') {
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.style.color = type === 'success' ? '#0b69ff' : '#d92d20';
}

function clearMessage() {
  if (messageElement) {
    messageElement.textContent = '';
  }
}

export function getSafeRedirect() {
  const fallback = 'index.html';
  const raw = new URLSearchParams(window.location.search).get('redirect');

  if (!raw) return fallback;

  const value = raw.trim();
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value) || value.startsWith('\\')) {
    return fallback;
  }

  const normalized = value.startsWith('#') ? `index.html${value}` : value;

  try {
    const candidate = new URL(normalized, window.location.href);
    const localIndexPath = new URL('index.html', window.location.href).pathname;
    const allowedPaths = new Set([localIndexPath, '/index.html']);

    if (candidate.origin !== window.location.origin || !allowedPaths.has(candidate.pathname)) {
      return fallback;
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return fallback;
  }
}

async function loadLoginCompanyLogo() {
  if (loginCompanyLogo && loginCompanyLogoImage) {
    applyBrandLogo(loginCompanyLogoImage, 'light');
    loginCompanyLogo.classList.add('has-image');
  }

  if (mobileCompanyLogo) {
    applyBrandLogo(mobileCompanyLogo, 'light');
  }
}

function setupPasswordToggle() {
  if (!passwordInput || !passwordToggle) return;

  passwordToggle.addEventListener('click', () => {
    const shouldShow = passwordInput.type === 'password';
    passwordInput.type = shouldShow ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(shouldShow));
    passwordToggle.setAttribute('aria-label', shouldShow ? 'Ocultar senha' : 'Mostrar senha');
  });
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

export async function handleLogout() {
  await logout();
}

export async function getCurrentUserProfile() {
  const sessionResult = await supabase.auth.getSession();
  const userId = sessionResult?.data?.session?.user?.id;
  if (!userId) {
    return null;
  }

  const { profile, error } = await getProfileById(userId);
  if (error) {
    return null;
  }

  return profile;
}

async function login(event) {
  event.preventDefault();
  clearMessage();

  const formData = new FormData(loginForm);
  const identifier = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();
  const remember = formData.get('remember') === 'on';

  if (!identifier || !password) {
    showMessage('Informe usuário ou e-mail e senha.');
    return;
  }

  const email = identifier.includes('@')
    ? identifier
    : `${identifier.toLowerCase()}@users.vestebem.local`;

  showMessage('Autenticando...', 'success');
  setAuthPersistence(remember);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showMessage('Falha no login: ' + error.message);
    return;
  }

  const userId = data?.user?.id;
  if (!userId) {
    showMessage('Não foi possível identificar o usuário.');
    return;
  }

  const { profile, error: profileError } = await getProfileById(userId);

  if (profileError || !profile) {
    await supabase.auth.signOut();
    showMessage('Perfil não encontrado. Contate o administrador.');
    return;
  }

  if (profile.active === false) {
    await supabase.auth.signOut();
    showMessage('Usuário inativo. Contate o administrador.');
    return;
  }

  // Non-blocking: the account is already authenticated even if the audit timestamp is unavailable.
  supabase.rpc('record_profile_login').then(({ error }) => {
    if (error) console.warn('Não foi possível registrar o último acesso:', error.message);
  });

  window.location.href = getSafeRedirect();
}

async function init() {
  await loadLoginCompanyLogo();

  if (loginForm) {
    loginForm.addEventListener('submit', login);
  }

  setupPasswordToggle();
}

init();

