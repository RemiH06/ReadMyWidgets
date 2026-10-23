// Colofón (widget G): cada categoría de `stack.json` como una banda de logos que
// corre en loop, como el colofón de lambda (`logo-loop.js`). Bandas inclinadas
// ±1° alternadas, píldora con la categoría a la izquierda, logos teñidos con el
// gis de la banda y nombres tenues; los extremos se desvanecen. Un SVG por banda
// (todas juntas pasan de 100 KB) y el snippet las apila.
import tokens from './tokens.json' with { type: 'json' };
import { W } from './card.js';
import { iconImage } from './icons.js';
import { label } from './stack.js';
import { n, svg, text } from './svg.js';
import { measure, truncate } from './text.js';

export const H = 42; // la banda y lo justo para inclinarla; los extremos se desvanecen
const CY = H / 2;
const BAND = 38;
const ICON = 22;
const BODY = 15; // 12.3 px en un teléfono (RNF-10)
const MARK = 6; // de logo a nombre
const GAP = 30; // entre logos
const SOLO_GAP = 22; // entre logos sin nombre
const PILL = 26;
const FADE = 0.09; // desvanecido en cada extremo, como el de lambda
// Orden de los colores del colofón de lambda: azul, cian, verde, violeta,
// amarillo, naranja, rosa, rojo (índices de `tokens.chalk`).
const ORDER = [0, 7, 2, 4, 1, 5, 3, 6];

// Un renglón de logos con nombre; `width` es lo que mide una vuelta. Sin
// `names`, solo los logos; el que no tiene logo conserva su nombre.
function sequence(items, icons, t, names) {
  let x = 0;
  const parts = [];
  for (const item of items) {
    const icon = icons.get(item.icon);
    if (icon) {
      parts.push(`<image x="${n(x)}" y="${CY - ICON / 2}" width="${ICON}" height="${ICON}" href="${iconImage(icon, t)}" filter="url(#k)"/>`);
      if (!names) {
        x += ICON + SOLO_GAP;
        continue;
      }
      x += ICON + MARK;
    }
    const name = truncate(item.name, BODY, W / 2);
    parts.push(text(x, CY + 5, BODY, name, 'dim'));
    x += measure(name, BODY) + GAP;
  }
  return { body: parts.join(''), width: Math.ceil(x) };
}

// `index` es la posición de la categoría: decide color, inclinación y sentido.
// `icons` es un Map de `icon` → texto SVG o null; `names` en false deja solo los logos.
export function colofon(category, index, t, icons, names = true) {
  const ink = tokens.chalk[t.theme][ORDER[index % ORDER.length]];
  const tilt = index % 2 ? 1 : -1;
  const dir = index % 2 ? -1 : 1;
  const speed = 38 + (index % 3) * 9; // px/s, como lambda
  const seq = sequence(category.items, icons, t, names);
  const tag = truncate(category.name, BODY, W / 2);
  const pw = n(22 + measure(tag, BODY) + 14);
  // El renglón arranca después de la píldora: quieto, se ve desde el primer logo.
  const copies = Math.ceil((W - pw) / seq.width) + 1;
  const uses = Array.from({ length: copies }, (_, k) => `<use href="#s" x="${n(pw + 12 + k * seq.width)}"/>`).join('');
  const r = PILL / 2;
  const pill =
    `<path d="M-1 ${CY - r}H${n(pw - r)}A${r} ${r} 0 0 1 ${n(pw - r)} ${CY + r}H-1Z" fill="${t.bg}" stroke="${ink}" stroke-opacity=".6"/>` +
    `<circle cx="12" cy="${CY}" r="4" fill="${ink}"/>` +
    text(22, CY + 5, BODY, tag);

  const defs =
    `<defs>` +
    `<filter id="k" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feFlood flood-color="${ink}"/><feComposite in2="SourceAlpha" operator="in"/></filter>` +
    `<linearGradient id="f"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${FADE}" stop-color="#fff"/>` +
    `<stop offset="${1 - FADE}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="-20" y="0" width="${W + 40}" height="${H}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#f)"/></mask>` +
    `<g id="s">${seq.body}</g></defs>`;
  // Hacia la izquierda la vuelta va de 0 a -ancho; hacia la derecha, al revés.
  // Quieto (sin animación o con reduced-motion), el renglón empieza en 0.
  const shift = `transform:translateX(-${seq.width}px)`;
  const css =
    `.r{animation:m ${n(seq.width / speed)}s linear infinite}` +
    `@keyframes m{${dir > 0 ? 'to' : 'from'}{${shift}}}` +
    `@media (prefers-reduced-motion:reduce){.r{animation:none}}`;
  const top = CY - BAND / 2;
  const body =
    defs +
    `<g transform="rotate(${tilt} ${W / 2} ${CY})"><g mask="url(#m)">` +
    `<rect x="-20" y="${top}" width="${W + 40}" height="${BAND}" fill="${t.fill}"/>` +
    `<path d="M-20 ${top}H${W + 20}M-20 ${top + BAND}H${W + 20}" stroke="${ink}" stroke-opacity=".45"/>` +
    `<g class="r">${uses}</g></g>${pill}</g>`;
  return svg({ width: W, height: H, t, title: label(category), body, css, frame: false });
}
