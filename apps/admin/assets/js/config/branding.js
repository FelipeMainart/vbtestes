const LOGO_PATHS = {
  light: new URL('../../branding/logo-light.png', import.meta.url).href,
  dark: new URL('../../branding/logo-dark.png', import.meta.url).href,
  icon: new URL('../../branding/logo-icon.png', import.meta.url).href,
};

export function getBrandLogoSrc(variant = 'light') {
  return LOGO_PATHS[variant] || LOGO_PATHS.light;
}

export function renderBrandLogo({
  variant = 'light',
  alt = 'Veste Bem',
  className = '',
  loading = 'eager',
  decoding = 'async',
} = {}) {
  return `<img src="${getBrandLogoSrc(variant)}" alt="${String(alt).replace(/"/g, '&quot;')}" class="${className}" loading="${loading}" decoding="${decoding}" />`;
}

export function applyBrandLogo(target, variant = 'light', options = {}) {
  if (!target) return;

  const { alt = 'Veste Bem', hidden = false } = options;
  const src = getBrandLogoSrc(variant);

  if (target.tagName === 'IMG') {
    target.src = src;
    target.alt = alt;
    target.hidden = hidden;
    return;
  }

  target.innerHTML = renderBrandLogo({ variant, alt, className: target.className });
  target.hidden = hidden;
}
