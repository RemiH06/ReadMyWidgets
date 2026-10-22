// Ficha de repo como cédula de museo, en tres alturas para apilar:
//   card     título, técnica y fecha, descripción de 2 líneas, barra y leyenda
//   compact  título con fecha y estrellas, 1 línea de descripción, barra y leyenda
//   row      un renglón: status, nombre, técnica y fecha, barra corta
import linguist from './linguist.json' with { type: 'json' };
import tokens from './tokens.json' with { type: 'json' };
import { legible } from './color.js';
import { iconImage } from './icons.js';
import { STATUS_LABEL } from './repo.js';
import { image, n, svg, text } from './svg.js';
import { measure, truncate, wrap } from './text.js';

export const W = 400;
export const LAYOUTS = { card: 204, compact: 136, row: 60 };
const PAD = 24;
const INNER = W - PAD * 2;
const TITLE = 22;
const BODY = 15; // el texto más chico: 15 × 328 / 400 = 12.3 px en un teléfono (RNF-10)
const ICON = 18;
const TOPIC = 16;
const BAR = 8; // alto de la barra, puntas redondas como la de GitHub
const GAP = 2; // hueco entre segmentos de la barra
const DOT = 6; // radio del punto de status
const SEP = ' · ';

const dot = (cx, cy, r, fill) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="${fill}"/>`;

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

// Color de Linguist del lenguaje, movido lo justo para dar 3:1 sobre el fondo (RNF-03).
export const langColor = (lang, t) => legible(linguist.colors[lang] ?? t.border, t.bg);

// "2024 · ★ 12": año y estrellas con la estrella dibujada; devuelve las piezas y el ancho.
const yearStarsWidth = (repo) =>
  measure(repo.year, BODY) + (repo.stars ? measure(SEP, BODY) + 16 + measure(stars(repo.stars), BODY) : 0);

function yearStars(repo, x, y, t) {
  if (!repo.stars) return { parts: [text(x, y, BODY, repo.year, 'dim')], w: measure(repo.year, BODY) };
  const sx = x + measure(repo.year + SEP, BODY);
  const parts = [text(x, y, BODY, repo.year + SEP, 'dim'), star(sx + 6, y - 5.5, 6.5, t.dim)];
  parts.push(text(sx + 16, y, BODY, stars(repo.stars), 'dim'));
  return { parts, w: yearStarsWidth(repo) };
}

// Barra de proporción: un segmento por lenguaje de la leyenda (`shown` bytes) y
// el resto junto en `border`, recortada a una cápsula.
function bar(x, y, w, repo, shown, t) {
  const total = repo.languages.reduce((s, [, b]) => s + b, 0);
  const rest = total - shown.reduce((s, b) => s + b, 0);
  const segs = [
    ...repo.languages.slice(0, shown.length).map(([l, b]) => [b, langColor(l, t)]),
    ...(rest > 0 ? [[rest, t.border]] : []),
  ];
  const room = w - GAP * (segs.length - 1);
  let bx = x;
  const rects = segs.map(([b, fill], i) => {
    const sw = i === segs.length - 1 ? x + w - bx : Math.max(2, (b / total) * room);
    const r = `<rect x="${n(bx)}" y="${y}" width="${n(sw)}" height="${BAR}" fill="${fill}"/>`;
    bx += sw + GAP;
    return r;
  });
  return (
    `<clipPath id="bar"><rect x="${x}" y="${y}" width="${w}" height="${BAR}" rx="${BAR / 2}"/></clipPath>` +
    `<g clip-path="url(#bar)">${rects.join('')}</g>`
  );
}

// Leyenda en una fila desde `x0`: ícono (o punto del color de la barra), nombre y
// porcentaje; los lenguajes que no caben se juntan en el resto de la barra.
function legend(x0, y, repo, icons, theme, t) {
  const total = repo.languages.reduce((s, [, b]) => s + b, 0);
  const parts = [];
  const shown = [];
  let x = x0;
  for (const [lang, bytes] of repo.languages) {
    const svgIcon = icons.get(lang);
    const mark = svgIcon ? ICON : 8;
    const pct = percent((bytes * 100) / total);
    const w = mark + 6 + measure(`${lang} ${pct}`, BODY);
    if (x + w > W - PAD) break;
    if (svgIcon) parts.push(image(x, y - 14, ICON, iconImage(svgIcon, theme)));
    else parts.push(dot(x + 4, y - 5, 4, langColor(lang, t)));
    const tx = x + mark + 6;
    parts.push(text(tx, y, BODY, lang));
    parts.push(text(tx + measure(`${lang} `, BODY), y, BODY, pct, 'dim'));
    shown.push(bytes);
    x += w + 16;
  }
  return { parts, shown };
}

function full(repo, theme, icons, t) {
  const parts = [];
  const mark = repo.status ? DOT * 2 + 6 : 0;
  parts.push(text(PAD, 44, TITLE, truncate(repo.name, TITLE, INNER - mark, 'bold'), 'b'));
  if (repo.status) parts.push(dot(W - PAD - DOT, 37, DOT, t[repo.status]));

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

  wrap(repo.description, BODY, INNER, 2).forEach((l, i) => parts.push(text(PAD, 100 + i * 22, BODY, l)));

  const lg = legend(PAD, 176, repo, icons, theme, t);
  parts.push(bar(PAD, 139, INNER, repo, lg.shown, t), ...lg.parts);
  return parts;
}

function compact(repo, theme, icons, t) {
  const parts = [];
  // Título a la izquierda; año, estrellas y status a la derecha.
  let right = W - PAD;
  if (repo.status) {
    parts.push(dot(right - DOT, 35, DOT, t[repo.status]));
    right -= DOT * 2 + 10;
  }
  const meta = yearStars(repo, right - yearStarsWidth(repo), 42, t);
  parts.push(...meta.parts);
  parts.push(text(PAD, 42, TITLE, truncate(repo.name, TITLE, right - meta.w - 12 - PAD, 'bold'), 'b'));

  wrap(repo.description, BODY, INNER, 1).forEach((l) => parts.push(text(PAD, 68, BODY, l)));

  const lg = legend(PAD, 112, repo, icons, theme, t);
  parts.push(bar(PAD, 82, INNER, repo, lg.shown, t), ...lg.parts);
  return parts;
}

function row(repo, theme, icons, t) {
  const parts = [];
  const BAR_W = 112;
  let x = PAD;
  if (repo.status) {
    parts.push(dot(x + DOT, 30, DOT, t[repo.status]));
    x += DOT * 2 + 10;
  }
  const room = W - PAD - BAR_W - 16 - x;
  const meta = [repo.languages[0]?.[0], repo.year].filter(Boolean).join(SEP);
  const name = truncate(repo.name, 18, Math.max(room - measure(SEP + meta, BODY), room * 0.6), 'bold');
  parts.push(text(x, 36, 18, name, 'b'));
  // Técnica y fecha enteras, o solo el lenguaje, o nada: un "Rust ·…" no informa.
  const mx = x + measure(name, 18, 'bold') + 10;
  const metaFit = [meta, repo.languages[0]?.[0] ?? ''].find((m) => measure(m, BODY) <= x + room - mx);
  if (metaFit) parts.push(text(mx, 36, BODY, metaFit, 'dim'));

  // Sin leyenda: todos los lenguajes con color hasta 1 %, el resto en gris.
  const total = repo.languages.reduce((s, [, b]) => s + b, 0);
  const shown = repo.languages.filter(([, b]) => b / total >= 0.01).slice(0, 6).map(([, b]) => b);
  parts.push(bar(W - PAD - BAR_W, 26, BAR_W, repo, shown, t));
  return parts;
}

const RENDER = { card: full, compact, row };

// Nombre, descripción y status: `<title>` del SVG y `alt` del snippet (RNF-11).
export const label = (repo) =>
  repo.name +
  (repo.description ? `: ${repo.description}` : '') +
  (repo.status ? ` (${STATUS_LABEL[repo.status]})` : '');

// `repo` sale de fetchRepo; `icons` es un Map de nombre → texto SVG o null.
export function card(repo, theme, icons, layout = 'card') {
  const t = tokens.themes[theme];
  const body = RENDER[layout](repo, theme, icons, t).join('');
  return svg({ width: W, height: LAYOUTS[layout], theme, title: label(repo), body });
}
