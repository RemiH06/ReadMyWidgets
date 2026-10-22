// Ficha de repo como cédula de museo: título, línea de técnica y fecha,
// descripción de hasta 2 líneas, barra de lenguajes con su leyenda.
import tokens from './tokens.json' with { type: 'json' };
import { iconImage } from './icons.js';
import { escapeXml, svg } from './svg.js';
import { measure, truncate, wrap } from './text.js';

export const W = 400;
export const H = 204;
const PAD = 24;
const INNER = W - PAD * 2;
const TITLE = 22;
const BODY = 15; // el texto más chico: 15 × 328 / 400 = 12.3 px en un teléfono (RNF-10)
const ICON = 18;
const TOPIC = 16;
const GAP = 2; // hueco entre segmentos de la barra
const SEP = ' · ';

const n = (x) => Math.round(x * 100) / 100;
const text = (x, y, size, str, cls = '') =>
  `<text${cls ? ` class="${cls}"` : ''} x="${n(x)}" y="${y}" font-size="${size}">${escapeXml(str)}</text>`;
const image = (x, y, size, src) =>
  `<image x="${n(x)}" y="${n(y)}" width="${size}" height="${size}" href="${src}"/>`;

function star(x, y, r, fill) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const d = i % 2 ? r * 0.45 : r;
    return `${n(x + d * Math.cos(a))},${n(y + d * Math.sin(a))}`;
  });
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

const stars = (s) => (s >= 1000 ? `${Math.round(s / 100) / 10}k` : String(s));
const percent = (p) => (p < 0.5 ? '<1%' : `${Math.round(p)}%`);

// `repo` sale de fetchRepo; `icons` es un Map de nombre → texto SVG o null.
export function card(repo, theme, icons) {
  const t = tokens.themes[theme];
  const parts = [];

  // Título; el punto rojo de galería marca un repo archivado.
  const dot = repo.archived ? 12 + 6 : 0;
  parts.push(text(PAD, 44, TITLE, truncate(repo.name, TITLE, INNER - dot, 'bold'), 'b'));
  if (repo.archived) parts.push(`<circle cx="${W - PAD - 6}" cy="37" r="6" fill="${t.accent}"/>`);

  // Técnica y fecha, con los topics que tienen ícono a la derecha.
  const langNames = new Set(repo.languages.map(([l]) => l.toLowerCase()));
  const topics = repo.topics.filter((tp) => icons.get(tp) && !langNames.has(tp));
  let right = W - PAD;
  for (const tp of topics.slice(0, 5).reverse()) {
    right -= TOPIC;
    parts.push(image(right, 70 - 12.5, TOPIC, iconImage(icons.get(tp), theme)));
    right -= 8;
  }
  const head = [repo.languages.slice(0, 2).map(([l]) => l).join(', '), repo.year].filter(Boolean);
  let line = head.join(SEP);
  const starRoom = repo.stars ? measure(SEP, BODY) + 16 + measure(stars(repo.stars), BODY) : 0;
  line = truncate(line, BODY, right - PAD - 8 - starRoom);
  parts.push(text(PAD, 70, BODY, line, 'dim'));
  if (repo.stars) {
    const x = PAD + measure(line + SEP, BODY);
    parts.push(star(x + 6, 64.5, 6.5, t.dim));
    parts.push(text(x + 16, 70, BODY, stars(repo.stars), 'dim'));
  }

  // Descripción, hasta 2 líneas.
  wrap(repo.description, BODY, INNER, 2).forEach((l, i) => parts.push(text(PAD, 100 + i * 22, BODY, l)));

  // Leyenda: los lenguajes que caben, en orden; el resto va junto al final de la barra.
  const total = repo.languages.reduce((s, [, b]) => s + b, 0);
  const shown = [];
  let x = PAD;
  for (const [lang, bytes] of repo.languages) {
    const svgIcon = icons.get(lang);
    const pct = percent((bytes * 100) / total);
    const w = (svgIcon ? ICON + 6 : 0) + measure(`${lang} ${pct}`, BODY);
    if (x + w > W - PAD) break;
    if (svgIcon) parts.push(image(x, 162, ICON, iconImage(svgIcon, theme)));
    const tx = x + (svgIcon ? ICON + 6 : 0);
    parts.push(text(tx, 176, BODY, lang));
    parts.push(text(tx + measure(`${lang} `, BODY), 176, BODY, pct, 'dim'));
    shown.push(bytes);
    x += w + 16;
  }

  // Barra de proporción en una sola tinta; lo que no tiene leyenda va en `border`.
  const rest = total - shown.reduce((s, b) => s + b, 0);
  const segs = [...shown.map((b) => [b, t.dim]), ...(rest > 0 ? [[rest, t.border]] : [])];
  const room = INNER - GAP * (segs.length - 1);
  let bx = PAD;
  segs.forEach(([b, fill], i) => {
    const w = i === segs.length - 1 ? W - PAD - bx : Math.max(2, (b / total) * room);
    parts.push(`<rect x="${n(bx)}" y="140" width="${n(w)}" height="6" fill="${fill}"/>`);
    bx += w + GAP;
  });

  const label =
    repo.name + (repo.description ? `: ${repo.description}` : '') + (repo.archived ? ' (archivado)' : '');
  return svg({ width: W, height: H, theme, title: label, body: parts.join('') });
}
