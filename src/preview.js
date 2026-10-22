// Fichas de los fixtures (sin red) y todo lo que haya en out/, dentro de <img>
// sobre los fondos de GitHub, en una columna de escritorio y una de teléfono.
//   npm run preview && start out/preview.html
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import tokens from './tokens.json' with { type: 'json' };
import { generate } from './cli.js';
import { iconSource } from './icons.js';

const FIXTURES = new URL('../test/fixtures/', import.meta.url);

// `get` de la API servido desde test/fixtures/api: /repos/o/r/languages → o_r_languages.json.
export async function fixtureGet(path) {
  const file = path.replace(/^\/repos\//, '').replaceAll('/', '_') + '.json';
  try {
    return JSON.parse(readFileSync(new URL(`api/${file}`, FIXTURES), 'utf8'));
  } catch {
    const err = new Error(`GitHub respondió 404 a ${path}`);
    err.status = 404;
    throw err;
  }
}

export const fixtureIcon = () =>
  iconSource(async (path) => readFileSync(new URL(`devicon/${path}`, FIXTURES), 'utf8'));

export const FIXTURE_REPOS = ['https://github.com/RemiH06/Ariadne', 'RemiH06/edge'];

if (import.meta.main) {
  mkdirSync('out', { recursive: true });
  const files = await generate(FIXTURE_REPOS, { get: fixtureGet, icon: fixtureIcon() });
  for (const [file, content] of files) writeFileSync(`out/${file}`, content);

  const cards = readdirSync('out')
    .filter((f) => f.endsWith('-dark.svg'))
    .sort()
    .map((f) => f.slice(0, -'-dark.svg'.length));
  const column = (theme, width) =>
    `<section style="background:${tokens.themes[theme].page};width:${width}px">` +
    cards.map((c) => `<img src="${c}-${theme}.svg" alt="">`).join('') +
    '</section>';
  writeFileSync(
    'out/preview.html',
    `<!doctype html><meta charset="utf-8"><title>ReadMyWidgets preview</title>` +
      `<style>body{margin:0;display:flex;flex-wrap:wrap;align-items:flex-start}` +
      `section{padding:16px}img{display:block;max-width:100%;margin-bottom:16px}</style>` +
      column('dark', 400) + column('light', 400) + column('dark', 328) + column('light', 328) +
      '\n',
  );
  console.log('out/preview.html');
}
