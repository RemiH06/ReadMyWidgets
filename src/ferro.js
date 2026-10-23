// Ferrofluido (widget E): una mancha negra en un plato redondo, como el
// ferrofluido sobre un imán. Sin datos. Gotas que giran en epiciclos (dos
// rotaciones de periodo distinto) alrededor del centro, donde estaría el imán,
// y se funden con un filtro gooey: el desenfoque suma las gotas en un solo
// campo y la tabla de alfa lo corta en un cuerpo de borde suave. El brillo es
// una banda del mismo campo corrida hacia arriba a la izquierda y recortada al
// cuerpo, como el reflejo de una luz sobre el líquido.
// El plato es un objeto, igual en los dos temas (como el disco de la matriz):
// claro para que el negro se vea, con el borde del tema contra la página.
// Cada rotación es CSS (`@keyframes` compartido) y arranca en 0: el primer
// cuadro es el mismo dibujo que queda con reduced-motion.
import tokens from './tokens.json' with { type: 'json' };
import { W } from './card.js';
import { n, svg } from './svg.js';
import { random } from './nixie.js';

const H = 220;
const CX = W / 2;
const CY = H / 2;
const DISH = 100; // radio del plato
const SEED = 0xfe770;
const DROPS = 7; // pocas gotas: el filtro se repinta en cada cuadro
const BLUR = 8; // stdDeviation del desenfoque
// Alfa del campo → alfa visible, en pasos de 0.1. Cuerpo: de 0.3 para arriba,
// con un paso suave para que el borde no salga dentado. Brillo: la forma de
// 0.6 para arriba (un poco adentro del borde) menos ella misma corrida en
// contra de la luz: queda una media luna del lado de arriba a la izquierda.
const BODY = '0 0 0 1 1 1 1 1 1 1 1';
const INNER = '0 0 0 0 0 0 1 1 1 1 1';
const SHIFT = 3;
// Alcance de una gota desde el centro: órbita + epiciclo + radio.
const ORBIT = [24, 44];
const EPI = [10, 26];
const RADIUS = [10, 18];
const REACH = ORBIT[1] + EPI[1] + RADIUS[1];

const between = (rand, [lo, hi]) => lo + (hi - lo) * rand();

function drops(rand) {
  return Array.from({ length: DROPS }, () => {
    const [a1, a2] = [rand() * 360, rand() * Math.PI * 2];
    const [r1, r2, r] = [between(rand, ORBIT), between(rand, EPI), between(rand, RADIUS)];
    // Lento: la órbita da la vuelta en 20 a 34 s y el epiciclo en 8 a 14.
    const [p1, p2] = [between(rand, [20000, 34000]), between(rand, [8000, 14000])];
    const spin = (p) => `animation-duration:${Math.round(p)}ms${rand() < 0.5 ? ';animation-direction:reverse' : ''}`;
    return (
      `<g class="o" style="${spin(p1)}"><g transform="rotate(${Math.round(a1)}) translate(${n(r1)} 0)">` +
      `<g class="o" style="${spin(p2)}"><circle cx="${n(r2 * Math.cos(a2))}" cy="${n(r2 * Math.sin(a2))}" r="${n(r)}"/></g></g></g>`
    );
  }).join('');
}

export function ferro(t) {
  const f = tokens.ferro;
  // La región del filtro se acota a la mancha más el halo del desenfoque.
  const m = REACH + 3 * BLUR;
  const filter =
    `<filter id="f" filterUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${2 * m}" height="${2 * m}" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur stdDeviation="${BLUR}" result="b"/>` +
    `<feComponentTransfer in="b" result="body"><feFuncA type="table" tableValues="${BODY}"/></feComponentTransfer>` +
    `<feComponentTransfer in="b" result="i"><feFuncA type="table" tableValues="${INNER}"/></feComponentTransfer>` +
    `<feOffset dx="${SHIFT}" dy="${SHIFT}" result="o"/><feComposite in="i" in2="o" operator="out" result="c"/>` +
    `<feFlood flood-color="${f.shine}"/><feComposite in2="c" operator="in" result="s"/>` +
    `<feMerge><feMergeNode in="body"/><feMergeNode in="s"/></feMerge></filter>`;
  const body =
    `<defs>${filter}</defs>` +
    `<circle cx="${CX}" cy="${CY}" r="${DISH}" fill="${f.dish}" stroke="${t.border}"/>` +
    `<g transform="translate(${CX} ${CY})" fill="${f.fluid}" filter="url(#f)">${drops(random(SEED))}</g>`;
  const css =
    `.o{animation:o linear infinite}@keyframes o{to{transform:rotate(360deg)}}` +
    `@media (prefers-reduced-motion:reduce){.o{animation:none}}`;
  // Sin caja: el contenedor es el plato.
  return svg({ width: W, height: H, t, title: LABEL, body, css, frame: false });
}

// `<title>` del SVG y `alt` del snippet (RNF-11).
export const LABEL = 'Ferrofluido: una mancha negra que se estira y se junta sobre un imán';
export { H, DISH, REACH };
