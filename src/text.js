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

// El prefijo más largo de `text` que cabe en `maxWidth`.
function fit(text, size, maxWidth, weight) {
  let out = '';
  for (const ch of text) {
    if (measure(out + ch, size, weight) > maxWidth) break;
    out += ch;
  }
  return out;
}

// Corta `text` con "…" para que no pase de `maxWidth` (RF-04). Si el corte cae
// a media palabra y hay palabras completas antes, se queda con esas.
export function truncate(text, size, maxWidth, weight = 'regular') {
  if (measure(text, size, weight) <= maxWidth) return text;
  const room = maxWidth - measure(ELLIPSIS, size, weight);
  let out = fit(text, size, room, weight);
  if (/\S$/.test(out) && /\S/.test(text[out.length]) && /\s/.test(out)) out = out.replace(/\S+$/, '');
  return out.trimEnd() + ELLIPSIS;
}

// Acomoda `text` en hasta `maxLines` líneas por palabras; la última se corta
// con "…" si sobra texto. Una palabra más ancha que la línea se parte.
export function wrap(text, size, maxWidth, maxLines, weight = 'regular') {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  while (words.length && lines.length < maxLines - 1) {
    let line = words.shift();
    while (words.length && measure(`${line} ${words[0]}`, size, weight) <= maxWidth) {
      line += ` ${words.shift()}`;
    }
    if (measure(line, size, weight) > maxWidth) {
      const head = fit(line, size, maxWidth, weight);
      words.unshift(line.slice(head.length));
      line = head;
    }
    lines.push(line);
  }
  if (words.length) lines.push(truncate(words.join(' '), size, maxWidth, weight));
  return lines;
}
