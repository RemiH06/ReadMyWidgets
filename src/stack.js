// Bloque de stack: un SVG por categoría de `stack.json`, con el mismo molde de
// cédula que la ficha. El título es la categoría; debajo, las tecnologías en
// renglones (ícono y nombre), en el orden que da el consumidor.
//
//   { "Languages": ["Python", "Kotlin", { "name": "SQL", "icon": "postgresql" }] }
import { W } from './card.js';
import { iconImage } from './icons.js';
import { image, svg, text } from './svg.js';
import { measure, truncate } from './text.js';

const PAD = 24;
const INNER = W - PAD * 2;
const TITLE = 22;
const BODY = 15; // igual que la ficha: 12.3 px en un teléfono (RNF-10)
const ICON = 18;
const GAP = 20; // entre tecnologías: más que el 6 de ícono a nombre, para que no se confundan
const FIRST = 78; // primera línea base, bajo el título en 44
const LINE = 30;
const BOTTOM = 28; // de la última línea base al borde, como la leyenda de la ficha
// Solo íconos (`names` en false): más grandes y más juntos, para que el bloque no quede ralo.
const SOLO = { icon: 28, gap: 14, line: 40 };

const fail = (why) => {
  throw new Error(`stack: ${why}; usa { "Categoría": ["Python", { "name": "SQL", "icon": "postgresql" }] }`);
};

// "Data & ML" → "data-ml"; "Bases de datos" → "bases-de-datos".
const slug = (name) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// JSON ya leído → [{ name, slug, items: [{ name, icon }] }]. Cualquier forma que
// no sea la del ejemplo falla diciendo dónde (RF-06).
export function parseStack(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) fail('debe ser un objeto de categoría → lista');
  const categories = Object.entries(json);
  if (!categories.length) fail('no tiene categorías');
  const slugs = new Map();
  return categories.map(([name, items]) => {
    const s = slug(name);
    if (!s) fail(`"${name}" no deja un nombre de archivo (necesita letras o números)`);
    if (slugs.has(s)) fail(`"${slugs.get(s)}" y "${name}" dan el mismo archivo stack-${s}`);
    slugs.set(s, name);
    if (!Array.isArray(items) || !items.length) fail(`"${name}" debe ser una lista con al menos una tecnología`);
    return {
      name,
      slug: s,
      items: items.map((item, i) => {
        if (typeof item === 'string' && item.trim()) return { name: item.trim(), icon: item.trim() };
        if (item && typeof item.name === 'string' && item.name.trim() && (item.icon === undefined || typeof item.icon === 'string')) {
          return { name: item.name.trim(), icon: (item.icon ?? item.name).trim() };
        }
        return fail(`"${name}"[${i}] debe ser un nombre o { "name", "icon" }`);
      }),
    };
  });
}

// Renglones de tecnologías: cada una es ícono (si hay) y nombre; la que no cabe
// baja al siguiente renglón y la que no cabe ni sola se corta con "…". Sin
// `names`, solo el ícono; la que no tiene ícono conserva su nombre.
function flow(items, icons, names) {
  const size = names ? ICON : SOLO.icon;
  const rows = [[]];
  let x = PAD;
  for (const item of items) {
    const has = Boolean(icons.get(item.icon));
    const mark = has ? size + (names ? 6 : 0) : 0;
    const name = has && !names ? '' : truncate(item.name, BODY, INNER - mark);
    const w = has && !names ? size : mark + measure(name, BODY);
    if (x > PAD && x + w > W - PAD) {
      rows.push([]);
      x = PAD;
    }
    rows.at(-1).push({ ...item, x, name, mark });
    x += w + (names ? GAP : SOLO.gap);
  }
  return rows;
}

// `<title>` del SVG y `alt` del snippet (RNF-11): la categoría y todo lo que trae.
export const label = (category) => `${category.name}: ${category.items.map((i) => i.name).join(', ')}`;

// `icons` es un Map de `icon` → texto SVG o null. `names` en false deja solo los
// íconos; el nombre de cada tecnología sigue en el `<title>` y el `alt`.
export function stack(category, t, icons, names = true) {
  const rows = flow(category.items, icons, names);
  const [size, line] = names ? [ICON, LINE] : [SOLO.icon, SOLO.line];
  const parts = [text(PAD, 44, TITLE, truncate(category.name, TITLE, INNER, 'bold'), 'b')];
  rows.forEach((row, r) => {
    // Ícono centrado en la altura de las minúsculas del renglón (línea base - 5).
    const y = FIRST + (names ? 0 : size / 2 - 9) + r * line;
    for (const item of row) {
      if (item.mark) parts.push(image(item.x, y - 5 - size / 2, size, iconImage(icons.get(item.icon), t)));
      if (item.name) parts.push(text(item.x + item.mark, y, BODY, item.name));
    }
  });
  const height = FIRST + (names ? 0 : size / 2 - 9) + (rows.length - 1) * line + BOTTOM;
  return svg({ width: W, height, t, title: label(category), body: parts.join('') });
}
