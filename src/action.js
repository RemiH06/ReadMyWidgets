// Entrada de la Action (action.yml): traduce los inputs a lo mismo que recibe
// el CLI. Corre en el workspace de quien la usa, así que `stack` y `out` son
// rutas de su repo.
import { appendFileSync } from 'node:fs';
import { run } from './cli.js';
import { list } from './repo.js';

// Actions pasa cada input como INPUT_<NOMBRE>; vacío si no se dio.
export function inputs(env = process.env) {
  const get = (name) => (env[`INPUT_${name.toUpperCase()}`] ?? '').trim();
  return {
    repos: list(get('repos')),
    pinned: get('pinned') || undefined,
    status: list(get('status')),
    stack: get('stack') || undefined,
    layout: get('layout') || 'card',
    nixie: list(get('nixie')),
    user: get('user') || undefined,
    banner: get('banner') === 'true',
    text: get('text') || undefined,
    iching: get('iching') === 'true',
    colofon: get('colofon') === 'true',
    background: get('background') || undefined,
    out: get('out') || 'widgets',
    base: get('base') || undefined,
  };
}

if (import.meta.main) {
  try {
    const { paths, html } = await run(inputs(), process.env.INPUT_TOKEN);
    console.log(`${paths.length} archivos:\n${paths.join('\n')}\n\nPara tu README:\n${html}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ReadMyWidgets\n\nPara tu README:\n\n\`\`\`html\n${html}\n\`\`\`\n`);
    }
  } catch (err) {
    // Anotación de error en la corrida; nada se escribió (RF-06).
    console.log(`::error::${err.message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
    process.exitCode = 1;
  }
}
