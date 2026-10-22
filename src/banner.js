// Banner pizarrón (widget A): un texto en gis sobre la rejilla hexagonal de
// lambda, con fórmulas, círculos, flechas, senos y ejes tenues alrededor, como
// en `chalkboard.js`. Gis de doble trazo (una copia corrida y más tenue) y
// grano con ruido de semilla fija. Al cargar, el texto se escribe de izquierda
// a derecha y los objetos se trazan; todo con CSS.
import tokens from './tokens.json' with { type: 'json' };
import { W } from './card.js';
import { escapeXml, n, svg } from './svg.js';
import { measure, wrap } from './text.js';

export const H = 160;
const PAD = 24;
const INNER = W - PAD * 2;
const SIZE = 40;
const LINE = 46;
const CAP = 0.7; // alto de mayúscula de RMW Sans, en em
const HEX = 20; // lado del hexágono de la rejilla
const COLS = 4;
const ROWS = 2;
const ALPHA = 0.28; // los objetos son textura, no contenido
const WRITE = 1100; // ms por línea de texto
const DRAW = 900; // ms por objeto
const STAGGER = 110;
const SEED = 0x1a2b;

// Solo con glifos del subset (Latin-1): λ, π o ∇ caerían a otra fuente.
const FORMULAS = ['E = mc²', 'F = ma', 'a² + b² = c²', 'P(A|B)', 'f(x) = x³ - 1', '½·m·v²', '¬(p · q)', 'n! = n·(n-1)!'];
const TYPES = ['formula', 'circle', 'formula', 'arrow', 'sine', 'formula', 'axes', 'circle'];

// mulberry32, igual que en nixie: mismos objetos en cada corrida (RNF-04).
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Las líneas del banner. Un banner cortado no sirve: si no cabe en 2 líneas
// sin partir palabras, falla con mensaje.
export function lines(str) {
  const words = str.split(/\s+/).filter(Boolean);
  if (!words.length) throw new Error('banner: el texto está vacío');
  const wide = words.find((w) => measure(w, SIZE, 'bold') > INNER);
  if (wide) throw new Error(`banner: "${wide}" no cabe en una línea; usa text con algo más corto`);
  const out = wrap(words.join(' '), SIZE, INNER, 3, 'bold');
  if (out.length > 2) throw new Error(`banner: "${str}" no cabe en 2 líneas; usa text con algo más corto`);
  return out;
}

// Un objeto de gis por celda, corrido al azar dentro de ella, como en lambda.
function doodles(rand) {
  const rng = (a, b) => a + rand() * (b - a);
  const cw = W / COLS;
  const ch = H / ROWS;
  const out = [];
  let fi = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const x = (c + 0.5) * cw + rng(-cw, cw) * 0.28;
      const y = (r + 0.5) * ch + rng(-ch, ch) * 0.28;
      const type = TYPES[i];
      let d;
      if (type === 'formula') {
        out.push({ i, text: FORMULAS[fi++ % FORMULAS.length], x: x - 30, y, size: Math.round(rng(15, 19)) });
        continue;
      }
      if (type === 'circle') {
        const rad = rng(14, 30);
        d = `M${n(x - rad)} ${n(y)}a${n(rad)} ${n(rad)} 0 1 0 ${n(rad * 2)} 0a${n(rad)} ${n(rad)} 0 1 0 ${n(-rad * 2)} 0`;
      } else if (type === 'arrow') {
        const x2 = x + rng(-50, 50);
        const y2 = y + rng(-36, 36);
        const a = Math.atan2(y2 - y, x2 - x);
        const head = (s) => `L${n(x2 - 7 * Math.cos(a + s))} ${n(y2 - 7 * Math.sin(a + s))}`;
        d = `M${n(x)} ${n(y)}L${n(x2)} ${n(y2)}${head(-0.4)}M${n(x2)} ${n(y2)}${head(0.4)}`;
      } else if (type === 'sine') {
        const w = rng(60, 100);
        const phase = rng(0, Math.PI * 2);
        const x0 = x - w / 2;
        d = Array.from({ length: 41 }, (_, k) => {
          const px = x0 + (w * k) / 40;
          const py = y + Math.sin((k / 40) * Math.PI * 4 + phase) * 10;
          return `${k ? 'L' : 'M'}${n(px)} ${n(py)}`;
        }).join('');
      } else {
        const s = rng(18, 30);
        const curve = Array.from({ length: 21 }, (_, k) => {
          const px = -s + (s * k) / 10;
          return `${k ? 'L' : 'M'}${n(x + px)} ${n(y - (px * px) / (s * 1.5))}`;
        }).join('');
        d = `M${n(x)} ${n(y + s)}V${n(y - s)}M${n(x - s)} ${n(y)}H${n(x + s)}${curve}`;
      }
      out.push({ i, d });
    }
  return out;
}

// Rejilla hexagonal: dos capas corridas medio hexágono, como el fondo de lambda.
function hexGrid() {
  const w = HEX * Math.sqrt(3);
  const h = HEX * 2;
  const hex = (cx, cy) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      return `${k ? 'L' : 'M'}${n(cx + HEX * Math.cos(a))} ${n(cy + HEX * Math.sin(a))}`;
    }).join('') + 'Z';
  const centers = [[w / 2, h / 2], [0, 0], [w, 0], [0, h], [w, h]];
  return (
    `<pattern id="x" width="${n(w)}" height="${h}" patternUnits="userSpaceOnUse">` +
    `<path d="${centers.map(([cx, cy]) => hex(cx, cy)).join('')}" fill="none" stroke-width=".8"/></pattern>`
  );
}

// `data` es { text }; el texto ya viene validado por `lines`.
export function banner({ text }, t) {
  const rows = lines(text);
  const chalk = tokens.chalk[t.theme];
  const first = n(H / 2 - ((rows.length - 1) * LINE) / 2 + (CAP * SIZE) / 2);
  const ys = rows.map((_, k) => n(first + k * LINE));
  const items = doodles(random(SEED));
  const delay = (k) => `animation-delay:${WRITE * 0.5 + k * STAGGER}ms`;

  const objects = items
    .map((o, k) =>
      o.text
        ? `<text class="o" x="${n(o.x)}" y="${n(o.y)}" font-size="${o.size}" style="fill:${chalk[o.i % chalk.length]};${delay(k)}">${escapeXml(o.text)}</text>`
        : `<path class="d" d="${o.d}" pathLength="1" stroke="${chalk[o.i % chalk.length]}" style="${delay(k)}"/>`,
    )
    .join('');
  const words = rows.map((row, k) => `<text class="b" x="${PAD}" y="${ys[k]}" font-size="${SIZE}">${escapeXml(row)}</text>`).join('');
  // La máscara descubre cada línea de izquierda a derecha, una tras otra.
  const wipe = rows
    .map((row, k) => {
      const w = Math.ceil(measure(row, SIZE, 'bold')) + 6;
      const style = k ? ` style="animation-delay:${k * WRITE}ms"` : '';
      return `<rect class="w" x="${PAD - 3}" y="${n(ys[k] - SIZE)}" width="${w}" height="${LINE + 4}" fill="#fff"${style}/>`;
    })
    .join('');

  const defs =
    `<defs>${hexGrid()}` +
    // Grano de gis: el ruido se vuelve alfa y se come partes del trazo.
    `<filter id="g" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${SEED % 97}" result="r"/>` +
    `<feColorMatrix in="r" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.5 1.65" result="a"/>` +
    `<feComposite in="SourceGraphic" in2="a" operator="in"/></filter>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${wipe}</mask>` +
    `<g id="o" opacity="${ALPHA}">${objects}</g>` +
    `<g id="t" filter="url(#g)">${words}</g></defs>`;
  // Lo animado parte de su estado final: sin animación (o con reduced-motion)
  // el texto está escrito y los objetos trazados.
  const css =
    `#x path{stroke:${t.border}}.o{font-style:italic;animation:o ${DRAW}ms ease-out backwards}` +
    `.d{fill:none;stroke-width:1.2;stroke-linecap:round;stroke-dasharray:1;animation:d ${DRAW}ms ease-in-out backwards}` +
    `.w{transform-box:fill-box;transform-origin:0 0;animation:w ${WRITE}ms cubic-bezier(.4,.1,.6,1) backwards}` +
    `@keyframes o{from{opacity:0}}@keyframes d{from{stroke-dashoffset:1}}@keyframes w{from{transform:scaleX(0)}}` +
    `@media (prefers-reduced-motion:reduce){.o,.d,.w{animation:none}}`;
  const body =
    defs +
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="url(#x)" opacity=".3"/>` +
    `<use href="#o"/><use href="#o" transform="translate(1.5 1)" opacity=".35"/>` +
    `<g mask="url(#m)"><use href="#t"/><use href="#t" transform="translate(1.5 1)" opacity=".35"/></g>`;
  return svg({ width: W, height: H, t, title: label({ text }), body, css });
}

// `<title>` del SVG y `alt` del snippet (RNF-11): el texto tal cual se lee.
export const label = ({ text }) => text.trim().replace(/\s+/g, ' ');
