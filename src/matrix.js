// Matriz Glyph (widget C), como la del Nothing Phone (3) en RemsGlyphToys: los
// 489 LEDs reales de la rejilla de 25 × 25, recortada en disco. La matriz solo
// tiene brillo, sin color: LEDs blancos sobre un disco oscuro, igual en los dos
// temas porque es un objeto (como el tubo nixie). Tres modos, cada uno con un
// solo `@keyframes`:
//   text   letras de 5 × 5 de GlyphFactory que corren de derecha a izquierda,
//          un LED por paso; si caben, quietas y centradas
//   pulse  una onda que sale del centro: el retraso de cada LED es su distancia
//   fluid  deriva lenta: fase y duración de cada LED salen de un campo de ruido
// Sin animación (o con reduced-motion) cada LED queda en el brillo de su
// primer cuadro, que se calcula aquí y va en `opacity`.
import tokens from './tokens.json' with { type: 'json' };
import { W } from './card.js';
import { n, svg } from './svg.js';
import { random } from './nixie.js';

export const MODES = ['text', 'pulse', 'fluid'];

const SIZE = 25;
// LEDs por fila, centrados (GlyphFrames.ROW_SPANS de RemsGlyphToys): 489.
const SPANS = [7, 11, 15, 17, 19, 21, 21, 23, 23, 25, 25, 25, 25, 25, 25, 25, 23, 23, 21, 21, 19, 17, 15, 11, 7];
const PITCH = 10;
const LED = 7.8; // diámetro: 78 % del paso, como GlyphMatrixCanvas
const DISC = PITCH * (12.5 + 0.9); // el disco asoma casi un paso más allá de los LEDs
const PAD = 16;
const H = Math.ceil(2 * (DISC + PAD));
const CX = W / 2;
const CY = H / 2;
const x = (c) => CX + (c - 12) * PITCH;
const y = (r) => CY + (r - 12) * PITCH;
const LEDS = SPANS.flatMap((span, r) => Array.from({ length: span }, (_, k) => [r, (SIZE - span) / 2 + k]));
const OFF = 0.1; // brillo mínimo de la capa encendida sobre el LED apagado

// Letras de 5 × 5 de 38.GlyphFactory/json/ (uppercase5x5 y numbers5x5), por
// renglón. El espacio, el guion (logins como `mi-usuario`) y los signos son de aquí.
const GLYPHS = {
  A: '01110 10001 11111 10001 10001', B: '11110 10001 11110 10001 11110', C: '01110 10001 10000 10001 01110',
  D: '11110 10001 10001 10001 11110', E: '11111 10000 11110 10000 11111', F: '11111 10000 11110 10000 10000',
  G: '01110 10000 10011 10001 01110', H: '10001 10001 11111 10001 10001', I: '11111 00100 00100 00100 11111',
  J: '11111 00100 00100 10100 01100', K: '10001 10010 11100 10010 10001', L: '10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10001 10001', N: '10001 11001 10101 10011 10001', O: '01110 10001 10001 10001 01110',
  P: '11110 10001 11110 10000 10000', Q: '01110 10001 10001 10010 01101', R: '11110 10001 11110 10010 10001',
  S: '01111 10000 01110 00001 11110', T: '11111 00100 00100 00100 00100', U: '10001 10001 10001 10001 01110',
  V: '10001 10001 01010 01010 00100', W: '10001 10001 10001 10101 01010', X: '10001 01010 00100 01010 10001',
  Y: '10001 01010 00100 00100 00100', Z: '11111 00010 00100 01000 11111',
  0: '01110 10001 10101 10001 01110', 1: '00100 01100 00100 00100 01110', 2: '01100 10010 00100 01000 11110',
  3: '01100 10010 00100 10010 01100', 4: '10010 10010 11110 00010 00010', 5: '11110 10000 01100 00010 11100',
  6: '01110 10000 11100 10010 01100', 7: '11110 00100 01000 01000 01000', 8: '01100 10010 01100 10010 01100',
  9: '01100 10010 01110 00010 11100', '-': '0000 0000 0111 0000 0000', ' ': '00 00 00 00 00',
  '.': '0 0 0 0 1', ',': '00 00 00 01 10', ':': '0 1 0 1 0', '!': '1 1 1 0 1', '?': '1110 0001 0110 0000 0100',
};
const TEXT_ROW = 10; // renglones 10 a 14: los del centro tienen los 25 LEDs
const STEP = 90; // ms por columna al correr
const REST = 1; // columna del primer cuadro: la primera letra entra entera

// Sin acentos y en mayúsculas (Á → A, ñ → N). Lo que no tiene letra falla.
export function glyphText(str) {
  const clean = str.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim().replace(/\s+/g, ' ');
  const bad = [...new Set([...clean].filter((c) => !(c in GLYPHS)))];
  if (bad.length) throw new Error(`matrix: no hay letra de 5×5 para ${bad.map((c) => `"${c}"`).join(', ')}; usa A-Z, 0-9, espacio, - . , : ! ?`);
  if (!clean) throw new Error('matrix: el texto está vacío');
  return clean;
}

// Columnas encendidas del texto, desde la 0, y su ancho. Cada letra mide hasta
// su última columna con algo (los números son de 4) y lleva una de separación.
function columns(str) {
  const dots = [];
  let col = 0;
  for (const c of str) {
    const rows = GLYPHS[c].split(' ');
    const width = c === ' ' ? 2 : Math.max(...rows.map((r) => r.lastIndexOf('1') + 1));
    rows.forEach((row, r) => [...row.slice(0, width)].forEach((on, k) => on === '1' && dots.push([TEXT_ROW + r, col + k])));
    col += width + 1;
  }
  return { dots, width: col - 1 };
}

// Un LED es un trazo de largo cero con punta redonda: ~10 bytes cada uno.
const dot = ([r, c]) => `M${n(x(c))} ${n(y(r))}h0`;

// Ruido de valor con semilla fija: rejilla de 6 × 6 interpolada con smoothstep.
function noise(rand) {
  const LAT = 6;
  const v = Array.from({ length: LAT * LAT }, rand);
  const s = (t) => t * t * (3 - 2 * t);
  return (r, c) => {
    const [fr, fc] = [(r / (SIZE - 1)) * (LAT - 1), (c / (SIZE - 1)) * (LAT - 1)];
    const [i, j] = [Math.min(LAT - 2, Math.floor(fr)), Math.min(LAT - 2, Math.floor(fc))];
    const [u, w] = [s(fr - i), s(fc - j)];
    const at = (a, b) => v[(i + a) * LAT + j + b];
    return (at(0, 0) * (1 - w) + at(0, 1) * w) * (1 - u) + (at(1, 0) * (1 - w) + at(1, 1) * w) * u;
  };
}

const PULSE = 2400; // ms por onda
const SPEED = 80; // ms por paso de distancia al centro
const FRONT = 6; // en el primer cuadro la onda va a 6 LEDs del centro
const FADE = 0.4; // fracción del ciclo en que un LED se apaga tras la onda
const SEED = 0x91f0;
const ease = (u) => 1 - (1 - u) ** 3; // cerca de cubic-bezier(.2,.7,.3,1)
const smooth = (u) => u * u * (3 - 2 * u); // cerca de ease-in-out
// fluid: apagado casi todo el ciclo; sube a RISE, llega al pico en PEAK y baja.
const RISE = 0.6;
const PEAK = 0.8;
const BANDS = 3; // vueltas de fase a lo ancho del ruido: manchas con contorno
const glow = (p) =>
  p < RISE ? OFF : OFF + (1 - OFF) * smooth(p < PEAK ? (p - RISE) / (PEAK - RISE) : (1 - p) / (1 - PEAK));

// Cada modo da los LEDs encendidos (con su brillo inicial y su `style`) y su CSS.
const MODE = {
  pulse() {
    const leds = LEDS.map(([r, c]) => {
      const d = Math.hypot(r - 12, c - 12);
      // Local: cuánto lleva el LED desde que pasó la onda, en el primer cuadro.
      const local = (((FRONT - d) * SPEED) % PULSE + PULSE) % PULSE;
      const u = local / PULSE;
      const o = u < FADE ? 1 - (1 - OFF) * ease(u / FADE) : OFF;
      return { r, c, o, style: `animation-delay:${-Math.round(local)}ms` };
    });
    const css =
      `.l{animation:p ${PULSE}ms infinite}` +
      `@keyframes p{0%{opacity:1;animation-timing-function:cubic-bezier(.2,.7,.3,1)}${FADE * 100}%,100%{opacity:${OFF}}}`;
    return { leds, css };
  },
  fluid() {
    const rand = random(SEED);
    const [phase, speed] = [noise(rand), noise(rand)];
    const leds = LEDS.map(([r, c]) => {
      // El ruido de valor se junta cerca de 0.5: sin las bandas, casi todos
      // los LEDs estarían en la misma fase.
      const p = (phase(r, c) * BANDS) % 1;
      // 6 a 8 s: con poca diferencia entre vecinos, las manchas siguen siendo
      // manchas por varios minutos antes de desfasarse.
      const dur = Math.round(6000 + 2000 * speed(r, c));
      const o = glow(p);
      return { r, c, o, style: `animation-duration:${dur}ms;animation-delay:${-Math.round(p * dur)}ms` };
    });
    const css = `.l{animation:f 7s ease-in-out infinite}@keyframes f{0%,${RISE * 100}%,100%{opacity:${OFF}}${PEAK * 100}%{opacity:1}}`;
    return { leds, css };
  },
};

// `data` es { mode, text }; `text` solo en el modo text, ya pasado por glyphText.
export function matrix({ mode, text }, t) {
  const g = tokens.glyph;
  let lit;
  let css = '';
  if (mode === 'text') {
    const { dots, width } = columns(text);
    // Si cabe, quieto y centrado; si no, corre en pasos de un LED y parte de
    // su primer cuadro (la primera letra en la columna REST).
    const fits = width <= SIZE;
    const start = fits ? Math.floor((SIZE - width) / 2) : REST;
    const d = dots.map(([r, c]) => dot([r, c + start])).join('');
    lit = `<g mask="url(#k)"><path class="t" d="${d}" stroke="${g.on}"/></g>`;
    if (!fits) {
      const steps = SIZE + width;
      css =
        `.t{animation:s ${steps * STEP}ms steps(${steps}) ${-(SIZE - REST) * STEP}ms infinite}` +
        `@keyframes s{from{transform:translateX(${(SIZE - REST) * PITCH}px)}to{transform:translateX(${-(width + REST) * PITCH}px)}}` +
        `@media (prefers-reduced-motion:reduce){.t{animation:none}}`;
    }
  } else {
    const { leds, css: own } = MODE[mode]();
    lit = leds.map((l) => `<path class="l" d="${dot([l.r, l.c])}" opacity="${l.o.toFixed(2)}" style="${l.style}"/>`).join('');
    lit = `<g stroke="${g.on}">${lit}</g>`;
    css = own + `@media (prefers-reduced-motion:reduce){.l{animation:none}}`;
  }
  const body =
    `<defs><path id="d" d="${LEDS.map(dot).join('')}"/>` +
    (mode === 'text' ? `<mask id="k" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><use href="#d" stroke="#fff"/></mask>` : '') +
    `</defs>` +
    `<circle cx="${CX}" cy="${CY}" r="${n(DISC)}" fill="${g.disc}" stroke="${t.border}"/>` +
    `<use href="#d" stroke="${g.off}"/>` +
    lit;
  css = `path{fill:none;stroke-width:${LED};stroke-linecap:round}` + css;
  return svg({ width: W, height: H, t, title: label({ mode, text }), body, css });
}

// `<title>` del SVG y `alt` del snippet (RNF-11).
export function label({ mode, text }) {
  if (mode === 'text') return `Matriz Glyph de 489 LEDs con el texto "${text}"`;
  if (mode === 'pulse') return 'Matriz Glyph de 489 LEDs: una onda de luz que sale del centro';
  return 'Matriz Glyph de 489 LEDs: manchas de luz que derivan lentamente';
}
