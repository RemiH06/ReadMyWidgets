// node src/cli.js --repos RemiH06/Ariadne:activo,RemiH06/tanGo --layout compact --out out
// node src/cli.js --pinned RemiH06 --status tanGo:activo --stack stack.json --out widgets
// node src/cli.js --nixie stars,commits --user RemiH06 --out widgets
// node src/cli.js --banner --text "Hola, soy Hex" --out widgets
// node src/cli.js --iching --user RemiH06 --out widgets
// node src/cli.js --matrix text,pulse,fluid --text "Hola" --out widgets
// node src/cli.js --ferrofluid --out widgets
// La Action llama a `generate` igual que este CLI; solo traduce sus inputs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import tokens from './tokens.json' with { type: 'json' };
import { LAYOUTS, W, card, label } from './card.js';
import { colofon as drawColofon } from './colofon.js';
import { LABEL as ferroLabel, ferro } from './ferro.js';
import { MONO, iconSource } from './icons.js';
import { applyStatus, fetchPinned, fetchRepo, githubFetch, githubGraphql, list, parseRepo, parseStatus } from './repo.js';
import { banner as drawBanner, label as bannerLabel, lines as bannerLines } from './banner.js';
import { fetchWeeks, iching as drawIching, label as ichingLabel } from './iching.js';
import { MODES, glyphText, label as matrixLabel, matrix as drawMatrix } from './matrix.js';
import { KINDS, fetchCount, label as nixieLabel, nixie } from './nixie.js';
import { label as stackLabel, parseStack, stack } from './stack.js';
import { escapeXml, palette } from './svg.js';

const MAX = 100 * 1024; // RNF-01
const BACKGROUNDS = ['solid', 'transparent'];

// Todos los archivos en memoria, nombre → contenido, y por cada widget lo que
// necesita su snippet. Si algo falla, lanza antes de que se escriba nada (RF-06).
//   repos   lista de entradas de RF-01, o
//   pinned  usuario u organización cuyos fijados se usan (RF-02)
//   status  lista de `repo:status` para los repos que no lo traen
//   stack   el JSON de stack.json ya leído
//   colofon true para dibujar el stack como bandas de logos en loop, en vez de bloques
//   names   false para que stack y colofón muestren solo los íconos (por defecto, true)
//   nixie   lista de cifras (`stars`, `commits`) de `user`; commits cuenta `year`
//   banner  true para el banner pizarrón con `text`, o con `user` si no hay texto
//   iching  true para las últimas 52 semanas de `user` como hexagramas
//   matrix  lista de modos de la matriz Glyph (`text`, `pulse`, `fluid`); `text` usa
//           `text`, o `user` si no hay texto
//   ferrofluid  true para el ferrofluido (bandas de luz, sin datos)
//   background  `solid` (caja con fondo) o `transparent` (solo el borde). Sin él,
//           cada widget lleva el suyo: fichas y stack con caja, los decorativos
//           (banner, nixie, iching, colofon, matrix, ferrofluid) sin ella
export async function generate(
  { repos = [], pinned, status = [], stack: stackJson, layout = 'card', nixie: kinds = [], user, year = new Date().getUTCFullYear(), banner, text, iching, colofon, names: showNames = true, matrix: modes = [], ferrofluid, background },
  { get, graphql, icon = iconSource() },
) {
  if (!(layout in LAYOUTS)) throw new Error(`layout: "${layout}" no existe; usa ${Object.keys(LAYOUTS).join(', ')}`);
  if (background !== undefined && !BACKGROUNDS.includes(background)) throw new Error(`background: "${background}" no existe; usa ${BACKGROUNDS.join(', ')}`);
  if (repos.length && pinned) throw new Error('usa repos o pinned, no los dos');
  if (colofon && stackJson === undefined) throw new Error('colofon: falta stack, el stack.json cuyas categorías se vuelven bandas');
  if (!showNames && stackJson === undefined) throw new Error('names: solo aplica a los íconos de stack; pasa también stack');
  if (!repos.length && !pinned && stackJson === undefined && !kinds.length && !banner && !iching && !modes.length && !ferrofluid)
    throw new Error('no hay nada que generar: pasa repos, pinned, stack, nixie, banner, iching, matrix o ferrofluid');
  for (const kind of kinds) if (!KINDS.includes(kind)) throw new Error(`nixie: "${kind}" no existe; usa ${KINDS.join(', ')}`);
  if (new Set(kinds).size < kinds.length) throw new Error('nixie: hay una cifra repetida');
  if (kinds.length && !user) throw new Error('nixie: falta user, el usuario cuyas cifras se cuentan');
  if (iching && !user) throw new Error('iching: falta user, el usuario cuyas contribuciones se dibujan');
  for (const mode of modes) if (!MODES.includes(mode)) throw new Error(`matrix: "${mode}" no existe; usa ${MODES.join(', ')}`);
  if (new Set(modes).size < modes.length) throw new Error('matrix: hay un modo repetido');
  if (text !== undefined && !banner && !modes.includes('text')) throw new Error('text: es el texto del banner o de la matriz; pasa también banner o matrix text');
  const bannerText = banner ? (text ?? user) : undefined;
  if (banner && !bannerText) throw new Error('banner: falta text, o user para usar su nombre');
  if (banner) bannerLines(bannerText);
  if (modes.includes('text') && !(text ?? user)) throw new Error('matrix: falta text, o user para usar su nombre');
  const matrixText = modes.includes('text') ? glyphText(text ?? user) : undefined;
  const categories = stackJson === undefined ? [] : parseStack(stackJson);
  const statusMap = parseStatus(status);
  const targets = applyStatus(pinned ? await fetchPinned(pinned, graphql) : repos.map(parseRepo), statusMap);
  const fetched = await Promise.all(targets.map((r) => fetchRepo(r, get)));
  const counts = await Promise.all(
    kinds.map(async (kind) => ({ kind, login: user, year, count: await fetchCount(kind, user, year, graphql) })),
  );

  const hexagrams = iching ? { login: user, weeks: await fetchWeeks(user, graphql) } : undefined;

  const files = new Map();
  const widgets = [];
  // `own` es el fondo del widget cuando no se pidió uno.
  const add = (name, render, own = 'solid') => {
    for (const theme of Object.keys(tokens.themes)) {
      const file = `${name}-${theme}.svg`;
      const content = render(palette(theme, (background ?? own) === 'transparent'));
      const size = Buffer.byteLength(content);
      if (size > MAX) throw new Error(`${file} pesa ${Math.ceil(size / 1024)} KB y el límite es 100 KB; quita íconos o divídelo`);
      files.set(file, content);
    }
  };
  const iconsFor = async (names, versions) =>
    new Map(await Promise.all(names.map(async (k) => [k, await icon(k, versions)])));

  for (const repo of fetched) {
    const name = `card-${repo.name}`;
    if (widgets.some((w) => w.name === name)) throw new Error(`repos: dos repos se llaman ${repo.name}`);
    const icons = await iconsFor([...repo.languages.map(([l]) => l), ...repo.topics]);
    add(name, (t) => card(repo, t, icons, layout));
    widgets.push({ name, href: repo.url, alt: label(repo) });
  }
  for (const [index, category] of categories.entries()) {
    const names = category.items.map((i) => i.icon);
    if (colofon) {
      // Logos de un color, para teñirlos con el gis de la banda.
      const icons = await iconsFor(names, MONO);
      const name = `colofon-${category.slug}`;
      add(name, (t) => drawColofon(category, index, t, icons, showNames), 'transparent');
      widgets.push({ name, alt: stackLabel(category), stacked: true });
      continue;
    }
    const icons = await iconsFor(names);
    const name = `stack-${category.slug}`;
    add(name, (t) => stack(category, t, icons, showNames));
    widgets.push({ name, alt: stackLabel(category) });
  }
  for (const data of counts) {
    const name = `nixie-${data.kind}`;
    add(name, (t) => nixie(data, t), 'transparent');
    widgets.push({ name, alt: nixieLabel(data) });
  }
  if (banner) {
    add('banner', (t) => drawBanner({ text: bannerText }, t), 'transparent');
    widgets.push({ name: 'banner', alt: bannerLabel({ text: bannerText }) });
  }
  if (hexagrams) {
    add('iching', (t) => drawIching(hexagrams, t), 'transparent');
    widgets.push({ name: 'iching', alt: ichingLabel(hexagrams) });
  }
  for (const mode of modes) {
    const data = { mode, text: mode === 'text' ? matrixText : undefined };
    add(`matrix-${mode}`, (t) => drawMatrix(data, t), 'transparent');
    widgets.push({ name: `matrix-${mode}`, alt: matrixLabel(data) });
  }
  if (ferrofluid) {
    add('ferrofluid', ferro, 'transparent');
    widgets.push({ name: 'ferrofluid', alt: ferroLabel });
  }
  return { files, widgets };
}

// Bloque listo para pegar en el README (RF-05): un `<picture>` por widget que
// elige el tema de quien ve, dentro de un `<a>` al repo si es ficha. `base` es
// dónde quedan los SVG vistos desde el README (carpeta o URL). Las bandas del
// colofón (`stacked`) van separadas por `<br>`, para que se apilen aunque quepan dos a lo ancho.
export function snippet(widgets, base) {
  const src = (w, theme) => escapeXml(`${base.replace(/\/+$/, '')}/${w.name}-${theme}.svg`);
  return widgets
    .map((w, i) => {
      const picture =
        `<picture><source media="(prefers-color-scheme: dark)" srcset="${src(w, 'dark')}">` +
        `<img src="${src(w, 'light')}" width="${W}" alt="${escapeXml(w.alt)}"></picture>`;
      const html = w.href ? `<a href="${escapeXml(w.href)}">${picture}</a>` : picture;
      return w.stacked && widgets[i + 1]?.stacked ? `${html}<br>` : html;
    })
    .join('\n');
}

// Lo que hacen igual el CLI y la Action: leer `stack.json` (ruta), generar,
// escribir en `out` y devolver las rutas escritas y el snippet.
export async function run({ repos, pinned, status, stack: stackPath, layout, nixie: kinds, user, banner, text, iching, colofon, names, matrix, ferrofluid, background, out, base }, token) {
  let stackJson;
  if (stackPath) {
    try {
      stackJson = JSON.parse(readFileSync(stackPath, 'utf8'));
    } catch (err) {
      throw new Error(`stack: no se pudo leer ${stackPath}: ${err.message}`);
    }
  }
  const { files, widgets } = await generate(
    { repos, pinned, status, stack: stackJson, layout, nixie: kinds, user, banner, text, iching, colofon, names, matrix, ferrofluid, background },
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
                   [--stack stack.json [--colofon] [--no-names]] [--layout card|compact|row] [--nixie stars,commits --user usuario]
                   [--banner [--text texto]] [--iching --user usuario] [--matrix text,pulse,fluid] [--ferrofluid]
                   [--background solid|transparent] [--out carpeta] [--base ruta-o-url]`;

if (import.meta.main) {
  const { values } = parseArgs({
    allowNegative: true,
    options: {
      repos: { type: 'string' },
      pinned: { type: 'string' },
      status: { type: 'string' },
      stack: { type: 'string' },
      layout: { type: 'string', default: 'card' },
      nixie: { type: 'string' },
      user: { type: 'string' },
      banner: { type: 'boolean' },
      text: { type: 'string' },
      iching: { type: 'boolean' },
      colofon: { type: 'boolean' },
      names: { type: 'boolean', default: true },
      matrix: { type: 'string' },
      ferrofluid: { type: 'boolean' },
      background: { type: 'string' },
      out: { type: 'string', default: 'out' },
      base: { type: 'string' },
    },
  });
  if (!values.repos && !values.pinned && !values.stack && !values.nixie && !values.banner && !values.iching && !values.matrix && !values.ferrofluid) {
    console.error(USAGE);
    process.exit(2);
  }
  try {
    const { paths, html } = await run(
      { ...values, repos: list(values.repos), status: list(values.status), nixie: list(values.nixie), matrix: list(values.matrix) },
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
