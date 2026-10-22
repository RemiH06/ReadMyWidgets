![Built with Love](https://forthebadge.com/images/badges/built-with-love.svg)
![Uses Git](https://forthebadge.com/images/badges/uses-git.svg)
![Uses JS](https://forthebadge.com/images/badges/uses-js.svg)

```ascii
██████╗ ███╗   ███╗██╗    ██╗
██╔══██╗████╗ ████║██║    ██║
██████╔╝██╔████╔██║██║ █╗ ██║
██╔══██╗██║╚██╔╝██║██║███╗██║
██║  ██║██║ ╚═╝ ██║╚███╔███╔╝
╚═╝  ╚═╝╚═╝     ╚═╝ ╚══╝╚══╝

ReadMyWidgets: widgets en SVG para tu README de perfil
by Hex (@RemiH06)          version 0.0.0
```

![MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)

---

## Descripción general

**ReadMyWidgets** es una GitHub Action que genera fichas de repositorio y otros
widgets como SVG estáticos para el README de tu perfil. Cada archivo es
autocontenido (fuente e íconos incrustados, sin peticiones externas ni
JavaScript), pesa menos de 100 KB y sale en versión oscura y clara para que
GitHub muestre la que corresponde al tema de quien lo ve.

La ficha está pensada como la cédula que acompaña a una obra en un museo:
texto sobrio y jerarquía clara, para acompañar el resto de tu perfil sin
competir con él. Los datos salen de la API de GitHub; lo único que GitHub no
sabe, el estado de cada proyecto, lo das tú.

```diff
- En desarrollo: por ahora se usa como CLI local; la Action (action.yml) llega en la iteración 3
- Las fichas son lo único terminado; el bloque de stack y los widgets decorativos están en camino
```

## Galería

<table>
  <tr><th>Widget</th><th>Vista</th></tr>
  <tr>
    <td><b>Ficha</b><br><code>layout: card</code><br>Nombre, técnica y fecha, descripción en 2 líneas, barra y leyenda de lenguajes.</td>
    <td><a href="https://github.com/RemiH06/tanGo"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/gallery/card/card-tanGo-dark.svg"><img src="docs/gallery/card/card-tanGo-light.svg" width="400" alt="tanGo: Intelligent traffic light (activo)"></picture></a></td>
  </tr>
  <tr>
    <td><b>Ficha compacta</b><br><code>layout: compact</code><br>Para apilar varias: 1 línea de descripción, fecha y estrellas junto al título.</td>
    <td><a href="https://github.com/RemiH06/LinNeo"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/gallery/compact/card-LinNeo-dark.svg"><img src="docs/gallery/compact/card-LinNeo-light.svg" width="400" alt="LinNeo: All described species graph. Serves species pages, search engine, geographic filters and thematic ui. (en pausa)"></picture></a></td>
  </tr>
  <tr>
    <td><b>Renglón</b><br><code>layout: row</code><br>Una línea por repo; apilados se leen como un índice.</td>
    <td><a href="https://github.com/RemiH06/mapoDoufu"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/gallery/row/card-mapoDoufu-dark.svg"><img src="docs/gallery/row/card-mapoDoufu-light.svg" width="400" alt="mapoDoufu: Sistema de apoyo a decisiones basado en datos abiertos de México (activo)"></picture></a><br><a href="https://github.com/RemiH06/SaveTrack"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/gallery/row/card-SaveTrack-dark.svg"><img src="docs/gallery/row/card-SaveTrack-light.svg" width="400" alt="SaveTrack: Financial organization app (concluido)"></picture></a><br><a href="https://github.com/RemiH06/Ariadne"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/gallery/row/card-Ariadne-dark.svg"><img src="docs/gallery/row/card-Ariadne-light.svg" width="400" alt="Ariadne: Documentation graph generator for any project with any tools. (activo)"></picture></a></td>
  </tr>
  <tr>
    <td><b>Bloque de stack</b><br><code>stack: stack.json</code><br>Un bloque por categoría, con ícono y nombre de cada tecnología en el orden que le des.</td>
    <td><picture><source media="(prefers-color-scheme: dark)" srcset="docs/gallery/stack/stack-languages-dark.svg"><img src="docs/gallery/stack/stack-languages-light.svg" width="400" alt="Languages: Python, Kotlin, Elixir, JavaScript, TypeScript, R, SQL, CQL (Cypher), HTML, CSS"></picture></td>
  </tr>
  <tr><td><b>Banner pizarrón</b></td><td>En camino: texto en gis de doble trazo sobre rejilla hexagonal, animado con CSS.</td></tr>
  <tr><td><b>Hexagramas</b></td><td>En camino: tus contribuciones dibujadas como hexagramas del I Ching.</td></tr>
  <tr><td><b>Matriz de puntos</b></td><td>En camino: matriz tipo Glyph con texto propio, pulso desde el centro o deriva lenta.</td></tr>
  <tr><td><b>Nixie</b></td><td>En camino: tubos nixie con tus estrellas o tus commits del año.</td></tr>
  <tr><td><b>Ferrofluido</b></td><td>En camino: mancha de ferrofluido animada, decorativa.</td></tr>
  <tr><td><b>Objeto 3D</b></td><td>En camino: un modelo <code>.glb</code> propio o una bola disco girando lento.</td></tr>
</table>

El punto junto al nombre es el estado del proyecto: azul activo, amarillo en
pausa, gris concluido, rojo descontinuado. Los colores de la barra son los de
GitHub para cada lenguaje.

## Instalación

1. Clona el repo; necesitas Node 24 o más reciente y nada más (sin `npm install`).

   ```bash
   git clone https://github.com/RemiH06/ReadMyWidgets.git
   cd ReadMyWidgets
   ```

2. Genera las fichas de tus repos y, si quieres, tu bloque de stack:

   ```bash
   node src/cli.js --repos tuUsuario/repo:activo,tuUsuario/otro:pausa --layout compact --out widgets
   node src/cli.js --pinned tuUsuario --status repo:activo --stack stack.json --out widgets
   ```

   El CLI escribe los SVG en `widgets/` e imprime el HTML listo para pegar en tu
   README: un `<picture>` por widget, con versión oscura y clara, enlace al repo
   y `alt` con su nombre y descripción.

3. Sube los SVG a tu repo de perfil y pega el HTML en el README.

`stack.json` es un objeto de categoría → lista de tecnologías, en el orden en
que quieres verlas. El ícono se busca por nombre en devicon; si el nombre que
muestras no es el del ícono, dalo aparte:

```json
{
  "Languages": ["Python", "Kotlin", { "name": "SQL", "icon": "postgresql" }],
  "Data & ML": ["pandas", "PyTorch", "statsmodels"]
}
```

Lo que no tiene ícono sale solo con su nombre.

## Argumentos

- `--repos` Lista separada por comas de `dueño/repo` o `https://github.com/dueño/repo`, cada uno con `:status` opcional: `activo`, `pausa`, `concluido` o `descontinuado` (también `active`, `paused`, `done`, `discontinued`). Sin status, un repo archivado sale como descontinuado.
- `--pinned` En lugar de `--repos`: los repos fijados de ese usuario u organización, en su orden. Necesita `GITHUB_TOKEN`.
- `--status` Lista de `repo:status` (o `dueño/repo:status`) para los repos que no lo traen, como los de `--pinned`. Un nombre que no esté entre los repos es error.
- `--stack` Ruta a un `stack.json`; genera un bloque por categoría (`stack-<categoría>-dark.svg` y `-light.svg`).
- `--layout` `card` (por defecto), `compact` o `row`.
- `--out` Carpeta de salida, `out` por defecto.
- `--base` Ruta o URL de los SVG vista desde tu README, para el HTML que se imprime; por defecto, la de `--out`.
- `GITHUB_TOKEN` (variable de entorno) Opcional con `--repos` (sin token la API permite 60 peticiones por hora); obligatorio con `--pinned`, porque la API GraphQL no responde sin token.

Si algo falla (un repo que no existe, un `stack.json` mal formado, un widget de
más de 100 KB), no se escribe ningún archivo y el mensaje dice cuál entrada y por qué.

## Características

- SVG autocontenidos: fuente RMW Sans (subset de Hubot Sans, OFL) e íconos de devicon incrustados.
- Tema oscuro y claro de cada widget, con contraste WCAG verificado por pruebas.
- Texto medido con las métricas reales de la fuente y cortado con "…": nunca se desborda.
- Legible en el teléfono: el texto más chico no baja de 12 px al escalar a la columna.
- Salida determinista: mismos datos, mismos bytes.
- Sin dependencias de npm ni paso de build.

## Funciones futuras

- La Action (`uses: RemiH06/ReadMyWidgets@v1`), para que tu perfil se actualice solo.
- Los widgets decorativos de la galería.

## Créditos

Íconos de [devicon](https://github.com/devicons/devicon) (MIT). Colores de lenguaje de
[GitHub Linguist](https://github.com/github-linguist/linguist) (MIT). Hubot Sans de GitHub (OFL, ver `fonts/OFL.txt`).

## Autoría

por Hex ([@RemiH06](https://github.com/RemiH06))
