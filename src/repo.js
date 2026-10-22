// Entradas de repos (RF-01) y datos de la API de GitHub para la ficha.

const API = 'https://api.github.com';
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const USAGE = 'usa https://github.com/dueño/repo o dueño/repo, con :status opcional';

// Status que da el consumidor tras `:` (la API no lo sabe) → token de color.
export const STATUS = {
  activo: 'active', active: 'active',
  pausa: 'paused', pausado: 'paused', paused: 'paused',
  concluido: 'done', done: 'done',
  descontinuado: 'dropped', discontinued: 'dropped',
};
export const STATUS_LABEL = { active: 'activo', paused: 'en pausa', done: 'concluido', dropped: 'descontinuado' };

// `https://github.com/o/r` (con o sin `.git` o `/` final) u `o/r`, con `:status`
// opcional → { owner, name, status }. Cualquier otra cosa lanza un error que dice
// cuál entrada y por qué.
export function parseRepo(input) {
  const raw = String(input).trim();
  const fail = (why) => {
    throw new Error(`repos: "${raw}" no es un repo válido: ${why}; ${USAGE}`);
  };
  const [, bare, word] = raw.match(/^(.*?)(?::([^:/]*))?$/);
  const status = word === undefined ? null : STATUS[word.toLowerCase()];
  if (status === undefined) fail(`"${word}" no es un status (${Object.keys(STATUS).join(', ')})`);
  let path = bare;
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare)) {
    let url;
    try {
      url = new URL(bare);
    } catch {
      fail('la URL está mal formada');
    }
    if (url.protocol !== 'https:') fail(`el esquema es ${url.protocol} y debe ser https:`);
    if (url.hostname !== 'github.com') fail(`el dominio es ${url.hostname} y debe ser github.com`);
    if (url.search || url.hash) fail('la URL trae ? o #');
    path = url.pathname.slice(1).replace(/\/$/, '').replace(/\.git$/, '');
  }
  const parts = path.split('/');
  if (parts.length !== 2) fail(`tiene ${parts.length} partes y debe tener 2 (dueño y repo)`);
  const [owner, name] = parts;
  if (!OWNER.test(owner)) fail(`"${owner}" no es un nombre de usuario u organización de GitHub`);
  if (!NAME.test(name) || name === '.' || name === '..') fail(`"${name}" no es un nombre de repo de GitHub`);
  return { owner, name, status };
}

// Un input de lista: separado por comas o renglones, sin vacíos.
export const list = (text) => String(text ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

// `repo:status` por renglón o coma (para los repos de `pinned`, que no traen
// status) → Map de `dueño/repo` o `repo`, en minúsculas, a token de color.
export function parseStatus(entries) {
  const map = new Map();
  for (const raw of entries) {
    const m = raw.match(/^([^:\s]+)\s*:\s*([^:]*)$/);
    if (!m) throw new Error(`status: "${raw}" no es válido; usa repo:status, por ejemplo tanGo:activo`);
    const status = STATUS[m[2].toLowerCase()];
    if (!status) throw new Error(`status: "${m[2]}" no es un status (${Object.keys(STATUS).join(', ')})`);
    map.set(m[1].toLowerCase(), status);
  }
  return map;
}

// Le da a cada repo sin status el que diga `status`; una entrada que no
// corresponde a ningún repo falla (casi siempre es una errata).
export function applyStatus(targets, map) {
  const used = new Set();
  const out = targets.map((r) => {
    const k = [`${r.owner}/${r.name}`.toLowerCase(), r.name.toLowerCase()].find((x) => map.has(x));
    if (k) used.add(k);
    return r.status || !k ? r : { ...r, status: map.get(k) };
  });
  const unused = [...map.keys()].filter((k) => !used.has(k));
  if (unused.length) throw new Error(`status: ${unused.map((k) => `"${k}"`).join(', ')} no está entre los repos`);
  return out;
}

// GET a la API de GitHub; `token` es opcional (sin él, 60 peticiones por hora).
export function githubFetch(token) {
  return async (path) => {
    const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(API + path, { headers });
    if (!res.ok) {
      const err = new Error(`GitHub respondió ${res.status} a ${path}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  };
}

// POST a la API GraphQL; devuelve el JSON entero, `errors` incluido. GraphQL no
// acepta peticiones sin token (el `GITHUB_TOKEN` de Actions basta, PLAN §5).
export function githubGraphql(token) {
  return async (query, variables) => {
    if (!token) throw new Error('la API GraphQL pide un token; pasa GITHUB_TOKEN');
    const res = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`GitHub respondió ${res.status} a /graphql`);
    return res.json();
  };
}

// `repositoryOwner` cubre usuarios y organizaciones; seis es el máximo de fijados.
const PINNED = `query($login: String!) { repositoryOwner(login: $login) { ... on ProfileOwner {
  pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { nameWithOwner } } } } } }`;

// Los repos fijados de `login` en su orden (RF-02), como los da parseRepo.
export async function fetchPinned(login, graphql) {
  login = String(login).trim();
  if (!OWNER.test(login)) throw new Error(`pinned: "${login}" no es un nombre de usuario u organización de GitHub`);
  let res;
  try {
    res = await graphql(PINNED, { login });
  } catch (err) {
    throw new Error(`pinned: ${login}: ${err.message}`, { cause: err });
  }
  const nodes = res.data?.repositoryOwner?.pinnedItems?.nodes;
  if (!nodes) throw new Error(`pinned: ${login}: ${res.errors?.[0]?.message ?? 'no existe'}`);
  if (!nodes.length) throw new Error(`pinned: ${login} no tiene repos fijados`);
  return nodes.map((n) => {
    const [owner, name] = n.nameWithOwner.split('/');
    return { owner, name, status: null };
  });
}

// Lo que la ficha necesita de un repo. `get(path)` devuelve el JSON de la API.
// `topics` ya viene en `repos/{o}/{r}`: no hace falta pedir `/topics`.
// Sin status del consumidor, un repo archivado cuenta como descontinuado.
export async function fetchRepo({ owner, name, status = null }, get) {
  let repo, languages;
  try {
    [repo, languages] = await Promise.all([
      get(`/repos/${owner}/${name}`),
      get(`/repos/${owner}/${name}/languages`),
    ]);
  } catch (err) {
    const why =
      err.status === 404
        ? 'no existe o es privado'
        : err.status === 403 || err.status === 429
          ? 'GitHub limitó las peticiones; pasa un token'
          : err.message;
    throw new Error(`repos: ${owner}/${name}: ${why}`, { cause: err });
  }
  return {
    owner: repo.owner.login,
    name: repo.name,
    url: repo.html_url,
    description: repo.description ?? '',
    stars: repo.stargazers_count,
    archived: repo.archived,
    status: status ?? (repo.archived ? 'dropped' : null),
    year: repo.created_at.slice(0, 4),
    topics: repo.topics ?? [],
    languages: Object.entries(languages).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
  };
}
