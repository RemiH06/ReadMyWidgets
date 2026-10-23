// Íconos de lenguajes y topics: devicon (versión fija, por `name`/`altnames`),
// luego `icons/` propios (SVG, o PNG envuelto en SVG), luego nada (la ficha pone
// el nombre en texto). `icons/alias.json` manda un nombre al ícono de otro
// (YOLO → ultralytics, Cypher → neo4j).
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import alias from '../icons/alias.json' with { type: 'json' };
import { contrast } from './color.js';
import { n } from './svg.js';

export const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/';
const VERSIONS = ['original', 'plain'];
// Para teñir de un color: `plain` es la silueta de un color, con los huecos recortados.
export const MONO = ['plain', 'original'];

// "C#" → "c#", "Jupyter Notebook" → "jupyternotebook".
const key = (name) => name.toLowerCase().replace(/[\s_.-]+/g, '');
const ALIAS = new Map(Object.entries(alias).map(([from, to]) => [key(from), to]));

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

  async function load(name, versions) {
    name = ALIAS.get(key(name)) ?? name;
    const entry = await find(name);
    const version = entry && versions.find((v) => entry.versions.svg.includes(v));
    if (version) return get(`icons/${entry.name}/${entry.name}-${version}.svg`);
    const own = (ext) => readFile(new URL(`../icons/${key(name)}.${ext}`, import.meta.url)).catch(() => null);
    const svg = await own('svg');
    if (svg) return svg.toString('utf8');
    const png = await own('png');
    if (!png) return null;
    const { width, height } = decodePng(png);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
      `<image width="${width}" height="${height}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`
    );
  }

  // Texto SVG del ícono o null; `versions` es el orden de preferencia.
  return (name, versions = VERSIONS) => {
    const k = `${versions}|${name}`;
    if (!cache.has(k)) cache.set(k, load(name, versions));
    return cache.get(k);
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

// Píxeles de un PNG RGBA de 8 bits sin entrelazar (lo que deja `raster_logo.py`).
// Otro formato es error: los PNG de `icons/` se preparan una vez.
export function decodePng(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6 || buf[28] !== 0) throw new Error('ícono PNG: solo RGBA de 8 bits sin entrelazar');
  const idat = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    if (buf.toString('latin1', at + 4, at + 8) === 'IDAT') idat.push(buf.subarray(at + 8, at + 8 + len));
    at += len + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const row = width * 4;
  const px = Buffer.alloc(row * height);
  // Cada renglón trae su filtro (ninguno, sub, up, average, Paeth) sobre bytes de 4 en 4.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (row + 1)];
    for (let x = 0; x < row; x++) {
      const a = x >= 4 ? px[y * row + x - 4] : 0;
      const b = y ? px[(y - 1) * row + x] : 0;
      const c = x >= 4 && y ? px[(y - 1) * row + x - 4] : 0;
      const p = a + b - c;
      const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      px[y * row + x] = (raw[y * (row + 1) + 1 + x] + pred) & 255;
    }
  }
  return { width, height, px };
}

const PNG = /href="data:image\/png;base64,([^"]+)"/;
const toHex = (...rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

// Parte de los píxeles opacos de un ícono PNG que da 3:1 sobre `bg`, con sus
// colores movidos hacia blanco (`k` > 0) o negro (`k` < 0) como lo hace el
// filtro de `iconImage`.
export function pngShare(svg, bg, k = 0) {
  const { px } = decodePng(Buffer.from(svg.match(PNG)[1], 'base64'));
  const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  let opaque = 0;
  let seen = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] <= 200) continue;
    opaque++;
    if (contrast(toHex(f(px[i]), f(px[i + 1]), f(px[i + 2])), bg) >= 3) seen++;
  }
  return seen / opaque;
}

// Lo menos que hay que aclarar u oscurecer un PNG, en pasos de 5 %, para que la
// mayoría de sus píxeles dé 3:1 sobre `bg`; el matiz se queda (como `legible`).
export function pngShift(svg, bg) {
  const dir = contrast(bg, '#000000') > contrast(bg, '#ffffff') ? -1 : 1;
  for (let step = 0; step < 20; step++) if (pngShare(svg, bg, (dir * step) / 20) >= 0.5) return (dir * step) / 20;
  return dir;
}

// El ícono como data URI para `<image>`: así sus ids y estilos no chocan con
// los de otros íconos del mismo SVG. Si ningún color se distingue del fondo
// (≥ 3:1, RNF-03), es un ícono monocromo oscuro o claro y se pinta con `text`.
// Un PNG se aclara u oscurece con un filtro (`pngShift`).
export function iconImage(svg, t) {
  if (/<script|<foreignObject|\bhref\s*=\s*"(?!#|data:image\/png;base64,)/i.test(svg)) {
    throw new Error('ícono con script, foreignObject o enlace externo');
  }
  if (PNG.test(svg)) {
    const k = pngShift(svg, t.bg);
    if (k) {
      const fn = `type="linear" slope="${n(1 - Math.abs(k))}" intercept="${k > 0 ? k : 0}"`;
      svg = svg.replace(
        '<image ',
        `<filter id="l" color-interpolation-filters="sRGB"><feComponentTransfer>` +
          `<feFuncR ${fn}/><feFuncG ${fn}/><feFuncB ${fn}/></feComponentTransfer></filter><image filter="url(#l)" `,
      );
    }
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
  const visible = iconColors(svg).some((c) => contrast(c, t.bg) >= 3);
  if (!visible) {
    svg = svg
      .replace(COLOR, (_, attr) => attr + t.text)
      .replace(/<svg\b(?![^>]*\sfill=)/, `<svg fill="${t.text}"`);
  }
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
