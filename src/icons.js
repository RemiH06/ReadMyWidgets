// Íconos de lenguajes y topics: devicon (versión fija, por `name`/`altnames`),
// luego `icons/` propios, luego nada (la ficha pone el nombre en texto).
import { readFile } from 'node:fs/promises';
import { contrast } from './color.js';

export const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/';
const VERSIONS = ['original', 'plain'];

// "C#" → "c#", "Jupyter Notebook" → "jupyternotebook".
const key = (name) => name.toLowerCase().replace(/[\s_.-]+/g, '');

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`devicon respondió ${res.status} a ${url}`);
  return res.text();
}

// `get(path)` devuelve el texto de un archivo de devicon (relativo a DEVICON).
export function iconSource(get = (path) => fetchText(DEVICON + path)) {
  let index;
  const cache = new Map();

  // Exacto por `name` o `altnames`; si no, `name` = clave + versión o "js"
  // (GitHub dice HTML, CSS y Vue; devicon, html5, css3 y vuejs).
  async function find(name) {
    index ??= JSON.parse(await get('devicon.json'));
    const k = key(name);
    return (
      index.find((i) => i.name === k || i.altnames.map(key).includes(k)) ??
      index.find((i) => i.name.startsWith(k) && /^(\d+|js)$/.test(i.name.slice(k.length)))
    );
  }

  async function load(name) {
    const entry = await find(name);
    const version = entry && VERSIONS.find((v) => entry.versions.svg.includes(v));
    if (version) return get(`icons/${entry.name}/${entry.name}-${version}.svg`);
    return readFile(new URL(`../icons/${key(name)}.svg`, import.meta.url), 'utf8').catch(() => null);
  }

  // Texto SVG del ícono o null.
  return (name) => {
    if (!cache.has(name)) cache.set(name, load(name));
    return cache.get(name);
  };
}

const SHAPE = /<(path|circle|rect|ellipse|polygon|polyline)\b[^>]*>/g;
const COLOR = /((?<![\w-])(?:fill|stop-color|color)\s*[=:]\s*"?\s*)(#[0-9a-f]{3}(?:[0-9a-f]{3})?\b|black|white)/gi;

const hex = (c) => {
  c = c.toLowerCase();
  if (c === 'black') return '#000000';
  if (c === 'white') return '#ffffff';
  return c.length === 4 ? '#' + [...c.slice(1)].map((d) => d + d).join('') : c;
};

// Colores que pinta el ícono. Una figura sin `fill` cuenta como negra: es el
// default de SVG (puede heredar otro color de un grupo; aquí basta el peor caso).
export function iconColors(svg) {
  const colors = new Set([...svg.matchAll(COLOR)].map((m) => hex(m[2])));
  for (const [tag] of svg.matchAll(SHAPE)) {
    if (!/\bfill\s*[=:]/.test(tag)) colors.add('#000000');
  }
  return [...colors];
}

// El ícono como data URI para `<image>`: así sus ids y estilos no chocan con
// los de otros íconos del mismo SVG. Si ningún color se distingue del fondo
// (≥ 3:1, RNF-03), es un ícono monocromo oscuro o claro y se pinta con `text`.
export function iconImage(svg, t) {
  if (/<script|<foreignObject|\bhref\s*=\s*"(?!#)/i.test(svg)) {
    throw new Error('ícono con script, foreignObject o enlace externo');
  }
  const visible = iconColors(svg).some((c) => contrast(c, t.bg) >= 3);
  if (!visible) {
    svg = svg
      .replace(COLOR, (_, attr) => attr + t.text)
      .replace(/<svg\b(?![^>]*\sfill=)/, `<svg fill="${t.text}"`);
  }
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
