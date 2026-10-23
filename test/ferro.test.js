import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { generate, snippet } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { CENTERS, H, REACH } from '../src/ferro.js';
import { FIXTURE_FERRO, fixtureDeps } from '../src/preview.js';

const run = (inputs) => generate(inputs, fixtureDeps());
const { files, widgets } = await run(FIXTURE_FERRO);

test('ferrofluid: un archivo por tema, tres manchas con su filtro', () => {
  assert.deepEqual([...files.keys()].sort(), ['ferrofluid-dark.svg', 'ferrofluid-light.svg']);
  for (const [file, svg] of files) {
    assert.equal(svg.match(/<filter /g).length, 3, file);
    assert.equal(svg.match(/filter="url\(#f\d\)"/g).length, 3, file);
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

test('ferrofluid: la región del filtro se acota a la mancha y la mancha cabe en el cuadro', () => {
  const svg = files.get('ferrofluid-dark.svg');
  for (const [, x, w] of svg.matchAll(/<filter id="f\d" filterUnits="userSpaceOnUse" x="(-?\d+)" y="-?\d+" width="(\d+)"/g)) {
    assert.ok(w <= 2 * (REACH + 24) && +x === -w / 2);
  }
  // Las bandas quedan dentro del borde: la de afuera está ~2 más allá del radio.
  assert.ok(REACH + 4 <= H / 2);
  assert.ok(CENTERS[0] - REACH > 0 && CENTERS.at(-1) + REACH < 400);
});

test('ferrofluid: quieto con prefers-reduced-motion, y el primer cuadro es ese mismo dibujo', () => {
  for (const svg of files.values()) {
    assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.o\{animation:none\}\}/);
    // Las rotaciones arrancan en 0: sin retrasos negativos, la pose inicial va en la geometría.
    assert.doesNotMatch(svg, /animation-delay/);
  }
});

test('ferrofluid: cada banda ≥ 3:1 contra la página y la caja, en los dos temas (RNF-03)', () => {
  for (const [theme, colors] of Object.entries(tokens.ferro)) {
    const t = tokens.themes[theme];
    assert.equal(colors.length, CENTERS.length);
    for (const c of colors) for (const bg of [t.page, t.bg]) assert.ok(contrast(c, bg) >= 3, `${theme} ${c} sobre ${bg}`);
  }
});

test('ferrofluid: snippet con alt descriptivo y sin caja por defecto', async () => {
  assert.match(snippet(widgets, 'w'), /ferrofluid-light\.svg" width="400" alt="Ferrofluido: [^"]+"/);
  assert.match(files.get('ferrofluid-dark.svg'), /<rect [^>]*fill="none"/);
  const solid = (await run({ ...FIXTURE_FERRO, background: 'solid' })).files.get('ferrofluid-dark.svg');
  assert.match(solid, new RegExp(`<rect [^>]*fill="${tokens.themes.dark.bg}"`));
});
