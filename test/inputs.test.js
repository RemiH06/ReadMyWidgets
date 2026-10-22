import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, snippet } from '../src/cli.js';
import { FIXTURE_REPOS, FIXTURE_STACK, fixtureDeps } from '../src/preview.js';
import { githubGraphql } from '../src/repo.js';
import { parseStack } from '../src/stack.js';

const run = (inputs) => generate(inputs, fixtureDeps());
const cards = (files) => [...files.keys()].filter((f) => f.endsWith('-dark.svg'));

test('RF-02: pinned usa los fijados en su orden', async () => {
  const { widgets } = await run({ pinned: 'RemiH06' });
  assert.deepEqual(
    widgets.map((w) => w.name),
    ['card-un-repo-con-un-nombre-larguisimo-de-ochenta-caracteres-que-no-cabe-en-la-ficha-x', 'card-Ariadne'],
  );
});

test('pinned: usuario inexistente, sin fijados o mal escrito fallan con su nombre', async () => {
  await assert.rejects(run({ pinned: 'nadie' }), /pinned: nadie: Could not resolve/);
  await assert.rejects(run({ pinned: 'vacio' }), /pinned: vacio no tiene repos fijados/);
  await assert.rejects(run({ pinned: '-RemiH06' }), /pinned: "-RemiH06" no es un nombre/);
});

test('pinned sin token falla antes de generar y dice qué falta', async () => {
  await assert.rejects(generate({ pinned: 'RemiH06' }, { ...fixtureDeps(), graphql: githubGraphql() }), /pinned: RemiH06: .*GITHUB_TOKEN/);
});

test('repos y pinned juntos, o nada que generar, fallan', async () => {
  await assert.rejects(run({ repos: FIXTURE_REPOS, pinned: 'RemiH06' }), /repos o pinned, no los dos/);
  await assert.rejects(run({}), /no hay nada que generar/);
});

test('status llena el de los repos que no lo traen, por nombre o dueño/repo', async () => {
  const { widgets } = await run({ pinned: 'RemiH06', status: ['ariadne:pausa'] });
  assert.match(widgets[1].alt, /\(en pausa\)$/);
  // El que ya trae status en repos se queda con el suyo.
  const kept = await run({ repos: ['RemiH06/Ariadne:activo'], status: ['RemiH06/Ariadne:pausa'] });
  assert.match(kept.widgets[0].alt, /\(activo\)$/);
});

test('status: forma inválida, status desconocido o repo que no está fallan', async () => {
  await assert.rejects(run({ pinned: 'RemiH06', status: ['Ariadne'] }), /status: "Ariadne" no es válido/);
  await assert.rejects(run({ pinned: 'RemiH06', status: ['Ariadne:vivo'] }), /"vivo" no es un status/);
  await assert.rejects(run({ pinned: 'RemiH06', status: ['tanGo:activo'] }), /"tango" no está entre los repos/);
});

test('RF-03: un par de archivos por categoría de stack, con nombre de archivo limpio', async () => {
  const { files } = await run({ stack: FIXTURE_STACK });
  assert.deepEqual(cards(files), ['stack-lenguajes-dark.svg', 'stack-web-apps-dark.svg']);
});

test('stack: la tecnología que no cabe baja de renglón y la que no cabe sola se corta', async () => {
  const { files } = await run({ stack: FIXTURE_STACK });
  const web = files.get('stack-web-apps-dark.svg');
  const ys = [...web.matchAll(/<text x="[\d.]+" y="(\d+)" font-size="15">/g)].map((m) => +m[1]);
  assert.ok(new Set(ys).size >= 3, `renglones: ${[...new Set(ys)]}`);
  assert.match(web, /una tecnología con un nombre[^<]*…<\/text>/);
  assert.match(web, /&lt;script&gt;/);
});

test('stack.json inválido falla diciendo dónde (RF-06)', () => {
  for (const [json, why] of [
    [[], /debe ser un objeto/],
    [{}, /no tiene categorías/],
    [{ Lenguajes: [] }, /"Lenguajes" debe ser una lista/],
    [{ Lenguajes: ['Python', 3] }, /"Lenguajes"\[1\]/],
    [{ Lenguajes: [{ icon: 'python' }] }, /"Lenguajes"\[0\]/],
    [{ '¿?': ['Python'] }, /"¿\?" no deja un nombre/],
    [{ 'Data & ML': ['pandas'], 'data ml': ['R'] }, /dan el mismo archivo stack-data-ml/],
  ]) {
    assert.throws(() => parseStack(json), why, JSON.stringify(json));
  }
  assert.deepEqual(parseStack({ 'Bases de datos': [' SQL ', { name: 'PostGIS', icon: 'postgresql' }] }), [
    { name: 'Bases de datos', slug: 'bases-de-datos', items: [{ name: 'SQL', icon: 'SQL' }, { name: 'PostGIS', icon: 'postgresql' }] },
  ]);
});

test('RF-05, RNF-11: snippet con <picture>, enlace al repo y alt real escapado', async () => {
  const { widgets } = await run({ repos: FIXTURE_REPOS, stack: FIXTURE_STACK });
  const lines = snippet(widgets, 'widgets/').split('\n');
  assert.equal(lines.length, widgets.length);
  assert.equal(
    lines[0],
    '<a href="https://github.com/RemiH06/Ariadne"><picture>' +
      '<source media="(prefers-color-scheme: dark)" srcset="widgets/card-Ariadne-dark.svg">' +
      '<img src="widgets/card-Ariadne-light.svg" width="400" alt="Ariadne: Documentation graph generator for any project with any tools. (activo)">' +
      '</picture></a>',
  );
  assert.match(lines[1], /alt="un-repo[^"]*: Probando &lt;script&gt;alert\(&quot;x&quot;\)/);
  // El stack no enlaza a nada: sin <a>.
  assert.match(lines[2], /^<picture>.*alt="Lenguajes: Python, TypeScript, JavaScript, Rust, C#, HTML, Shell"/);
  for (const line of lines) assert.doesNotMatch(line, /alt=""/);
});

test('Action: los inputs de action.yml se traducen a los del CLI', async () => {
  const { inputs } = await import('../src/action.js');
  assert.deepEqual(
    inputs({ INPUT_REPOS: 'RemiH06/Ariadne:activo\nhttps://github.com/RemiH06/tanGo\n', INPUT_STATUS: '', INPUT_LAYOUT: 'row', INPUT_OUT: 'w' }),
    { repos: ['RemiH06/Ariadne:activo', 'https://github.com/RemiH06/tanGo'], pinned: undefined, status: [], stack: undefined, layout: 'row', nixie: [], user: undefined, out: 'w', base: undefined },
  );
  assert.deepEqual(inputs({ INPUT_PINNED: ' RemiH06 ' }), { repos: [], pinned: 'RemiH06', status: [], stack: undefined, layout: 'card', nixie: [], user: undefined, out: 'widgets', base: undefined });
  assert.deepEqual(inputs({ INPUT_NIXIE: 'stars, commits', INPUT_USER: 'RemiH06' }).nixie, ['stars', 'commits']);
});
