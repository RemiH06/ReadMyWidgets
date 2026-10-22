// Colores de lenguaje de GitHub Linguist (MIT) → src/linguist.json, nombre → #rrggbb.
// Solo si sube la versión:  node tools/linguist.js
import { writeFileSync } from 'node:fs';

const VERSION = 'v9.4.0';
const URL_YML = `https://raw.githubusercontent.com/github-linguist/linguist/${VERSION}/lib/linguist/languages.yml`;

const yml = await (await fetch(URL_YML)).text();
const colors = {};
let name = null;
for (const line of yml.split('\n')) {
  const key = line.match(/^([^\s#-].*):\s*$/);
  if (key) name = key[1].replace(/^"(.*)"$/, '$1');
  const color = line.match(/^  color: "(#[0-9a-fA-F]{6})"/);
  if (name && color) colors[name] = color[1].toLowerCase();
}
writeFileSync(
  new URL('../src/linguist.json', import.meta.url),
  JSON.stringify({ version: VERSION, colors }, null, 0) + '\n',
);
console.log(`${Object.keys(colors).length} colores de Linguist ${VERSION}`);
