// Iteración 0: una frase en ambos temas dentro de <img>, sobre los fondos de GitHub.
//   node src/preview.js && start out/preview.html
import { mkdirSync, writeFileSync } from 'node:fs';
import tokens from './tokens.json' with { type: 'json' };
import { escapeXml, svg } from './svg.js';
import { truncate } from './text.js';

const W = 480;
const H = 96;
const PAD = 20;

export function phrase(theme, title, line) {
  const t = tokens.themes[theme];
  const max = W - PAD * 2 - 12;
  const body =
    `<rect x="${PAD}" y="${PAD}" width="3" height="${H - PAD * 2}" fill="${t.accent}"/>` +
    `<text class="b" x="${PAD + 12}" y="42" font-size="18">${escapeXml(truncate(title, 18, max, 'bold'))}</text>` +
    `<text class="dim" x="${PAD + 12}" y="66" font-size="13">${escapeXml(truncate(line, 13, max))}</text>`;
  return svg({ width: W, height: H, theme, title, body });
}

const SAMPLES = [
  ['ReadMyWidgets', 'Fichas en SVG para tu perfil: ñandú, pingüino & <stack> “así”.'],
  [
    'un-nombre-de-repositorio-larguísimo-que-no-cabe-en-la-ficha-ni-de-chiste',
    'Una descripción tan larga que tiene que cortarse con puntos suspensivos antes del borde.',
  ],
];

if (import.meta.main) {
  mkdirSync('out', { recursive: true });
  const rows = SAMPLES.map(([title, line], i) => {
    const imgs = Object.entries(tokens.themes).map(([theme, t]) => {
      const file = `phrase-${i}-${theme}.svg`;
      writeFileSync(`out/${file}`, phrase(theme, title, line));
      return `<div style="background:${t.page}"><img src="${file}" alt=""></div>`;
    });
    return imgs.join('');
  });
  writeFileSync(
    'out/preview.html',
    `<!doctype html><meta charset="utf-8"><title>ReadMyWidgets preview</title>` +
      `<style>body{margin:0;display:grid;grid-template-columns:1fr 1fr}` +
      `div{padding:24px}img{display:block;max-width:100%}</style>` +
      rows.join('') +
      '\n',
  );
  console.log('out/preview.html');
}
