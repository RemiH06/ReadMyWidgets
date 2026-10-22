import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { generate, snippet } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { FIXTURE_NIXIE, fixtureDeps } from '../src/preview.js';

const { files, widgets } = await generate(FIXTURE_NIXIE, fixtureDeps());

// Cifra fija sin red: un graphql que responde `count` a cualquier consulta.
const fake = (count) => ({
  ...fixtureDeps(),
  graphql: async () => ({
    data: {
      user: { contributionsCollection: { totalCommitContributions: count } },
      repositoryOwner: { repositories: { nodes: [{ stargazerCount: count }], pageInfo: { hasNextPage: false } } },
    },
  }),
});
const lit = (svg) => [...svg.matchAll(/href="#d(\d)" class="z"/g)].map((m) => m[1]).join('');

test('nixie: estrellas y commits de los fixtures, un archivo por tema', () => {
  assert.deepEqual([...files.keys()].sort(), [
    'nixie-commits-dark.svg', 'nixie-commits-light.svg', 'nixie-stars-dark.svg', 'nixie-stars-light.svg',
  ]);
  assert.equal(lit(files.get('nixie-commits-dark.svg')), '797');
  assert.equal(lit(files.get('nixie-stars-dark.svg')), '23');
  // Cuatro tubos aunque la cifra tenga menos dígitos; los de la izquierda, apagados.
  assert.equal(files.get('nixie-stars-dark.svg').match(/<use href="#t"\/>/g).length, 4);
});

test('nixie: peso, autocontenido y determinista (RNF-01, RNF-02, RNF-04)', async () => {
  const again = (await generate(FIXTURE_NIXIE, fixtureDeps())).files;
  for (const [file, svg] of files) {
    assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
    assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''), /https?:/, file);
    assert.doesNotMatch(svg, /<script|<foreignObject/i, file);
    assert.equal(svg, again.get(file), file);
  }
});

test('nixie: contraste de la cifra y el brillo sobre el tubo (RNF-03)', () => {
  const x = tokens.nixie;
  assert.ok(contrast(x.digit, x.tube) >= 4.5, `digit ${contrast(x.digit, x.tube).toFixed(2)}`);
  assert.ok(contrast(x.glow, x.tube) >= 3, `glow ${contrast(x.glow, x.tube).toFixed(2)}`);
  // El tubo se separa del fondo por su borde en oscuro y por sí mismo en claro.
  for (const t of Object.values(tokens.themes)) {
    assert.ok(Math.max(contrast(x.tube, t.bg), contrast(t.border, t.bg)) >= 3, t.bg);
  }
});

test('nixie: sin caja, el tubo conserva su vidrio', async () => {
  const svg = (await generate({ ...FIXTURE_NIXIE, background: 'transparent' }, fixtureDeps())).files.get('nixie-stars-dark.svg');
  assert.match(svg, /<rect x="0.5" y="0.5" [^>]*fill="none"/);
  assert.match(svg, new RegExp(`fill="${tokens.nixie.tube}"`));
});

test('nixie: quieto y legible con prefers-reduced-motion', () => {
  const svg = files.get('nixie-commits-dark.svg');
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.f,\.z\{animation:none\}\}/);
  // Sin animación, los saltos tienen opacidad 0 y la cifra final no la toca.
  assert.match(svg, /\.f\{opacity:0;/);
  assert.doesNotMatch(svg, /\.z\{[^}]*opacity/);
});

test('nixie: una cifra de 9 dígitos cabe en el ancho', async () => {
  const svg = (await generate({ ...FIXTURE_NIXIE, nixie: ['stars'] }, fake(123456789))).files.get('nixie-stars-dark.svg');
  assert.equal(lit(svg), '123456789');
  const scale = +svg.match(/translate\(24 24\) scale\(([\d.]+)\)/)[1];
  assert.ok(9 * 48 * scale + 8 * 8 * scale <= 352, `escala ${scale}`);
});

test('nixie: el pie a 15 px sigue en 12 px en un teléfono (RNF-10)', () => {
  const size = +files.get('nixie-stars-dark.svg').match(/<text class="dim" [^>]*font-size="(\d+)"/)[1];
  assert.ok((size * 328) / 400 >= 12);
});

test('nixie: estrellas suma todas las páginas', async () => {
  const pages = [
    { nodes: [{ stargazerCount: 5 }, { stargazerCount: 1 }], pageInfo: { hasNextPage: true, endCursor: 'a' } },
    { nodes: [{ stargazerCount: 4 }], pageInfo: { hasNextPage: false, endCursor: 'b' } },
  ];
  const graphql = async (q, { cursor }) => ({ data: { repositoryOwner: { repositories: pages[cursor ? 1 : 0] } } });
  const { files } = await generate({ ...FIXTURE_NIXIE, nixie: ['stars'] }, { ...fixtureDeps(), graphql });
  assert.equal(lit(files.get('nixie-stars-dark.svg')), '10');
});

test('nixie: snippet con alt que dice la cifra (RNF-11)', () => {
  const html = snippet(widgets, 'widgets');
  assert.match(html, /alt="RemiH06: 797 commits en 2026"/);
  assert.match(html, /alt="RemiH06: 23 estrellas en sus repos públicos"/);
  assert.doesNotMatch(html, /<a /);
});

test('nixie: entradas inválidas fallan con mensaje', async () => {
  for (const [inputs, why] of [
    [{ nixie: ['forks'], user: 'RemiH06' }, /"forks" no existe/],
    [{ nixie: ['stars'] }, /falta user/],
    [{ nixie: ['stars', 'stars'], user: 'RemiH06' }, /repetida/],
    [{ nixie: ['commits'], user: 'nadie' }, /commits de nadie/],
    [{ nixie: ['stars'], user: 'nadie' }, /stars de nadie: no existe/],
  ]) {
    await assert.rejects(generate(inputs, fixtureDeps()), why, JSON.stringify(inputs));
  }
});
