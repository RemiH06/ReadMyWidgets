import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { generate, snippet } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { DISH, H, REACH } from '../src/ferro.js';
import { FIXTURE_FERRO, fixtureDeps } from '../src/preview.js';

const run = (inputs) => generate(inputs, fixtureDeps());
const { files, widgets } = await run(FIXTURE_FERRO);

test('ferrofluid: un archivo por tema, una mancha en un plato redondo y sin caja', () => {
  assert.deepEqual([...files.keys()].sort(), ['ferrofluid-dark.svg', 'ferrofluid-light.svg']);
  for (const [file, svg] of files) {
    assert.equal(svg.match(/<filter /g).length, 1, file);
    assert.match(svg, new RegExp(`<circle cx="200" cy="${H / 2}" r="${DISH}" fill="${tokens.ferro.dish}"`), file);
    assert.doesNotMatch(svg, /<rect /, file);
  }
});

test('ferrofluid: peso, autocontenido, sin fuente y determinista (RNF-01, RNF-02, RNF-04)', async () => {
  const again = (await run(FIXTURE_FERRO)).files;
  for (const [file, svg] of files) {
    assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
    assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''), /https?:/, file);
    assert.doesNotMatch(svg, /<script|<foreignObject|@font-face/i, file);
    assert.equal(svg, again.get(file), file);
  }
});

test('ferrofluid: la región del filtro se acota a la mancha y la mancha no sale del plato', () => {
  const [, x, w] = files.get('ferrofluid-dark.svg').match(/<filter id="f" filterUnits="userSpaceOnUse" x="(-?\d+)" y="-?\d+" width="(\d+)"/);
  assert.ok(w <= 2 * (REACH + 24) && +x === -w / 2);
  // El cuerpo llega ~2 más allá del radio de la gota; queda aire contra el borde del plato.
  assert.ok(REACH + 8 <= DISH && DISH < H / 2);
});

test('ferrofluid: quieto con prefers-reduced-motion, y el primer cuadro es ese mismo dibujo', () => {
  for (const svg of files.values()) {
    assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.o\{animation:none\}\}/);
    // Las rotaciones arrancan en 0: sin retrasos negativos, la pose inicial va en la geometría.
    assert.doesNotMatch(svg, /animation-delay/);
  }
});

test('ferrofluid: el líquido sobre el plato, el brillo sobre el líquido y el plato contra la página (RNF-03)', () => {
  const f = tokens.ferro;
  assert.ok(contrast(f.fluid, f.dish) >= 3);
  assert.ok(contrast(f.shine, f.fluid) >= 3);
  // El plato es igual en los dos temas; donde se parece a la página, lo separa el borde.
  for (const t of Object.values(tokens.themes)) assert.ok(contrast(f.dish, t.page) >= 3 || contrast(t.border, t.page) >= 3);
});

test('ferrofluid: snippet con alt descriptivo; background no le pone caja', async () => {
  assert.match(snippet(widgets, 'w'), /ferrofluid-light\.svg" width="400" alt="Ferrofluido: [^"]+"/);
  const solid = (await run({ ...FIXTURE_FERRO, background: 'solid' })).files.get('ferrofluid-dark.svg');
  assert.doesNotMatch(solid, /<rect /);
});
