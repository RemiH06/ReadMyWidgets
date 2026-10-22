import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { W } from '../src/card.js';
import { generate } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { FIXTURE_BANNER, FIXTURE_NIXIE, FIXTURE_REPOS, fixtureDeps } from '../src/preview.js';
import { measure } from '../src/text.js';

const run = (inputs) => generate(inputs, fixtureDeps());
const { files, widgets } = await run(FIXTURE_BANNER);
const lines = (svg) => [...svg.matchAll(/<text class="b" x="(\d+)" y="[\d.]+" font-size="(\d+)">([^<]*)<\/text>/g)];

test('banner: un archivo por tema, con el texto en 2 líneas que caben', () => {
  assert.deepEqual([...files.keys()].sort(), ['banner-dark.svg', 'banner-light.svg']);
  const found = lines(files.get('banner-dark.svg'));
  assert.equal(found.length, 2);
  assert.equal(found.map((m) => m[3]).join(' '), FIXTURE_BANNER.text);
  for (const [, x, size, str] of found) assert.ok(+x + measure(str, +size, 'bold') <= W - 24, str);
  assert.equal(widgets[0].alt, FIXTURE_BANNER.text);
});

test('banner: sin text usa el usuario', async () => {
  const { widgets: w, files: f } = await run({ banner: true, user: 'RemiH06' });
  assert.equal(w[0].alt, 'RemiH06');
  assert.equal(lines(f.get('banner-light.svg')).length, 1);
});

test('banner: lo que no cabe falla con mensaje en vez de cortarse', async () => {
  await assert.rejects(run({ banner: true, text: 'una frase demasiado larga para caber en dos líneas del banner' }), /no cabe en 2 líneas/);
  await assert.rejects(run({ banner: true, text: 'Supercalifragilisticoespialidoso' }), /"Supercalifragilisticoespialidoso" no cabe en una línea/);
  await assert.rejects(run({ banner: true, text: '   ' }), /el texto está vacío/);
  await assert.rejects(run({ banner: true }), /falta text, o user/);
  await assert.rejects(run({ repos: FIXTURE_REPOS, text: 'Hola' }), /text: es el texto del banner o de la matriz/);
});

test('banner: escapa el texto (RNF-07)', async () => {
  const svg = (await run({ banner: true, text: 'a<b> & "c"' })).files.get('banner-dark.svg');
  assert.match(svg, /a&lt;b&gt; &amp; &quot;c&quot;/);
});

test('banner: peso, autocontenido y determinista (RNF-01, RNF-02, RNF-04)', async () => {
  const again = (await run(FIXTURE_BANNER)).files;
  for (const [file, svg] of files) {
    assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
    assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''), /https?:/, file);
    assert.doesNotMatch(svg, /<script|<foreignObject/i, file);
    assert.equal(svg, again.get(file), file);
  }
});

test('banner: el gis da 3:1 con caja y sin ella (RNF-03)', () => {
  for (const [theme, t] of Object.entries(tokens.themes)) {
    for (const c of tokens.chalk[theme]) {
      for (const bg of [t.bg, t.page]) assert.ok(contrast(c, bg) >= 3, `${theme} ${c} sobre ${bg}: ${contrast(c, bg).toFixed(2)}`);
    }
  }
});

test('banner: el texto más chico sigue en 12 px en un teléfono (RNF-10)', () => {
  const sizes = [...files.get('banner-dark.svg').matchAll(/font-size="(\d+)"/g)].map((m) => +m[1]);
  assert.ok((Math.min(...sizes) * 328) / W >= 12, `${Math.min(...sizes)} px`);
});

test('banner: quieto, escrito y trazado con prefers-reduced-motion', () => {
  const svg = files.get('banner-dark.svg');
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.o,\.d,\.w\{animation:none\}\}/);
  // El estado sin animación es el final: las animaciones solo definen `from`.
  assert.doesNotMatch(svg, /@keyframes \w\{[^}]*to\{/);
  assert.doesNotMatch(svg, /\.(o|d|w)\{[^}]*(opacity:0|stroke-dashoffset|scaleX)/);
});

// RF-08: sin `background`, los decorativos (A a G) salen sin caja y las fichas y el stack con ella.
test('background por defecto: transparent en banner y nixie, solid en fichas', async () => {
  const box = (svg) => svg.match(/<rect x="0.5" y="0.5" [^>]*fill="([^"]+)"/)[1];
  const all = (await run({ repos: FIXTURE_REPOS, ...FIXTURE_NIXIE, ...FIXTURE_BANNER })).files;
  assert.equal(box(all.get('banner-dark.svg')), 'none');
  assert.equal(box(all.get('nixie-stars-dark.svg')), 'none');
  assert.equal(box(all.get('card-Ariadne-dark.svg')), tokens.themes.dark.bg);
  const solid = (await run({ ...FIXTURE_BANNER, ...FIXTURE_NIXIE, background: 'solid' })).files;
  assert.equal(box(solid.get('banner-light.svg')), tokens.themes.light.bg);
  assert.equal(box(solid.get('nixie-commits-light.svg')), tokens.themes.light.bg);
});
