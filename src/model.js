// Objeto 3D girando (widget F), como los de
// 37.iroFactory/shared/components/model-stage/model-stage.js. Dos fuentes:
//   discoball  la bola disco de model-stage: anillos de espejos plateados, uno
//              de cada tres (al azar) teñido del acento, con inclinación al azar por espejo
//   un .glb    del consumidor, sin compresión (meshopt y Draco piden dependencia)
// Dentro de `<img>` no hay JS: girarlo con el mouse no se puede.
//
// La bola se ve de frente al ecuador y en ortográfica, así que cada espejo
// recorre su anillo como un seno: x = r·sen θ, ancho ∝ cos θ. Eso es un solo
// `@keyframes` compartido por todos los espejos, con el retraso de su longitud;
// la luz es otro, de brillo según θ. La bola no tiene simetría de un paso de
// espejo (cada anillo tiene su número de espejos), así que en vez de cuadros
// cada espejo se anima solo: más fluido y más ligero (cambio anotado en PLAN.md).
//
// El GLB sí va por cuadros: se gira en Y, se proyecta, se quitan las caras
// traseras, se sombrea plano, se ordena de atrás hacia adelante y cada cuadro
// es un `<g>` que se enciende un paso del ciclo (`steps`). Si no cabe en
// 100 KB, falla con cuántos triángulos trae y cuántos caben (RF-06).
//
// Sin animación o con reduced-motion se queda el primer cuadro: la pose
// inicial va en los atributos, que la animación CSS tapa mientras corre.
import { basename } from 'node:path';
import tokens from './tokens.json' with { type: 'json' };
import { W } from './card.js';
import { n, svg } from './svg.js';
import { random } from './nixie.js';

const H = 220;
const CX = W / 2;
const CY = H / 2;
const R = 96; // radio del objeto en pantalla
const SPIN = 18000; // una vuelta, ms (model-stage: 0.35 rad/s)
const MAX = 100 * 1024; // RNF-01, como en cli.js
export const FRAMES = [4, 72]; // cuadros por vuelta del GLB
const DEFAULT_FRAMES = 24;

// ── Color, en lineal para mezclar y sombrear como Three.js
const toLinear = (hex) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
const toHex = (rgb) =>
  '#' +
  rgb
    .map((c) => {
      const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, '0');
    })
    .join('');
const mix = (a, b, k) => toHex(toLinear(a).map((c, i) => c + (toLinear(b)[i] - c) * k));

// ── Bola disco
const RINGS = 18;
const EQUATOR = 36; // espejos en el anillo del ecuador
const GAP = 0.88; // fracción del hueco que ocupa el espejo; el resto deja ver el núcleo
const TILT = 7; // grados: los espejos nunca quedan parejos
const LIGHT = -40; // longitud de la luz; el brillo especular queda a la mitad
const STOPS = 72; // pasos del `@keyframes`, de 5°
const SEED = 0xd15c0;

const rad = (d) => (d * Math.PI) / 180;
// Brillo de un espejo en la longitud θ (grados, 0 de frente): ambiente,
// difusa y un destello estrecho donde refleja la luz hacia quien ve.
const glow = (θ) =>
  Math.cos(rad(θ)) <= 0
    ? 0
    : Math.min(1, 0.14 + 0.46 * Math.max(0, Math.cos(rad(θ - LIGHT))) + 0.9 * Math.max(0, Math.cos(rad(θ - LIGHT / 2))) ** 24);

function keyframes() {
  // Solo la cara de frente (θ en [-90, 90]); por detrás se interpola invisible.
  const front = Array.from({ length: STOPS + 1 }, (_, s) => (s * 360) / STOPS).filter((θ) => Math.cos(rad(θ)) >= -1e-9);
  const pct = (θ) => n((θ / 360) * 100);
  const move = front
    .map((θ) => `${pct(θ)}%{transform:translateX(${n(Math.sin(rad(θ)))}px) scaleX(${n(Math.max(0, Math.cos(rad(θ))))})}`)
    .join('');
  const light = front.map((θ) => `${pct(θ)}%{opacity:${n(glow(θ))}}`).join('');
  return `@keyframes m{${move}}@keyframes l{${light}}`;
}

function discoball(t) {
  const d = tokens.disco;
  const colors = { s: mix(d.silver, t.accent, 0.18), a: mix(d.silver, t.accent, 0.75) };
  const rand = random(SEED);
  const dφ = Math.PI / RINGS;
  const defs = [];
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const φ = (i + 0.5) * dφ; // desde el polo de arriba
    const count = Math.max(1, Math.round(Math.sin(φ) * EQUATOR));
    const r = R * Math.sin(φ);
    // Alto proyectado de la franja del anillo y ancho del espejo en el círculo unitario.
    const h = 2 * R * Math.sin(φ) * Math.sin(dφ / 2) * GAP;
    const w = ((2 * Math.PI) / count) * GAP;
    defs.push(`<rect id="t${i}" x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}"/>`);
    const tiles = [];
    for (let j = 0; j < count; j++) {
      const θ = ((j + (i % 2) * 0.5) / count) * 360;
      const tilt = (rand() - 0.5) * 2 * TILT;
      // Al azar y no `k % 3` como en model-stage: con anillos parejos, el índice dibuja diagonales.
      const tint = rand() < 1 / 3;
      const delay = (deg) => -Math.round(((((deg % 360) + 360) % 360) / 360) * SPIN);
      // De espaldas no se ve aunque la inclinación lo ponga de frente a la luz.
      const front = Math.cos(rad(θ)) > 0;
      const o = front ? glow(θ + tilt) : 0;
      const pose = front ? ` transform="translate(${n(Math.sin(rad(θ)))} 0) scale(${n(Math.cos(rad(θ)))} 1)"` : '';
      tiles.push(
        `<use href="#t${i}" class="t ${tint ? 'a' : 's'}"${pose} opacity="${n(o)}" ` +
          `style="animation-delay:${delay(θ)}ms,${delay(θ + tilt)}ms"/>`,
      );
    }
    // La luz es casi horizontal: los anillos cerca de los polos la reciben de lado.
    const y = CY - R * Math.cos(φ);
    rings.push(`<g transform="translate(${CX} ${n(y)}) scale(${n(r)} 1)" opacity="${n(0.4 + 0.6 * Math.sin(φ))}">${tiles.join('')}</g>`);
  }
  const body = `<defs>${defs.join('')}</defs><circle cx="${CX}" cy="${CY}" r="${R}" fill="${d.core}"/>${rings.join('')}`;
  const css =
    `.s{fill:${colors.s}}.a{fill:${colors.a}}` +
    `.t{animation:m ${SPIN}ms linear infinite,l ${SPIN}ms linear infinite}${keyframes()}` +
    `@media (prefers-reduced-motion:reduce){.t{animation:none}}`;
  return { body, css };
}

// ── GLB (glTF 2.0 binario)
const COMPONENTS = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZES = { SCALAR: 1, VEC3: 3 };

// Triángulos en el espacio del modelo, cada uno con su color base: [[a, b, c, hex], …].
export function parseGlb(buffer, name = 'model') {
  const fail = (why) => {
    throw new Error(`model: ${name} ${why}`);
  };
  const buf = Buffer.from(buffer);
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) fail('no es un .glb (glTF binario)');
  if (buf.readUInt32LE(4) !== 2) fail(`es glTF ${buf.readUInt32LE(4)}; solo se lee glTF 2`);
  let json;
  let bin;
  for (let at = 12; at + 8 <= buf.length; ) {
    const [len, type] = [buf.readUInt32LE(at), buf.readUInt32LE(at + 4)];
    const chunk = buf.subarray(at + 8, at + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) bin = chunk;
    at += 8 + len;
  }
  if (!json) fail('no trae el bloque JSON');
  const required = json.extensionsRequired ?? [];
  if (required.length)
    fail(`pide ${required.join(', ')}; expórtalo sin compresión ni cuantización (en glTF-Transform: gltf-transform copy entrada.glb salida.glb)`);

  const read = (index, what) => {
    const acc = json.accessors?.[index];
    if (!acc) fail(`no tiene el accessor ${index} (${what})`);
    if (acc.sparse) fail(`usa accessors dispersos (${what}), que no se leen`);
    const Type = COMPONENTS[acc.componentType];
    const size = SIZES[acc.type];
    if (!Type || !size || acc.normalized) fail(`tiene ${what} en un formato que no se lee (${acc.type}, ${acc.componentType})`);
    const view = json.bufferViews[acc.bufferView];
    if ((view.buffer ?? 0) !== 0 || json.buffers?.[0]?.uri !== undefined || !bin) fail('guarda su geometría en un archivo aparte; usa un .glb con todo adentro');
    const stride = view.byteStride || Type.BYTES_PER_ELEMENT * size;
    const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const get = { 1: 'readUInt8', 2: 'readUInt16LE', 4: 'readUInt32LE' }[Type.BYTES_PER_ELEMENT];
    const out = [];
    for (let i = 0; i < acc.count; i++) {
      const at = base + i * stride;
      const item = Array.from({ length: size }, (_, c) =>
        Type === Float32Array ? bin.readFloatLE(at + c * 4) : bin[get](at + c * Type.BYTES_PER_ELEMENT),
      );
      out.push(size === 1 ? item[0] : item);
    }
    return out;
  };

  const tris = [];
  const visit = (index, parent) => {
    const node = json.nodes[index];
    const m = multiply(parent, local(node));
    if (node.mesh !== undefined) {
      for (const p of json.meshes[node.mesh].primitives) {
        if ((p.mode ?? 4) !== 4) fail('tiene primitivas que no son triángulos (líneas, puntos o tiras)');
        const pos = read(p.attributes.POSITION, 'POSITION').map((v) => apply(m, v));
        const idx = p.indices === undefined ? pos.map((_, i) => i) : read(p.indices, 'índices');
        const factor = json.materials?.[p.material]?.pbrMetallicRoughness?.baseColorFactor ?? [0.6, 0.6, 0.6, 1];
        const color = toHex(factor.slice(0, 3));
        for (let i = 0; i + 2 < idx.length; i += 3) tris.push([pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]], color]);
      }
    }
    for (const child of node.children ?? []) visit(child, m);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  const roots = scene?.nodes ?? (json.nodes ?? []).map((_, i) => i);
  for (const root of roots) visit(root, IDENTITY);
  if (!tris.length) fail('no trae triángulos');
  return tris;
}

// Matrices de 4 × 4 en el orden de glTF (por columnas).
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = [0, 1, 2, 3].reduce((s, k) => s + a[k * 4 + r] * b[c * 4 + k], 0);
  return out;
}
function local({ matrix, translation: [tx, ty, tz] = [0, 0, 0], rotation: [x, y, z, w] = [0, 0, 0, 1], scale: [sx, sy, sz] = [1, 1, 1] }) {
  if (matrix) return matrix;
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const apply = (m, [x, y, z]) => [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);

const VIEW_TILT = 0.25; // rad: se ve un poco desde arriba, como en model-stage
const SUN = (() => {
  const v = [-0.45, 0.55, 0.7];
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
})();
const LEVELS = 12; // tonos de sombreado por color: menos clases, menos bytes
const f1 = (x) => Math.round(x * 10) / 10;

function glb(model, t) {
  const { tris, frames } = model;
  // Centro de la caja y radio de la esfera que lo envuelve: al girar no se sale.
  const pts = tris.flatMap((tri) => tri.slice(0, 3));
  const lo = [0, 1, 2].map((c) => Math.min(...pts.map((p) => p[c])));
  const hi = [0, 1, 2].map((c) => Math.max(...pts.map((p) => p[c])));
  const mid = lo.map((v, c) => (v + hi[c]) / 2);
  const reach = Math.max(...pts.map((p) => Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]))) || 1;
  const k = R / reach;

  const classes = new Map();
  const cls = (hex) => {
    if (!classes.has(hex)) classes.set(hex, `c${classes.size}`);
    return classes.get(hex);
  };
  const [ct, st] = [Math.cos(VIEW_TILT), Math.sin(VIEW_TILT)];
  const groups = [];
  for (let f = 0; f < frames; f++) {
    const a = (f / frames) * 2 * Math.PI;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    // Giro en Y y después la inclinación de la vista en X; la cámara mira hacia -z.
    const view = ([x, y, z]) => {
      const [px, py, pz] = [(x - mid[0]) * k, (y - mid[1]) * k, (z - mid[2]) * k];
      const [rx, rz] = [ca * px + sa * pz, -sa * px + ca * pz];
      return [rx, ct * py - st * rz, st * py + ct * rz];
    };
    const faces = [];
    for (const [a3, b3, c3, color] of tris) {
      const [p, q, r] = [view(a3), view(b3), view(c3)];
      const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...nrm);
      if (!len || nrm[2] <= 0) continue; // de espaldas o degenerado
      const lit = Math.max(0, (nrm[0] * SUN[0] + nrm[1] * SUN[1] + nrm[2] * SUN[2]) / len);
      const level = Math.round((0.3 + 0.7 * lit) * LEVELS) / LEVELS;
      faces.push({
        z: (p[2] + q[2] + r[2]) / 3,
        cls: cls(toHex(toLinear(color).map((c) => c * level))),
        d: [p, q, r].map(([x, y], i) => `${i ? 'L' : 'M'}${f1(CX + x)} ${f1(CY - y)}`).join('') + 'z',
      });
    }
    faces.sort((a, b) => a.z - b.z);
    // Caras seguidas del mismo tono van en un solo `<path>`.
    const paths = [];
    for (const face of faces) {
      const last = paths.at(-1);
      if (last?.cls === face.cls) last.d += face.d;
      else paths.push({ ...face });
    }
    const delay = f ? ` style="animation-delay:${Math.round((f / frames) * SPIN) - SPIN}ms" visibility="hidden"` : '';
    groups.push(`<g class="k"${delay}>${paths.map((p) => `<path class="${p.cls}" d="${p.d}"/>`).join('')}</g>`);
  }
  const body = groups.join('');
  const css =
    // El trazo del mismo color tapa la costura clara que deja el antialias entre caras.
    [...classes].map(([hex, c]) => `.${c}{fill:${hex};stroke:${hex}}`).join('') +
    'path{stroke-width:.6;stroke-linejoin:round}' +
    `.k{animation:k ${SPIN}ms step-end infinite}@keyframes k{0%{visibility:visible}${n(100 / frames)}%,to{visibility:hidden}}` +
    `@media (prefers-reduced-motion:reduce){.k{animation:none}}`;
  return { body, css };
}

// Lo que pide `model`: `discoball` o la ruta de un .glb ya leído (`buffer`).
// Valida y parsea antes de dibujar, para fallar sin escribir nada.
export function loadModel(source, buffer, frames = DEFAULT_FRAMES) {
  if (!Number.isInteger(frames) || frames < FRAMES[0] || frames > FRAMES[1])
    throw new Error(`frames: "${frames}" no vale; usa un entero de ${FRAMES[0]} a ${FRAMES[1]}`);
  if (source === 'discoball') return { kind: 'discoball', name: 'discoball' };
  if (!/\.glb$/i.test(source)) throw new Error(`model: "${source}" no es discoball ni un .glb`);
  const name = basename(source, '.glb').replace(/[^A-Za-z0-9_-]+/g, '-');
  return { kind: 'glb', name, file: basename(source), frames, tris: parseGlb(buffer, basename(source)) };
}

export function model(data, t) {
  const { body, css } = data.kind === 'discoball' ? discoball(t) : glb(data, t);
  const out = svg({ width: W, height: H, t, title: label(data), body, css });
  const size = Buffer.byteLength(out);
  if (data.kind === 'glb' && size > MAX) {
    // El peso crece casi en proporción a los triángulos: estima cuántos caben.
    const fit = Math.floor((data.tris.length * (MAX - 2048)) / size);
    throw new Error(
      `model: ${data.file} trae ${data.tris.length} triángulos y con ${data.frames} cuadros pesa ${Math.ceil(size / 1024)} KB (límite 100 KB); ` +
        `caben unos ${fit} triángulos, o baja frames`,
    );
  }
  return out;
}

// `<title>` del SVG y `alt` del snippet (RNF-11).
export const label = (data) =>
  data.kind === 'discoball' ? 'Bola disco: espejos plateados que giran despacio y destellan con la luz' : `Modelo 3D de ${data.name} girando despacio`;
export { H, R };
