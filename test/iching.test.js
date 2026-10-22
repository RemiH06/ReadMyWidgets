import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { generate, snippet } from '../src/cli.js';
import { contrast } from '../src/color.js';
import { WEEKS, weeks } from '../src/iching.js';
import { FIXTURE_ICHING, fixtureDeps } from '../src/preview.js';

const { files, widgets } = await generate(FIXTURE_ICHING, fixtureDeps());

// Calendario sin red: `n` días seguidos que terminan en `last`, con
// contribuciones en los días que diga `active(fecha)`.
const calendar = (last, active, n = 371) =>
  Array.from({ length: n }, (_, k) => {
    const date = new Date(Date.parse(last) - (n - 1 - k) * 86400000).toISOString().slice(0, 10);
    return { date, contributionCount: active(date) ? 2 : 0 };
  });
const weekday = (date) => new Date(date).getUTCDay();

test('iching: un archivo por tema con 52 hexagramas', () => {
  assert.deepEqual([...files.keys()].sort(), ['iching-dark.svg', 'iching-light.svg']);
  for (const svg of files.values()) assert.equal(svg.match(/<path d=/g).length, WEEKS);
});

test('iching: semanas de lunes a domingo, completas, de abajo hacia arriba', () => {
  // 2026-10-22 es jueves: la última semana completa termina el domingo 18.
  const w = weeks(calendar('2026-10-22', () => true));
  assert.equal(w.length, 52);
  assert.deepEqual([w[0].from, w.at(-1).from, w.at(-1).to], ['2025-10-20', '2026-10-12', '2026-10-18']);
  // Un domingo aún no acaba: esa semana no cuenta.
  assert.equal(weeks(calendar('2026-10-18', () => true)).at(-1).to, '2026-10-11');
  // Solo los miércoles: línea 3 entera, las demás partidas.
  assert.deepEqual(weeks(calendar('2026-10-22', (d) => weekday(d) === 3))[10].lines, [false, false, true, false, false, false]);
  // Sábado o domingo, cualquiera de los dos, enciende la línea 6.
  for (const day of [0, 6]) assert.deepEqual(weeks(calendar('2026-10-22', (d) => weekday(d) === day))[0].lines.at(-1), true);
});

test('iching: línea entera es un rectángulo, partida son dos', async () => {
  const graphql = (active) => async () => ({
    data: { user: { contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: calendar('2026-10-22', active) }] } } } },
  });
  const bars = async (active) => {
    const svg = (await generate(FIXTURE_ICHING, { ...fixtureDeps(), graphql: graphql(active) })).files.get('iching-dark.svg');
    return svg.match(/<path d="([^"]*)"/)[1].match(/M/g).length;
  };
  assert.equal(await bars(() => true), 6);
  assert.equal(await bars(() => false), 12);
});

test('iching: un calendario corto falla en vez de inventar días', () => {
  assert.throws(() => weeks(calendar('2026-10-22', () => true, 300)), /el calendario no trae 2025-10-2\d/);
});

test('iching: peso, autocontenido y determinista (RNF-01, RNF-02, RNF-04)', async () => {
  const again = (await generate(FIXTURE_ICHING, fixtureDeps())).files;
  for (const [file, svg] of files) {
    assert.ok(Buffer.byteLength(svg) < 100 * 1024, file);
    assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''), /https?:/, file);
    assert.doesNotMatch(svg, /<script|<foreignObject/i, file);
    assert.equal(svg, again.get(file), file);
  }
});

test('iching: los colores de gis de los renglones pasan 3:1 con y sin caja (RNF-03)', () => {
  for (const [theme, t] of Object.entries(tokens.themes)) {
    for (const c of tokens.chalk[theme].slice(0, WEEKS / 13)) {
      for (const bg of [t.bg, t.page]) assert.ok(contrast(c, bg) >= 3, `${theme} ${c} sobre ${bg}`);
    }
  }
});

test('iching: quieto, derecho y entero con prefers-reduced-motion', () => {
  const svg = files.get('iching-dark.svg');
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{path\{animation:none\}\}/);
  // El giro y la opacidad solo viven en el `from` del keyframe, con `backwards`.
  assert.match(svg, /animation:h \d+ms [^;}]* backwards/);
  assert.doesNotMatch(svg.replace(/@keyframes h\{[^}]*\}\}/, ''), /transform:rotate|opacity:var/);
});

test('iching: el pie a 15 px sigue en 12 px en un teléfono (RNF-10)', () => {
  const svg = files.get('iching-dark.svg');
  const size = +svg.match(/<text class="dim" [^>]*font-size="(\d+)"/)[1];
  assert.ok((size * 328) / 400 >= 12);
  assert.match(svg, />Oct 2025 a oct 2026: semanas de RemiH06</);
});

test('iching: snippet con alt que dice el rango y los días (RNF-11)', () => {
  assert.match(
    snippet(widgets, 'widgets'),
    /alt="RemiH06: 52 semanas de contribuciones como hexagramas del I Ching, 20 oct 2025 a 18 oct 2026; 171 de 364 días con contribuciones"/,
  );
});

test('iching: sin caja por defecto; con background solid, con ella', async () => {
  assert.match(files.get('iching-dark.svg'), /<rect x="0.5" y="0.5" [^>]*fill="none"/);
  const solid = (await generate({ ...FIXTURE_ICHING, background: 'solid' }, fixtureDeps())).files.get('iching-dark.svg');
  assert.match(solid, new RegExp(`<rect x="0.5" y="0.5" [^>]*fill="${tokens.themes.dark.bg}"`));
});

test('iching: entradas inválidas fallan con mensaje', async () => {
  await assert.rejects(generate({ iching: true }, fixtureDeps()), /iching: falta user/);
  await assert.rejects(generate({ iching: true, user: 'nadie' }, fixtureDeps()), /calendario de nadie/);
});
