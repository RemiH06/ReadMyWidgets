import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { generate, snippet } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { glyphText } from '../src/matrix.js';
import { FIXTURE_MATRIX, fixtureDeps } from '../src/preview.js';

const run = (inputs) => generate(inputs, fixtureDeps());
const { files, widgets } = await run(FIXTURE_MATRIX);
const leds = (svg) => svg.match(/<path id="d" d="([^"]*)"/)[1].match(/M/g).length;

test('matrix: un archivo por modo y tema, con los 489 LEDs del Phone (3)', () => {
  assert.deepEqual([...files.keys()].sort(), ['fluid', 'pulse', 'text'].flatMap((m) => [`matrix-${m}-dark.svg`, `matrix-${m}-light.svg`]));
  for (const svg of files.values()) assert.equal(leds(svg), 489);
  // pulse y fluid: un LED encendido por cada LED, con su retraso.
  for (const mode of ['pulse', 'fluid']) assert.equal(files.get(`matrix-${mode}-dark.svg`).match(/<path class="l"/g).length, 489);
});

test('matrix: peso, autocontenido, sin fuente y determinista (RNF-01, RNF-02, RNF-04)', async () => {
  const again = (await run(FIXTURE_MATRIX)).files;
  for (const [file, svg] of files) {
    assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
    assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''), /https?:/, file);
    assert.doesNotMatch(svg, /<script|<foreignObject|@font-face/i, file);
    assert.equal(svg, again.get(file), file);
  }
});

test('matrix: texto sin acentos y en mayúsculas; lo que no tiene letra falla', () => {
  assert.equal(glyphText('  Ñandú   rápido-2! '), 'NANDU RAPIDO-2!');
  assert.throws(() => glyphText('hola@mundo'), /no hay letra de 5×5 para "@"/);
  assert.throws(() => glyphText('   '), /el texto está vacío/);
});

test('matrix: el texto que cabe queda quieto; el que no, corre un LED por paso', async () => {
  const short = (await run({ matrix: ['text'], text: 'Hex' })).files.get('matrix-text-dark.svg');
  assert.doesNotMatch(short, /animation/);
  const long = files.get('matrix-text-dark.svg');
  const [, from, to] = long.match(/@keyframes s\{from\{transform:translateX\((-?\d+)px\)\}to\{transform:translateX\((-?\d+)px\)\}\}/);
  const steps = +long.match(/steps\((\d+)\)/)[1];
  assert.equal((from - to) / steps, 10, 'un paso de LED por paso de la animación');
});

test('matrix: quieto con prefers-reduced-motion, en el brillo de su primer cuadro', () => {
  for (const [mode, cls] of [['text', 't'], ['pulse', 'l'], ['fluid', 'l']]) {
    const svg = files.get(`matrix-${mode}-dark.svg`);
    assert.match(svg, new RegExp(`@media \\(prefers-reduced-motion:reduce\\)\\{\\.${cls}\\{animation:none\\}\\}`), mode);
  }
  // pulse: en el primer cuadro la onda va a medio camino, no todo apagado ni todo encendido.
  const ops = [...files.get('matrix-pulse-dark.svg').matchAll(/opacity="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(ops.some((o) => o > 0.9) && ops.filter((o) => o <= 0.1).length > 200);
  // fluid: manchas, no un disco encendido.
  const lit = [...files.get('matrix-fluid-dark.svg').matchAll(/opacity="([\d.]+)"/g)].filter((m) => +m[1] > 0.5).length;
  assert.ok(lit > 30 && lit < 245, `${lit} LEDs encendidos`);
});

test('matrix: LED encendido sobre el disco y disco sobre la página (RNF-03)', () => {
  const g = tokens.glyph;
  assert.ok(contrast(g.on, g.disc) >= 4.5);
  assert.ok(contrast(g.on, g.off) >= 3);
  // El disco es un objeto: en oscuro se separa de la página por el borde del tema.
  for (const t of Object.values(tokens.themes)) assert.ok(Math.max(contrast(g.disc, t.page), contrast(t.border, t.page)) >= 3);
});

test('matrix: snippet con alt que dice el modo o el texto (RNF-11)', () => {
  const html = snippet(widgets, 'widgets');
  assert.match(html, /alt="Matriz Glyph de 489 LEDs con el texto &quot;HOLA, SOY HEX&quot;"/);
  assert.match(html, /alt="Matriz Glyph de 489 LEDs: una onda de luz que sale del centro"/);
});

test('matrix: sin caja por defecto; con background solid, con ella', async () => {
  assert.match(files.get('matrix-pulse-dark.svg'), /<rect x="0.5" y="0.5" [^>]*fill="none"/);
  const solid = (await run({ matrix: ['pulse'], background: 'solid' })).files.get('matrix-pulse-dark.svg');
  assert.match(solid, new RegExp(`<rect x="0.5" y="0.5" [^>]*fill="${tokens.themes.dark.bg}"`));
});

test('matrix: text usa user si no hay texto', async () => {
  const { widgets: w } = await run({ matrix: ['text'], user: 'Remi-H06' });
  assert.match(w[0].alt, /"REMI-H06"/);
});

test('matrix: entradas inválidas fallan con mensaje', async () => {
  await assert.rejects(run({ matrix: ['onda'] }), /matrix: "onda" no existe/);
  await assert.rejects(run({ matrix: ['pulse', 'pulse'] }), /matrix: hay un modo repetido/);
  await assert.rejects(run({ matrix: ['text'] }), /matrix: falta text/);
  await assert.rejects(run({ matrix: ['pulse'], text: 'Hola' }), /text: es el texto del banner o de la matriz/);
});
