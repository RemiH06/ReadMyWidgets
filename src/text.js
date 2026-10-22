import metrics from '../fonts/metrics.json' with { type: 'json' };

export const FAMILY = metrics.family;
const ELLIPSIS = '…';

// Ancho en px de `text` a `size` px. Lo que no está en el subset se mide con
// el avance de .notdef: el navegador lo dibuja con otra fuente y no se sabe su ancho.
export function measure(text, size, weight = 'regular') {
  const v = metrics.variants[weight];
  let units = 0;
  for (const ch of text) units += v.advances[ch.codePointAt(0)] ?? v.fallback;
  return (units * size) / v.unitsPerEm;
}

// Corta `text` con "…" para que no pase de `maxWidth` (RF-04).
export function truncate(text, size, maxWidth, weight = 'regular') {
  if (measure(text, size, weight) <= maxWidth) return text;
  const room = maxWidth - measure(ELLIPSIS, size, weight);
  let out = '';
  for (const ch of text) {
    if (measure(out + ch, size, weight) > room) break;
    out += ch;
  }
  return out.trimEnd() + ELLIPSIS;
}
