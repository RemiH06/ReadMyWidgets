// Hexagramas del I Ching (widget B), como Raimei Hakke de lambda: un hexagrama
// por semana de lunes a domingo, las 52 completas más recientes de la gráfica
// de contribuciones. Lunes a viernes son las líneas 1 a 5 (de abajo hacia
// arriba) y el fin de semana junto la 6: entera si hubo al menos una
// contribución, partida si no. Al cargar, el trueno cae en la última semana:
// cada hexagrama parte girado hacia él, tenue según la distancia (las piezas
// de Magnet Lines), y se endereza en una onda que sale de ahí. Todo con CSS.
import tokens from './tokens.json' with { type: 'json' };
import { W } from './card.js';
import { n, svg, text } from './svg.js';
import { truncate } from './text.js';

export const WEEKS = 52;
const PAD = 24;
const INNER = W - PAD * 2;
const COLS = 13; // un trimestre por renglón
const ROWS = WEEKS / COLS;
const CELL = INNER / COLS;
// Proporciones de lambda (48 de ancho en una celda de 70: 68 %; líneas de 5.6
// cada 9.4, hueco de 8): con menos, el hueco de una línea partida se confunde
// con el que hay entre hexagramas.
const HEX_W = 18;
const THICK = 2.1;
const PITCH = 3.5;
const HEX_H = 5 * PITCH + THICK;
const GAP = 3; // hueco de la línea partida
const ROW_H = 34;
const TOP = 24;
const CAPTION = 30; // del último renglón a la línea base del pie
const BODY = 15;
const BOTTOM = 28;
const SETTLE = 900;
const WAVE = 2; // ms por unidad de distancia al trueno
const REACH = 220; // como en raimei-hakke.js: a esa distancia ya no se enciende

const CALENDAR = `query($login: String!) { user(login: $login) { contributionsCollection {
  contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`;

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Las 52 semanas completas (lunes a domingo) que terminan antes del último día
// del calendario: el de hoy aún no acaba. Cada semana es { from, to, lines },
// con `lines` de abajo hacia arriba.
export function weeks(days) {
  const count = new Map(days.map((d) => [d.date, d.contributionCount]));
  const last = Date.parse(days.at(-1).date);
  // getUTCDay: domingo 0. El domingo más reciente estrictamente antes de `last`.
  const sunday = last - (new Date(last).getUTCDay() || 7) * DAY;
  const out = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const monday = sunday - (w * 7 + 6) * DAY;
    const active = Array.from({ length: 7 }, (_, d) => {
      const c = count.get(iso(monday + d * DAY));
      if (c === undefined) throw new Error(`iching: el calendario no trae ${iso(monday + d * DAY)}`);
      return c > 0;
    });
    out.push({ from: iso(monday), to: iso(monday + 6 * DAY), lines: [...active.slice(0, 5), active[5] || active[6]], days: active });
  }
  return out;
}

export async function fetchWeeks(login, graphql) {
  let res;
  try {
    res = await graphql(CALENDAR, { login });
  } catch (err) {
    throw new Error(`iching: calendario de ${login}: ${err.message}`);
  }
  const cal = res.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error(`iching: calendario de ${login}: ${res.errors?.[0]?.message ?? 'no es un usuario'}`);
  return weeks(cal.weeks.flatMap((w) => w.contributionDays));
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const date = (s) => `${+s.slice(8)} ${MONTHS[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;
const range = (w) => `${date(w[0].from)} a ${date(w.at(-1).to)}`;
// El pie lleva solo meses: los días exactos están en el `alt`. La fecha va
// primero para que, si un login largo no cabe, se corte el login.
const month = (s) => `${MONTHS[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;
const caption = ({ login, weeks: w }) => {
  const from = month(w[0].from);
  return `${from[0].toUpperCase()}${from.slice(1)} a ${month(w.at(-1).to)}: semanas de ${login}`;
};

// `<title>` del SVG y `alt` del snippet (RNF-11).
export function label({ login, weeks: w }) {
  const days = w.reduce((sum, x) => sum + x.days.filter(Boolean).length, 0);
  return `${login}: 52 semanas de contribuciones como hexagramas del I Ching, ${range(w)}; ${days} de 364 días con contribuciones`;
}

// Un hexagrama como un solo trazo de rectángulos, en coordenadas absolutas:
// el `transform` de CSS lo gira sobre su centro.
function hexagram(x, y, lines) {
  const half = (HEX_W - GAP) / 2;
  return lines
    .map((yang, k) => {
      const top = n(y + HEX_H - THICK - k * PITCH);
      const bar = (x0, w) => `M${n(x0)} ${top}h${n(w)}v${THICK}h${n(-w)}z`;
      return yang ? bar(x, HEX_W) : bar(x, half) + bar(x + half + GAP, half);
    })
    .join('');
}

// `data` es { login, weeks } de `fetchWeeks`. Un color de gis por renglón (un
// trimestre): en lambda cambia en cada pieza, pero aquí 52 colores alternados
// tapan el dato.
export function iching(data, t) {
  const chalk = tokens.chalk[t.theme];
  const center = (i) => [PAD + (i % COLS + 0.5) * CELL, TOP + Math.floor(i / COLS) * ROW_H + HEX_H / 2];
  const [sx, sy] = center(WEEKS - 1);
  const pieces = data.weeks.map((w, i) => {
    const [cx, cy] = center(i);
    const dx = sx - cx;
    const dy = sy - cy;
    const dist = Math.hypot(dx, dy);
    // Como Magnet Lines, pero una línea apunta igual a 180°: el giro más corto.
    let deg = dist ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
    if (deg > 90) deg -= 180;
    if (deg <= -90) deg += 180;
    const o = 0.42 + 0.58 * Math.max(0, 1 - dist / REACH);
    const style = `--r:${Math.round(deg)}deg;--o:${o.toFixed(2)};animation-delay:${Math.round(dist * WAVE)}ms`;
    return `<path d="${hexagram(cx - HEX_W / 2, cy - HEX_H / 2, w.lines)}" fill="${chalk[Math.floor(i / COLS)]}" style="${style}"/>`;
  });
  const captionY = n(TOP + (ROWS - 1) * ROW_H + HEX_H + CAPTION);
  // Parte de su estado final con `backwards`: sin animación (o con
  // reduced-motion) los hexagramas están derechos y enteros.
  const css =
    `path{transform-box:fill-box;transform-origin:center;animation:h ${SETTLE}ms cubic-bezier(.2,.7,.3,1) backwards}` +
    `@keyframes h{from{transform:rotate(var(--r));opacity:var(--o)}}` +
    `@media (prefers-reduced-motion:reduce){path{animation:none}}`;
  const body = pieces.join('') + text(PAD, captionY, BODY, truncate(caption(data), BODY, INNER), 'dim');
  return svg({ width: W, height: Math.ceil(captionY + BOTTOM), t, title: label(data), body, css });
}
