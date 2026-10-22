import { readFileSync } from 'node:fs';
import tokens from './tokens.json' with { type: 'json' };
import { FAMILY } from './text.js';

const font = (name) =>
  readFileSync(new URL(`../fonts/${name}`, import.meta.url)).toString('base64');

const FONT_FACE = [
  ['rmw-sans-regular.woff2', 400],
  ['rmw-sans-bold.woff2', 700],
]
  .map(
    ([file, weight]) =>
      `@font-face{font-family:'${FAMILY}';font-weight:${weight};` +
      `src:url(data:font/woff2;base64,${font(file)}) format('woff2')}`,
  )
  .join('');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

// Escape XML para todo texto de la API o del consumidor (RNF-07). Los caracteres
// de control no son válidos en XML 1.0 y romperían el SVG entero, así que se quitan.
export function escapeXml(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Piezas de dibujo compartidas por los widgets. `text` escapa lo que recibe.
export const n = (x) => Math.round(x * 100) / 100;
export const text = (x, y, size, str, cls = '') =>
  `<text${cls ? ` class="${cls}"` : ''} x="${n(x)}" y="${y}" font-size="${size}">${escapeXml(str)}</text>`;
export const image = (x, y, size, src) =>
  `<image x="${n(x)}" y="${n(y)}" width="${size}" height="${size}" href="${src}"/>`;

// Colores de un tema para dibujar. Con `transparent` la caja no tiene relleno y
// lo de adentro queda sobre la página de GitHub: `bg` pasa a ser `page`, y
// contra ese se miden los colores de lenguaje y de íconos.
export function palette(theme, transparent = false) {
  const t = tokens.themes[theme];
  return transparent ? { ...t, theme, bg: t.page, fill: 'none' } : { ...t, theme, fill: t.bg };
}

// Documento SVG autocontenido: fuente incrustada y colores de `t`, una
// `palette` (RNF-02). `body` ya debe venir escapado; `css` es el estilo propio del widget.
// Con `frame` en false no hay caja: el widget dibuja su propio fondo.
export function svg({ width, height, t, title, body, css: own = '', frame = true }) {
  const css =
    FONT_FACE +
    `text{font-family:'${FAMILY}',sans-serif;fill:${t.text}}` +
    `.b{font-weight:700}.dim{fill:${t.dim}}` +
    own;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title><style>${css}</style>` +
    (frame
      ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="${t.fill}" stroke="${t.border}"/>`
      : '') +
    `${body}</svg>\n`
  );
}
