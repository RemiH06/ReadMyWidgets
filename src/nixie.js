// Tubos nixie (widget D): una cifra del perfil en tubos IN-14, como los de
// forge. `stars` suma las estrellas de los repos públicos propios (sin forks);
// `commits` cuenta las contribuciones de commits de un año. Al cargar, cada
// tubo recorre cátodos al azar y se asienta (8 saltos de 120 ms, 60 ms entre
// tubos), con CSS y semilla fija. El tubo es un objeto: igual en los dos temas.
import tokens from './tokens.json' with { type: 'json' };
import { W } from './card.js';
import { n, svg, text } from './svg.js';
import { truncate } from './text.js';

export const KINDS = ['stars', 'commits'];

const PAD = 24;
const INNER = W - PAD * 2;
const TUBE_W = 48;
const TUBE_H = 80;
const DOME = 18; // alto del domo de vidrio
const BASE = 8; // zócalo
const GAP = 8;
const MIN_TUBES = 4; // los de la izquierda quedan apagados, como un contador
const TOP = 24;
const MAX_SCALE = 1.3; // cuatro tubos a 48 dejan media ficha vacía
const CAPTION = 30; // de la base de los tubos a la línea base del pie
const BODY = 15;
const BOTTOM = 28;
const FLIPS = 8;
const FLIP = 120;
const STAGGER = 60;
const SEED = 0x6e1c;

// Cifras de alambre en una caja de 24 × 40: trazo uniforme, altas y angostas (IN-14).
const DIGITS = [
  'M12 0C5 0 2 6 2 20S5 40 12 40S22 34 22 20S19 0 12 0Z',
  'M8 5L13 0V40',
  'M3 9C3 3 7 0 12 0S21 3 21 9C21 16 14 22 3 40H22',
  'M3 1H20L10 15C17 15 22 20 22 28S17 40 11 40S3 37 2 33',
  'M17 40V0L2 28H23',
  'M20 1H5L3 18C5 15 8 14 12 14C18 14 22 19 22 27S18 40 12 40S4 37 2 33',
  'M19 2C17 1 15 0 12 0C6 0 2 8 2 22C2 34 6 40 12 40S22 35 22 27S18 15 12 15S3 20 2 25',
  'M2 1H22L9 40',
  'M12 18C7 18 4 15 4 9S7 0 12 0S20 3 20 9S17 18 12 18C6 18 2 22 2 29S6 40 12 40S22 36 22 29S18 18 12 18Z',
  'M5 38C7 39 9 40 12 40C18 40 22 32 22 18C22 6 18 0 12 0S2 5 2 13S6 25 12 25S21 20 22 15',
];

// mulberry32: lo aleatorio sale igual en cada corrida (RNF-04).
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS = `query($login: String!, $cursor: String) { repositoryOwner(login: $login) {
  repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
    nodes { stargazerCount } pageInfo { hasNextPage endCursor } } } }`;
const COMMITS = `query($login: String!, $from: DateTime!, $to: DateTime!) { user(login: $login) {
  contributionsCollection(from: $from, to: $to) { totalCommitContributions } } }`;

// La cifra de `kind` para `login`; `year` solo cuenta para commits.
export async function fetchCount(kind, login, year, graphql) {
  const fail = (why) => {
    throw new Error(`nixie: ${kind} de ${login}: ${why}`);
  };
  const ask = async (query, variables) => {
    try {
      return await graphql(query, { login, ...variables });
    } catch (err) {
      return fail(err.message);
    }
  };
  if (kind === 'commits') {
    const res = await ask(COMMITS, { from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` });
    const count = res.data?.user?.contributionsCollection?.totalCommitContributions;
    return count ?? fail(res.errors?.[0]?.message ?? 'no es un usuario');
  }
  let total = 0;
  let cursor = null;
  do {
    const repos = (await ask(STARS, { cursor })).data?.repositoryOwner?.repositories;
    if (!repos) fail('no existe');
    total += repos.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
    cursor = repos.pageInfo.hasNextPage ? repos.pageInfo.endCursor : null;
  } while (cursor);
  return total;
}

const format = (count) => new Intl.NumberFormat('es-MX').format(count);

// `<title>` del SVG y `alt` del snippet (RNF-11).
export const label = ({ kind, login, year, count }) =>
  kind === 'stars'
    ? `${login}: ${format(count)} estrellas en sus repos públicos`
    : `${login}: ${format(count)} commits en ${year}`;

const caption = ({ kind, login, year }) =>
  kind === 'stars' ? `Estrellas en los repos públicos de ${login}` : `Commits de ${login} en ${year}`;

// Un tubo: vidrio con rejilla de ánodo, los diez cátodos apagados, los saltos
// y la cifra final (o nada, si el tubo queda apagado).
function tube(i, digit, rand) {
  const flips = Array.from({ length: FLIPS }, (_, k) => {
    const d = Math.floor(rand() * 10);
    return `<use href="#d${d}" class="f" style="animation-delay:${i * STAGGER + k * FLIP}ms"/>`;
  });
  const settle = i * STAGGER + FLIPS * FLIP;
  const lit = digit === null ? '' : `<use href="#d${digit}" class="z" style="animation-duration:${settle}ms"/>`;
  return (
    `<g transform="translate(${n(i * (TUBE_W + GAP))} 0)">` +
    `<use href="#t"/><g transform="translate(10.8 14) scale(1.1)"><use href="#c"/>${flips.join('')}${lit}</g></g>`
  );
}

// `data` es { kind, login, year, count }.
export function nixie(data, theme) {
  const t = tokens.themes[theme];
  const x = tokens.nixie;
  const digits = String(data.count);
  const count = Math.max(MIN_TUBES, digits.length);
  // Crecen hasta MAX_SCALE; si no caben, todos se encogen igual.
  // Hacia abajo: redondeada hacia arriba, nueve tubos se pasan del ancho.
  const scale = Math.floor(Math.min(MAX_SCALE, INNER / (count * (TUBE_W + GAP) - GAP)) * 100) / 100;
  const captionY = n(TOP + TUBE_H * scale + CAPTION);
  const padded = digits.padStart(count, ' ');
  const rand = random(SEED);
  const tubes = [...padded].map((c, i) => tube(i, c === ' ' ? null : +c, rand));

  const glass = `M0 ${TUBE_H}V${DOME}A${TUBE_W / 2} ${DOME} 0 0 1 ${TUBE_W} ${DOME}V${TUBE_H}Z`;
  const defs =
    `<defs>` +
    DIGITS.map((d, i) => `<path id="d${i}" d="${d}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join('') +
    `<g id="c">${DIGITS.map((_, i) => `<use href="#d${i}"/>`).join('')}</g>` +
    `<pattern id="m" width="7" height="12" patternUnits="userSpaceOnUse">` +
    `<path d="M0 0L7 12M7 0L0 12" stroke="${x.glow}" stroke-opacity=".14" stroke-width=".6"/></pattern>` +
    `<filter id="g" x="-60%" y="-30%" width="220%" height="160%">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="b"/>` +
    `<feFlood flood-color="${x.glow}"/><feComposite in2="b" operator="in" result="h"/>` +
    `<feMerge><feMergeNode in="h"/><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<g id="t"><path d="${glass}" fill="${x.tube}" stroke="${t.border}"/><path d="${glass}" fill="url(#m)"/>` +
    `<rect x="0.5" y="${TUBE_H - BASE}" width="${TUBE_W - 1}" height="${BASE - 0.5}" fill="${x.base}"/></g>` +
    `</defs>`;
  // Lo animado parte de su estado quieto: sin animación (o con reduced-motion)
  // los saltos no se ven y la cifra final sí.
  const css =
    `#c{stroke:${x.cathode}}` +
    `.f,.z{stroke:${x.digit};filter:url(#g)}.f{opacity:0;animation:f ${FLIP}ms linear}` +
    `.z{animation:z linear}@keyframes f{from,to{opacity:.6}}@keyframes z{from,to{opacity:0}}` +
    `@media (prefers-reduced-motion:reduce){.f,.z{animation:none}}`;
  const body =
    defs +
    `<g transform="translate(${PAD} ${TOP}) scale(${scale})">${tubes.join('')}</g>` +
    text(PAD, captionY, BODY, truncate(caption(data), BODY, INNER), 'dim');
  return svg({ width: W, height: Math.ceil(captionY + BOTTOM), theme, title: label(data), body, css });
}
