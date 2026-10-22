import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { contrast } from '../src/color.js';
import { escapeXml } from '../src/svg.js';
import { measure, truncate, wrap } from '../src/text.js';

const MIN = { text: 4.5, graphic: 3 };

for (const [theme, t] of Object.entries(tokens.themes)) {
  test(`contraste de tokens en ${theme} (RNF-03)`, () => {
    for (const [token, role] of Object.entries(tokens.roles)) {
      const ratio = contrast(t[token], t.bg);
      assert.ok(ratio >= MIN[role], `${token} ${t[token]} sobre ${t.bg}: ${ratio.toFixed(2)}`);
    }
    // El borde es lo que separa la ficha del fondo de GitHub.
    const edge = contrast(t.border, t.page);
    assert.ok(edge >= MIN.graphic, `border sobre page ${t.page}: ${edge.toFixed(2)}`);
  });
}

test('escape XML de <&"\' y caracteres de control (RNF-07)', () => {
  assert.equal(escapeXml(`a<b>&"c'\u0001`), 'a&lt;b&gt;&amp;&quot;c&apos;');
});

test('truncate no pasa del ancho y termina en … (RF-04)', () => {
  const long = 'x'.repeat(80);
  for (const weight of ['regular', 'bold']) {
    const cut = truncate(long, 18, 300, weight);
    assert.ok(cut.endsWith('…'));
    assert.ok(measure(cut, 18, weight) <= 300);
  }
  assert.equal(truncate('corto', 13, 300), 'corto');
  // Con espacios corta en palabra completa.
  const words = truncate('filtros geográficos y búsqueda de especies', 15, 160);
  assert.ok(words.endsWith('…'));
  assert.ok('filtros geográficos y búsqueda de especies'.split(' ').includes(words.slice(0, -1).split(' ').at(-1)), words);
});

test('wrap acomoda en líneas que caben y corta la última (RF-04)', () => {
  const text = 'Una descripción bastante larga que no cabe en dos líneas de una ficha angosta, ni de chiste.';
  const lines = wrap(text, 15, 200, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => measure(l, 15) <= 200));
  assert.ok(lines[1].endsWith('…'));
  assert.deepEqual(wrap('corta', 15, 200, 2), ['corta']);
  assert.deepEqual(wrap('', 15, 200, 2), []);
  // Una palabra más ancha que la línea se parte en vez de desbordar.
  const word = wrap('y'.repeat(60), 15, 200, 2);
  assert.ok(word.every((l) => measure(l, 15) <= 200));
  assert.ok(word[1].endsWith('…'));
});
