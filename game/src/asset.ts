/** Resolve public assets under Vite's base path (including GitHub Pages subpaths). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
