import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import tokens from '../src/tokens.json' with { type: 'json' };
import { W } from '../src/card.js';
import { generate, snippet } from '../src/cli.js';
import { FIXTURE_COLOFON, fixtureDeps } from '../src/preview.js';

const run = (inputs) => generate(inputs, fixtureDeps());
const { files, widgets } = await run(FIXTURE_COLOFON);
const ink = (svg) => svg.match(/<feFlood flood-color="(#[0-9a-f]{6})"/)[1];
const band = (svg) => svg.match(/<rect x="-20" [^>]*fill="([^"]+)"/)[1];

test('colofón: una banda por categoría en lugar de bloques de stack', () => {
  assert.deepEqual([...files.keys()].sort(), [
    'colofon-lenguajes-dark.svg', 'colofon-lenguajes-light.svg', 'colofon-web-apps-dark.svg', 'colofon-web-apps-light.svg',
  ]);
  assert.match(widgets[0].alt, /^Lenguajes: Python, TypeScript/);
});

test('colofón: sin stack falla', async () => {
  await assert.rejects(run({ colofon: true }), /colofon: falta stack/);
});

test('colofón: peso, autocontenido y determinista (RNF-01, RNF-02, RNF-04)', async () => {
  const again = (await run(FIXTURE_COLOFON)).files;
  for (const [file, svg] of files) {
    assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
    assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''), /https?:/, file);
    assert.doesNotMatch(svg, /<script|<foreignObject/i, file);
    assert.equal(svg, again.get(file), file);
  }
});

test('colofón: logos plain teñidos con el gis de su banda, en el orden de lambda', () => {
  const plain = readFileSync(new URL('fixtures/devicon/icons/typescript/typescript-plain.svg', import.meta.url));
  const first = files.get('colofon-lenguajes-dark.svg');
  assert.ok(first.includes(plain.toString('base64')));
  assert.ok([...first.matchAll(/<image [^>]*>/g)].every(([tag]) => tag.includes('filter="url(#k)"')));
  // Azul la primera, cian la segunda (tokens.chalk[0] y [7]).
  assert.equal(ink(first), tokens.chalk.dark[0]);
  assert.equal(ink(files.get('colofon-web-apps-light.svg')), tokens.chalk.light[7]);
});

test('colofón: bandas alternadas en inclinación y sentido', () => {
  const [a, b] = ['colofon-lenguajes-dark.svg', 'colofon-web-apps-dark.svg'].map((f) => files.get(f));
  assert.match(a, /rotate\(-1 /);
  assert.match(b, /rotate\(1 /);
  assert.match(a, /@keyframes m\{to\{transform:translateX\(-\d+px\)\}\}/);
  assert.match(b, /@keyframes m\{from\{transform:translateX\(-\d+px\)\}\}/);
});

test('colofón: quieto con prefers-reduced-motion y legible en un teléfono (RNF-10)', () => {
  const svg = files.get('colofon-lenguajes-light.svg');
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.r\{animation:none\}\}/);
  const sizes = [...svg.matchAll(/font-size="(\d+)"/g)].map((m) => +m[1]);
  assert.ok((Math.min(...sizes) * 328) / W >= 12);
});

test('colofón: sin caja; la banda va sin fondo por defecto y con él en solid', async () => {
  const svg = files.get('colofon-lenguajes-dark.svg');
  assert.doesNotMatch(svg, /<rect x="0.5" y="0.5"/);
  assert.equal(band(svg), 'none');
  const solid = (await run({ ...FIXTURE_COLOFON, background: 'solid' })).files;
  assert.equal(band(solid.get('colofon-lenguajes-light.svg')), tokens.themes.light.bg);
});

test('colofón: el snippet apila las bandas con <br>', () => {
  const html = snippet(widgets, 'w').split('\n');
  assert.equal(html.length, 2);
  assert.match(html[0], /<\/picture><br>$/);
  assert.match(html[1], /<\/picture>$/);
});
