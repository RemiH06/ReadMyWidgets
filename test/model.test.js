import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tokens from '../src/tokens.json' with { type: 'json' };
import { generate, run as runCli, snippet } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { H, R, parseGlb } from '../src/model.js';
import { FIXTURE_DISCO, FIXTURE_GLB, fixtureDeps } from '../src/preview.js';

const run = (inputs) => generate(inputs, fixtureDeps());
const disco = await run(FIXTURE_DISCO);
const trompo = await run(FIXTURE_GLB);

// GLB mínimo: una malla de triángulos con su color y, si se pide, extensiones requeridas.
function writeGlb(positions, indices, extra = {}) {
  const pos = Buffer.alloc(positions.length * 12);
  positions.forEach((p, k) => p.forEach((c, j) => pos.writeFloatLE(c, k * 12 + j * 4)));
  const idx = Buffer.alloc(indices.length * 4);
  indices.forEach((v, k) => idx.writeUInt32LE(v, k * 4));
  const bin = Buffer.concat([pos, idx]);
  const json = {
    asset: { version: '2.0' },
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length, type: 'VEC3' },
      { bufferView: 1, componentType: 5125, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.length },
      { buffer: 0, byteOffset: pos.length, byteLength: idx.length },
    ],
    buffers: [{ byteLength: bin.length }],
    ...extra,
  };
  let j = Buffer.from(JSON.stringify(json));
  j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const chunk = (len, type) => Buffer.from(new Uint32Array([len, type]).buffer);
  const head = Buffer.from(new Uint32Array([0x46546c67, 2, 12 + 16 + j.length + bin.length]).buffer);
  return Buffer.concat([head, chunk(j.length, 0x4e4f534a), j, chunk(bin.length, 0x004e4942), bin]);
}

// Esfera UV de `rings` × `segments` cuadros, dos triángulos cada uno.
function sphere(rings, segments) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j <= segments; j++) {
      const [φ, θ] = [(i / rings) * Math.PI, (j / segments) * 2 * Math.PI];
      positions.push([Math.sin(φ) * Math.cos(θ), Math.cos(φ), Math.sin(φ) * Math.sin(θ)]);
    }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  return writeGlb(positions, indices);
}

test('model: un archivo por tema, con el nombre del modelo', () => {
  assert.deepEqual([...disco.files.keys()].sort(), ['model-discoball-dark.svg', 'model-discoball-light.svg']);
  assert.deepEqual([...trompo.files.keys()].sort(), ['model-trompo-dark.svg', 'model-trompo-light.svg']);
});

test('model: peso, autocontenido, sin fuente y determinista (RNF-01, RNF-02, RNF-04)', async () => {
  for (const [inputs, { files }] of [[FIXTURE_DISCO, disco], [FIXTURE_GLB, trompo]]) {
    const again = (await run(inputs)).files;
    for (const [file, svg] of files) {
      assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
      assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''), /https?:/, file);
      assert.doesNotMatch(svg, /<script|<foreignObject|@font-face|<text/i, file);
      assert.equal(svg, again.get(file), file);
    }
  }
});

test('discoball: anillos de espejos, uno de cada tres teñido, y cada espejo con su retraso', () => {
  const svg = disco.files.get('model-discoball-dark.svg');
  const tiles = svg.match(/<use href="#t\d+" class="t [as]"/g);
  assert.ok(tiles.length > 300 && tiles.length < 500, `${tiles.length} espejos`);
  const tinted = tiles.filter((t) => t.endsWith('a"')).length / tiles.length;
  assert.ok(tinted > 0.25 && tinted < 0.42, `teñidos: ${tinted}`);
  // Dos retrasos por espejo (giro y luz), de una vuelta como mucho.
  for (const [, a, b] of svg.matchAll(/animation-delay:(-?\d+)ms,(-?\d+)ms/g)) for (const d of [a, b]) assert.ok(d <= 0 && d > -18000);
  assert.equal(svg.match(/animation-delay/g).length, tiles.length);
});

test('model: quieto con prefers-reduced-motion, en su primer cuadro', () => {
  const ball = disco.files.get('model-discoball-dark.svg');
  assert.match(ball, /@media \(prefers-reduced-motion:reduce\)\{\.t\{animation:none\}\}/);
  // La pose inicial va en atributos: de frente con su posición, de espaldas invisible.
  for (const [tile] of ball.matchAll(/<use [^>]+>/g)) assert.ok(/transform="translate/.test(tile) || /opacity="0"/.test(tile), tile);
  const glb = trompo.files.get('model-trompo-dark.svg');
  assert.match(glb, /@media \(prefers-reduced-motion:reduce\)\{\.k\{animation:none\}\}/);
  const frames = [...glb.matchAll(/<g class="k"([^>]*)>/g)].map(([, attrs]) => attrs);
  assert.equal(frames.length, 24);
  assert.equal(frames[0], '');
  for (const attrs of frames.slice(1)) assert.match(attrs, /animation-delay:-\d+ms" visibility="hidden"/);
});

test('discoball: la silueta se separa de la página en los dos temas (RNF-03)', () => {
  // En oscuro la separan los espejos; en claro, el núcleo.
  for (const t of Object.values(tokens.themes)) {
    const best = Math.max(contrast(tokens.disco.core, t.page), contrast(tokens.disco.silver, t.page));
    assert.ok(best >= 3, t.page);
  }
});

test('glb: lee la jerarquía de nodos con su escala, rotación y traslación', () => {
  const tris = parseGlb(FIXTURE_GLB.glb, 'trompo.glb');
  assert.equal(tris.length, 80 + 6);
  // La punta: hija trasladada 0.9 y estirada 1.43 en Y, dentro de un padre achatado a 0.7.
  const top = Math.max(...tris.flatMap((t) => t.slice(0, 3).map((p) => p[1])));
  assert.ok(Math.abs(top - 0.7 * (0.9 + 1.43)) < 1e-4, top);
  assert.deepEqual(new Set(tris.map((t) => t[3])).size, 2);
});

test('glb: cabe en el cuadro al girar y frames cambia cuántos cuadros hay', async () => {
  const svg = trompo.files.get('model-trompo-dark.svg');
  for (const [, x, y] of svg.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
    assert.ok(x >= 200 - R - 1 && x <= 200 + R + 1 && y >= H / 2 - R - 1 && y <= H / 2 + R + 1, `${x} ${y}`);
  }
  const few = (await run({ ...FIXTURE_GLB, frames: 8 })).files.get('model-trompo-dark.svg');
  assert.equal(few.match(/<g class="k"/g).length, 8);
  assert.match(few, /@keyframes k\{0%\{visibility:visible\}12\.5%,to\{visibility:hidden\}\}/);
});

test('glb: si no cabe, falla con cuántos triángulos trae y cuántos caben (RF-06)', async () => {
  const big = sphere(40, 64); // 5,120 triángulos
  await assert.rejects(run({ model: 'esfera.glb', glb: big }), (err) => {
    assert.match(err.message, /^model: esfera\.glb trae 5120 triángulos y con 24 cuadros pesa \d+ KB \(límite 100 KB\); caben unos (\d+) triángulos, o baja frames$/);
    const fit = +err.message.match(/caben unos (\d+)/)[1];
    assert.ok(fit > 50 && fit < 1000, fit);
    return true;
  });
});

test('glb: entradas inválidas fallan con mensaje', async () => {
  const cases = [
    [{ model: 'esfera.glb', glb: writeGlb([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0, 1, 2], { extensionsRequired: ['EXT_meshopt_compression'] }) }, /model: esfera\.glb pide EXT_meshopt_compression; expórtalo sin compresión/],
    [{ model: 'nada.glb', glb: Buffer.from('no soy un glb, de veras') }, /model: nada\.glb no es un \.glb/],
    [{ model: 'cubo.obj' }, /model: "cubo\.obj" no es discoball ni un \.glb/],
    [{ ...FIXTURE_GLB, frames: 3 }, /frames: "3" no vale; usa un entero de 4 a 72/],
    [{ ...FIXTURE_GLB, frames: Number('x') }, /frames: "NaN" no vale/],
    [{ ...FIXTURE_DISCO, frames: 12 }, /frames: solo aplica a un model \.glb/],
  ];
  for (const [inputs, message] of cases) await assert.rejects(run(inputs), message);
});

test('model: el CLI lee el .glb de la ruta y falla claro si no existe', async () => {
  const out = mkdtempSync(join(tmpdir(), 'rmw-'));
  const { paths, html } = await runCli({ model: 'test/fixtures/trompo.glb', out, base: 'w' });
  assert.equal(paths.length, 2);
  assert.equal(readFileSync(paths[0], 'utf8'), trompo.files.get('model-trompo-dark.svg'));
  assert.match(html, /alt="Modelo 3D de trompo girando despacio"/);
  await assert.rejects(runCli({ model: 'no/existe.glb', out }), /model: no se pudo leer no\/existe\.glb/);
});

test('model: snippet con alt descriptivo y sin caja por defecto', async () => {
  assert.match(snippet(disco.widgets, 'w'), /model-discoball-light\.svg" width="400" alt="Bola disco: [^"]+"/);
  assert.match(disco.files.get('model-discoball-dark.svg'), /<rect [^>]*fill="none"/);
  const solid = (await run({ ...FIXTURE_DISCO, background: 'solid' })).files.get('model-discoball-dark.svg');
  assert.match(solid, new RegExp(`<rect [^>]*fill="${tokens.themes.dark.bg}"`));
});
