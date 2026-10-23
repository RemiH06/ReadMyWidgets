import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import tokens from '../src/tokens.json' with { type: 'json' };
import alias from '../icons/alias.json' with { type: 'json' };
import { generate } from '../src/cli.js';
import { decodePng, iconImage, iconSource, pngShare } from '../src/icons.js';
import { fixtureDeps, fixtureIcon } from '../src/preview.js';
import { palette } from '../src/svg.js';

const DIR = new URL('../icons/', import.meta.url);
const own = readdirSync(DIR).filter((f) => /\.(svg|png)$/.test(f));
// Lo que devicon no tiene y sí está en icons/, con nombres como los escribiría alguien.
const OWN = ['SQL', 'PostGIS', 'Snowflake', 'SciPy', 'statsmodels', 'tidyverse', 'seaborn', 'XGBoost', 'LightGBM', 'CatBoost',
  'Hugging Face', 'Ray RLlib', 'Gymnasium', 'YOLO', 'librosa', 'praat', 'Pydantic', 'Leaflet', 'Prefect', 'MLflow', 'Optuna',
  'Claude Code', 'Quarto', 'Obsidian'];

test('icons/: cada archivo está en CREDITOS.md, los SVG pesan menos de 15 KB y los PNG son RGBA', () => {
  const credits = readFileSync(new URL('CREDITOS.md', DIR), 'utf8');
  for (const file of own) {
    assert.ok(credits.includes(file.replace(/\.\w+$/, '')), `${file} sin créditos`);
    const buf = readFileSync(new URL(file, DIR));
    if (file.endsWith('.png')) {
      assert.ok(decodePng(buf).px.length, file);
      continue;
    }
    assert.ok(statSync(new URL(file, DIR)).size < 15 * 1024, file);
    // RNF-02: nada de http fuera de los espacios de nombres del W3C, ni script.
    const svg = buf.toString('utf8');
    assert.doesNotMatch(svg.replace(/xmlns(:\w+)?="http:\/\/www\.w3\.org\/[^"]*"/g, ''), /http/i, file);
    assert.doesNotMatch(svg, /<script|<foreignObject|<!DOCTYPE/i, file);
  }
});

test('icons/: lo que devicon no tiene sale como ícono, no como texto', async () => {
  const icon = fixtureIcon();
  for (const name of OWN) assert.match((await icon(name)) ?? '', /^<svg/, name);
  // El alias funciona también hacia devicon: Cypher es el lenguaje de Neo4j.
  const devicon = iconSource(async (path) =>
    path === 'devicon.json' ? JSON.stringify([{ name: 'neo4j', altnames: [], versions: { svg: ['original'] } }]) : `<svg id="${path}"/>`,
  );
  assert.equal(await devicon('CQL (Cypher)'), '<svg id="icons/neo4j/neo4j-original.svg"/>');
  for (const to of Object.values(alias)) assert.ok(to === 'neo4j' || own.some((f) => f.startsWith(`${to}.`)), to);
});

test('icons/: cada PNG da 3:1 en la mayoría de sus píxeles, con caja y sin ella (RNF-03)', async () => {
  const icon = fixtureIcon();
  for (const file of own.filter((f) => f.endsWith('.png'))) {
    const svg = await icon(file.slice(0, -4));
    for (const theme of Object.keys(tokens.themes)) {
      for (const t of [palette(theme), palette(theme, true)]) {
        const out = Buffer.from(iconImage(svg, t).split(',')[1], 'base64').toString('utf8');
        const [, slope, at] = out.match(/slope="([\d.]+)" intercept="([\d.]+)"/) ?? [, 1, 0];
        const k = +at > 0 ? +at : +slope - 1;
        assert.ok(pngShare(out, t.bg, k) >= 0.5, `${file} sobre ${t.bg}`);
      }
    }
  }
});

test('stack y colofón con íconos propios: uno por tecnología', async () => {
  const stack = { 'Machine Learning': ['XGBoost', 'CatBoost', 'Gymnasium', 'YOLO', 'librosa', 'praat', 'Hugging Face', 'Ray RLlib'] };
  for (const colofon of [false, true]) {
    const { files } = await generate({ stack, colofon }, fixtureDeps());
    for (const [file, svg] of files) {
      assert.equal(svg.match(/<image /g).length, 8, file);
      assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
    }
  }
});

test('names en false: solo íconos en stack y colofón; sin ícono, el nombre se queda', async () => {
  const stack = { Lenguajes: ['Python', 'Rust', 'Shell'] };
  const words = (svg) => [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  for (const colofon of [false, true]) {
    const { files, widgets } = await generate({ stack, colofon, names: false }, fixtureDeps());
    const svg = files.get(`${colofon ? 'colofon' : 'stack'}-lenguajes-dark.svg`);
    assert.equal(svg.match(/<image /g).length, 2);
    // Solo el título (o la píldora) y Shell, que no tiene ícono.
    assert.deepEqual(words(svg).sort(), ['Lenguajes', 'Shell']);
    assert.equal(widgets[0].alt, 'Lenguajes: Python, Rust, Shell');
  }
  // Con nombres (por defecto) el bloque no cambia.
  const before = (await generate({ stack }, fixtureDeps())).files;
  const same = (await generate({ stack, names: true }, fixtureDeps())).files;
  assert.deepEqual([...before], [...same]);
  await assert.rejects(generate({ repos: ['RemiH06/Ariadne'], names: false }, fixtureDeps()), /names: solo aplica/);
});
