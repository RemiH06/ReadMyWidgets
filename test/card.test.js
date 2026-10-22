import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { W } from '../src/card.js';
import { generate } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { iconColors } from '../src/icons.js';
import { FIXTURE_REPOS, fixtureGet, fixtureIcon } from '../src/preview.js';
import { parseRepo } from '../src/repo.js';
import { measure } from '../src/text.js';

const files = await generate(FIXTURE_REPOS, { get: fixtureGet, icon: fixtureIcon() });
const themeOf = (file) => file.match(/-(dark|light)\.svg$/)[1];
const NAMESPACES = /xmlns(:\w+)?="http:\/\/www\.w3\.org\/[^"]*"/g;
const unescape = (s) =>
  s.replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[e]);
const images = (svg) =>
  [...svg.matchAll(/href="data:image\/svg\+xml;base64,([^"]+)"/g)].map((m) =>
    Buffer.from(m[1], 'base64').toString('utf8'),
  );
const texts = (svg) =>
  [...svg.matchAll(/<text( class="(\w+)")? x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)">([^<]*)<\/text>/g)].map(
    (m) => ({ bold: m[2] === 'b', x: +m[3], size: +m[4], str: unescape(m[5]) }),
  );

test('RF-01: acepta URL con o sin .git o / final, y dueño/repo', () => {
  const want = { owner: 'RemiH06', name: 'Ariadne' };
  for (const input of [
    'https://github.com/RemiH06/Ariadne',
    'https://github.com/RemiH06/Ariadne.git',
    'https://github.com/RemiH06/Ariadne/',
    'RemiH06/Ariadne',
    '  RemiH06/Ariadne\n',
  ]) {
    assert.deepEqual(parseRepo(input), want, input);
  }
});

test('RF-01: lo demás falla diciendo cuál entrada y por qué', () => {
  for (const [input, why] of [
    ['Ariadne', /1 partes/],
    ['RemiH06/Ariadne/extra', /3 partes/],
    ['https://github.com/RemiH06/Ariadne/tree/main', /4 partes/],
    ['http://github.com/RemiH06/Ariadne', /https/],
    ['https://gitlab.com/RemiH06/Ariadne', /gitlab\.com/],
    ['https://github.com/RemiH06/Ariadne?tab=readme', /\?/],
    ['-RemiH06/Ariadne', /usuario/],
    ['RemiH06/Ari adne', /nombre de repo/],
    ['', /partes/],
  ]) {
    assert.throws(() => parseRepo(input), (err) => err.message.includes(`"${input.trim()}"`) && why.test(err.message), input);
  }
});

test('un repo que no existe falla con su nombre y no devuelve nada (RF-06)', async () => {
  await assert.rejects(
    generate(['RemiH06/Ariadne', 'RemiH06/nope'], { get: fixtureGet, icon: fixtureIcon() }),
    /RemiH06\/nope: no existe/,
  );
});

test('dos fichas por repo, una por tema (RF-03)', () => {
  assert.deepEqual(
    [...files.keys()].filter((f) => f.includes('Ariadne')),
    ['card-Ariadne-dark.svg', 'card-Ariadne-light.svg'],
  );
});

test('íconos: devicon por name, altnames o name + versión; sin ícono, null', async () => {
  const icon = fixtureIcon();
  for (const name of ['Rust', 'C#', 'HTML', 'threejs']) assert.match(await icon(name), /^<svg/, name);
  for (const name of ['Shell', 'machine-learning']) assert.equal(await icon(name), null, name);
});

for (const [file, svg] of files) {
  const t = tokens.themes[themeOf(file)];

  test(`${file}: pesa menos de 100 KB y es autocontenido (RNF-01, RNF-02)`, () => {
    assert.ok(Buffer.byteLength(svg) < 100 * 1024, `${Buffer.byteLength(svg)} bytes`);
    for (const doc of [svg, ...images(svg)]) {
      assert.doesNotMatch(doc.replace(NAMESPACES, ''), /http/i);
      assert.doesNotMatch(doc, /<script|<foreignObject/i);
    }
  });

  test(`${file}: el texto escapado no se sale de la ficha (RF-04, RNF-07)`, () => {
    assert.doesNotMatch(svg.replace(/<title>.*<\/title>/, ''), /<script|alert\("/);
    for (const { x, size, str, bold } of texts(svg)) {
      const right = x + measure(str, size, bold ? 'bold' : 'regular');
      assert.ok(right <= W - 24 + 0.01, `"${str}" llega a ${right.toFixed(1)}`);
    }
  });

  test(`${file}: texto más chico ≥ 12 px en un teléfono (RNF-10)`, () => {
    const min = Math.min(...texts(svg).map((x) => x.size));
    assert.ok((min * 328) / W >= 12, `${min} px → ${((min * 328) / W).toFixed(1)} px`);
  });

  test(`${file}: cada ícono tiene un color que se distingue del fondo (RNF-03)`, () => {
    for (const icon of images(svg)) {
      const best = Math.max(...iconColors(icon).map((c) => contrast(c, t.bg)));
      assert.ok(best >= 3, `${iconColors(icon)} sobre ${t.bg}: ${best.toFixed(2)}`);
    }
  });
}

test('el título largo se corta con … y la descripción en 2 líneas (RF-04)', () => {
  const lines = texts(files.get(`card-${'un-repo-con-un-nombre-larguisimo-de-ochenta-caracteres-que-no-cabe-en-la-ficha-x'}-dark.svg`));
  assert.ok(lines[0].bold && lines[0].str.endsWith('…'));
  const body = lines.filter((l) => l.size === 15 && /Probando|comillas/.test(l.str));
  assert.equal(body.length, 2);
  assert.ok(body[1].str.endsWith('…'));
});

test('salida determinista: mismos datos, mismos bytes (RNF-04)', async () => {
  const again = await generate(FIXTURE_REPOS, { get: fixtureGet, icon: fixtureIcon() });
  assert.deepEqual(again, files);
});
