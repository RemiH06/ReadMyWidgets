// Entradas de repos (RF-01) y datos de la API de GitHub para la ficha.

const API = 'https://api.github.com';
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const USAGE = 'usa https://github.com/dueño/repo o dueño/repo';

// `https://github.com/o/r` (con o sin `.git` o `/` final) u `o/r` → { owner, name }.
// Cualquier otra cosa lanza un error que dice cuál entrada y por qué.
export function parseRepo(input) {
  const raw = String(input).trim();
  const fail = (why) => {
    throw new Error(`repos: "${raw}" no es un repo válido: ${why}; ${USAGE}`);
  };
  let path = raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url;
    try {
      url = new URL(raw);
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
  return { owner, name };
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

// Lo que la ficha necesita de un repo. `get(path)` devuelve el JSON de la API.
// `topics` ya viene en `repos/{o}/{r}`: no hace falta pedir `/topics`.
export async function fetchRepo({ owner, name }, get) {
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
    year: repo.created_at.slice(0, 4),
    topics: repo.topics ?? [],
    languages: Object.entries(languages).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
  };
}
