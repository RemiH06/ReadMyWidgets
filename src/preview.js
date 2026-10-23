// Fichas, stack y nixie de los fixtures (sin red) y todo lo que haya en
// out/<layout>/, out/stack/, out/nixie/, out/banner/, out/iching/, out/matrix/ y out/ferrofluid/, más fichas y stack sin caja
// en out/transparent/ y nixie, banner e iching con caja en out/solid/,
// dentro de <img> sobre los fondos de GitHub, en una columna de escritorio y una
// de teléfono.
// Para fichas reales: node src/cli.js --repos … --layout <layout> --out out/<layout>
// Para un stack real: node src/cli.js --stack stack.json --out out/stack
//   npm run preview && start out/preview.html
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import tokens from './tokens.json' with { type: 'json' };
import { LAYOUTS } from './card.js';
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

// GraphQL servido desde test/fixtures/api/graphql_<consulta>_<login>.json; un
// login sin archivo responde como GitHub a uno que no existe.
export async function fixtureGraphql(query, { login }) {
  const kind = query.includes('pinnedItems') ? 'pinned' : query.includes('contributionCalendar') ? 'calendar' : query.includes('contributionsCollection') ? 'commits' : 'stars';
  try {
    return JSON.parse(readFileSync(new URL(`api/graphql_${kind}_${login}.json`, FIXTURES), 'utf8'));
  } catch {
    return { data: { repositoryOwner: null, user: null }, errors: [{ message: `Could not resolve to a RepositoryOwner with the login of '${login}'.` }] };
  }
}

export const fixtureDeps = () => ({ get: fixtureGet, graphql: fixtureGraphql, icon: fixtureIcon() });

export const FIXTURE_REPOS = ['https://github.com/RemiH06/Ariadne:activo', 'RemiH06/edge'];
export const FIXTURE_STACK = JSON.parse(readFileSync(new URL('stack.json', FIXTURES), 'utf8'));
export const FIXTURE_NIXIE = { nixie: ['stars', 'commits'], user: 'RemiH06', year: 2026 };
export const FIXTURE_BANNER = { banner: true, text: 'Hola, soy Hex: datos y pizarrón' };
export const FIXTURE_ICHING = { iching: true, user: 'RemiH06' };
export const FIXTURE_COLOFON = { stack: FIXTURE_STACK, colofon: true };
export const FIXTURE_MATRIX = { matrix: ['text', 'pulse', 'fluid'], text: 'Hola, soy Hex' };
export const FIXTURE_FERRO = { ferrofluid: true };

if (import.meta.main) {
  // Una columna por forma y tema: escritorio (400) y teléfono (328).
  const sections = [];
  // nixie y banner salen sin caja por defecto; en `solid`, con ella.
  const extra = {
    stack: { stack: FIXTURE_STACK },
    nixie: FIXTURE_NIXIE,
    banner: FIXTURE_BANNER,
    iching: FIXTURE_ICHING,
    colofon: FIXTURE_COLOFON,
    matrix: FIXTURE_MATRIX,
    ferrofluid: FIXTURE_FERRO,
    transparent: { repos: FIXTURE_REPOS, stack: FIXTURE_STACK, background: 'transparent' },
    solid: { ...FIXTURE_NIXIE, ...FIXTURE_BANNER, ...FIXTURE_ICHING, ...FIXTURE_COLOFON, matrix: ['pulse'], ...FIXTURE_FERRO, background: 'solid' },
  };
  for (const layout of [...Object.keys(LAYOUTS), ...Object.keys(extra)]) {
    mkdirSync(`out/${layout}`, { recursive: true });
    const inputs = extra[layout] ?? { repos: FIXTURE_REPOS, layout };
    const { files } = await generate(inputs, fixtureDeps());
    for (const [file, content] of files) writeFileSync(`out/${layout}/${file}`, content);
    const cards = readdirSync(`out/${layout}`)
      .filter((f) => f.endsWith('-dark.svg'))
      .sort()
      .map((f) => `${layout}/${f.slice(0, -'-dark.svg'.length)}`);
    const column = (theme, width) =>
      `<section style="background:${tokens.themes[theme].page};width:${width}px">` +
      cards.map((c) => `<img src="${c}-${theme}.svg" alt="">`).join('') +
      '</section>';
    sections.push(`<h2>${layout}</h2><div>${column('dark', 400) + column('light', 400) + column('dark', 328) + column('light', 328)}</div>`);
  }
  writeFileSync(
    'out/preview.html',
    `<!doctype html><meta charset="utf-8"><title>ReadMyWidgets preview</title>` +
      `<style>body{margin:0;font-family:sans-serif}h2{margin:16px}div{display:flex;flex-wrap:wrap;align-items:flex-start}` +
      `section{padding:16px}img{display:block;max-width:100%;margin-bottom:16px}</style>` +
      sections.join('') +
      '\n',
  );
  console.log('out/preview.html');
}
