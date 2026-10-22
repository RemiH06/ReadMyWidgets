import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../src/tokens.json' with { type: 'json' };
import { escapeXml } from '../src/svg.js';
import { measure, truncate } from '../src/text.js';
import { phrase } from '../src/preview.js';

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

test('phrase escapa el título en el SVG', () => {
  const out = phrase('dark', '<&"', 'x');
  assert.match(out, /&lt;&amp;&quot;/);
  assert.doesNotMatch(out, /<&"/);
});

test('truncate no pasa del ancho y termina en … (RF-04)', () => {
  const long = 'x'.repeat(80);
  for (const weight of ['regular', 'bold']) {
    const cut = truncate(long, 18, 300, weight);
    assert.ok(cut.endsWith('…'));
    assert.ok(measure(cut, 18, weight) <= 300);
  }
  assert.equal(truncate('corto', 13, 300), 'corto');
});

for (const theme of Object.keys(tokens.themes)) {
  test(`SVG en ${theme}: autocontenido y ligero (RNF-01, RNF-02)`, () => {
    const out = phrase(theme, 'ReadMyWidgets', 'hola');
    assert.ok(Buffer.byteLength(out) < 100 * 1024);
    assert.doesNotMatch(out.replace('xmlns="http://www.w3.org/2000/svg"', ''), /http/i);
    assert.doesNotMatch(out, /<script|<foreignObject/i);
  });
}

test('salida determinista (RNF-04)', () => {
  assert.equal(phrase('light', 'a', 'b'), phrase('light', 'a', 'b'));
});
