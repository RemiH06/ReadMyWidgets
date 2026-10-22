// node src/cli.js --repos RemiH06/Ariadne:activo,RemiH06/tanGo --layout compact --out out
// node src/cli.js --pinned RemiH06 --status tanGo:activo --stack stack.json --out widgets
// La Action llama a `generate` igual que este CLI; solo traduce sus inputs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import tokens from './tokens.json' with { type: 'json' };
import { LAYOUTS, W, card, label } from './card.js';
import { iconSource } from './icons.js';
import { applyStatus, fetchPinned, fetchRepo, githubFetch, githubGraphql, list, parseRepo, parseStatus } from './repo.js';
import { label as stackLabel, parseStack, stack } from './stack.js';
import { escapeXml } from './svg.js';

const MAX = 100 * 1024; // RNF-01

// Todos los archivos en memoria, nombre → contenido, y por cada widget lo que
// necesita su snippet. Si algo falla, lanza antes de que se escriba nada (RF-06).
//   repos   lista de entradas de RF-01, o
//   pinned  usuario u organización cuyos fijados se usan (RF-02)
//   status  lista de `repo:status` para los repos que no lo traen
//   stack   el JSON de stack.json ya leído
export async function generate(
  { repos = [], pinned, status = [], stack: stackJson, layout = 'card' },
  { get, graphql, icon = iconSource() },
) {
  if (!(layout in LAYOUTS)) throw new Error(`layout: "${layout}" no existe; usa ${Object.keys(LAYOUTS).join(', ')}`);
  if (repos.length && pinned) throw new Error('usa repos o pinned, no los dos');
  if (!repos.length && !pinned && stackJson === undefined) throw new Error('no hay nada que generar: pasa repos, pinned o stack');
  const categories = stackJson === undefined ? [] : parseStack(stackJson);
  const statusMap = parseStatus(status);
  const targets = applyStatus(pinned ? await fetchPinned(pinned, graphql) : repos.map(parseRepo), statusMap);
  const fetched = await Promise.all(targets.map((r) => fetchRepo(r, get)));

  const files = new Map();
  const widgets = [];
  const add = (name, render) => {
    for (const theme of Object.keys(tokens.themes)) {
      const file = `${name}-${theme}.svg`;
      const content = render(theme);
      const size = Buffer.byteLength(content);
      if (size > MAX) throw new Error(`${file} pesa ${Math.ceil(size / 1024)} KB y el límite es 100 KB; quita íconos o divídelo`);
      files.set(file, content);
    }
  };
  const iconsFor = async (names) => new Map(await Promise.all(names.map(async (k) => [k, await icon(k)])));

  for (const repo of fetched) {
    const name = `card-${repo.name}`;
    if (widgets.some((w) => w.name === name)) throw new Error(`repos: dos repos se llaman ${repo.name}`);
    const icons = await iconsFor([...repo.languages.map(([l]) => l), ...repo.topics]);
    add(name, (theme) => card(repo, theme, icons, layout));
    widgets.push({ name, href: repo.url, alt: label(repo) });
  }
  for (const category of categories) {
    const icons = await iconsFor(category.items.map((i) => i.icon));
    const name = `stack-${category.slug}`;
    add(name, (theme) => stack(category, theme, icons));
    widgets.push({ name, alt: stackLabel(category) });
  }
  return { files, widgets };
}

// Bloque listo para pegar en el README (RF-05): un `<picture>` por widget que
// elige el tema de quien ve, dentro de un `<a>` al repo si es ficha. `base` es
// dónde quedan los SVG vistos desde el README (carpeta o URL).
export function snippet(widgets, base) {
  const src = (w, theme) => escapeXml(`${base.replace(/\/+$/, '')}/${w.name}-${theme}.svg`);
  return widgets
    .map((w) => {
      const picture =
        `<picture><source media="(prefers-color-scheme: dark)" srcset="${src(w, 'dark')}">` +
        `<img src="${src(w, 'light')}" width="${W}" alt="${escapeXml(w.alt)}"></picture>`;
      return w.href ? `<a href="${escapeXml(w.href)}">${picture}</a>` : picture;
    })
    .join('\n');
}

// Lo que hacen igual el CLI y la Action: leer `stack.json` (ruta), generar,
// escribir en `out` y devolver las rutas escritas y el snippet.
export async function run({ repos, pinned, status, stack: stackPath, layout, out, base }, token) {
  let stackJson;
  if (stackPath) {
    try {
      stackJson = JSON.parse(readFileSync(stackPath, 'utf8'));
    } catch (err) {
      throw new Error(`stack: no se pudo leer ${stackPath}: ${err.message}`);
    }
  }
  const { files, widgets } = await generate(
    { repos, pinned, status, stack: stackJson, layout },
    { get: githubFetch(token), graphql: githubGraphql(token) },
  );
  mkdirSync(out, { recursive: true });
  for (const [file, content] of files) writeFileSync(join(out, file), content);
  return {
    paths: [...files.keys()].map((f) => join(out, f)),
    html: snippet(widgets, base || out.replaceAll('\\', '/')),
  };
}

const USAGE = `Uso: node src/cli.js (--repos dueño/repo[:status][,…] | --pinned usuario) [--status repo:status,…]
                   [--stack stack.json] [--layout card|compact|row] [--out carpeta] [--base ruta-o-url]`;

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      repos: { type: 'string' },
      pinned: { type: 'string' },
      status: { type: 'string' },
      stack: { type: 'string' },
      layout: { type: 'string', default: 'card' },
      out: { type: 'string', default: 'out' },
      base: { type: 'string' },
    },
  });
  if (!values.repos && !values.pinned && !values.stack) {
    console.error(USAGE);
    process.exit(2);
  }
  try {
    const { paths, html } = await run(
      { ...values, repos: list(values.repos), status: list(values.status) },
      process.env.GITHUB_TOKEN,
    );
    console.error(paths.join('\n'));
    console.log(html);
  } catch (err) {
    console.error(err.message);
    // exitCode y no exit(): con un fetch aún abierto, exit() tumba a libuv en Windows.
    process.exitCode = 1;
  }
}
