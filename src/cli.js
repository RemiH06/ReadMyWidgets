// node src/cli.js --repos RemiH06/Ariadne:activo,RemiH06/tanGo --layout compact --out out
// La Action llama a `generate` igual que este CLI; solo traduce sus inputs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import tokens from './tokens.json' with { type: 'json' };
import { LAYOUTS, card } from './card.js';
import { iconSource } from './icons.js';
import { fetchRepo, githubFetch, parseRepo } from './repo.js';

// Todos los archivos en memoria, nombre → contenido. Si algo falla, lanza antes
// de que se escriba nada (RF-06).
export async function generate(inputs, { get, icon = iconSource(), layout = 'card' }) {
  if (!(layout in LAYOUTS)) throw new Error(`layout: "${layout}" no existe; usa ${Object.keys(LAYOUTS).join(', ')}`);
  const targets = inputs.map(parseRepo);
  const repos = await Promise.all(targets.map((r) => fetchRepo(r, get)));
  const files = new Map();
  for (const repo of repos) {
    const names = [...repo.languages.map(([l]) => l), ...repo.topics];
    const icons = new Map(await Promise.all(names.map(async (k) => [k, await icon(k)])));
    for (const theme of Object.keys(tokens.themes)) {
      const file = `card-${repo.name}-${theme}.svg`;
      if (files.has(file)) throw new Error(`repos: dos repos se llaman ${repo.name}`);
      files.set(file, card(repo, theme, icons, layout));
    }
  }
  return files;
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { repos: { type: 'string' }, layout: { type: 'string', default: 'card' }, out: { type: 'string', default: 'out' } } });
  const inputs = (values.repos ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (!inputs.length) {
    console.error('Uso: node src/cli.js --repos dueño/repo[:status][,…] [--layout card|compact|row] [--out carpeta]');
    process.exit(2);
  }
  try {
    const files = await generate(inputs, { get: githubFetch(process.env.GITHUB_TOKEN), layout: values.layout });
    mkdirSync(values.out, { recursive: true });
    for (const [file, content] of files) writeFileSync(join(values.out, file), content);
    console.log([...files.keys()].map((f) => join(values.out, f)).join('\n'));
  } catch (err) {
    console.error(err.message);
    // exitCode y no exit(): con un fetch aún abierto, exit() tumba a libuv en Windows.
    process.exitCode = 1;
  }
}
