/**
 * Resolves static asset URLs cleanly across Vite dev and GitHub Pages (/maya_dashboard/)
 */
export function assetUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  const cleaned = String(path || '').replace(/^\.?\//, '');
  return `${base}${cleaned}`;
}
