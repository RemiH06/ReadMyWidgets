# Procedencia de los íconos

Las marcas son de sus dueños; aquí solo indican con qué está hecho un proyecto. Son los íconos que [devicon](https://devicon.dev) v2.16.0 (MIT) no tiene. ReadMyWidgets busca primero en devicon y después aquí, por el nombre sin mayúsculas, espacios, puntos ni guiones (`Hugging Face` → `huggingface`). Cuando un ícono no contrasta con el fondo, la herramienta lo ajusta al generar: a los SVG les cambia el color, a los PNG los aclara u oscurece con un filtro. Los archivos no se modifican.

| Archivo | Fuente | Licencia | Cambios |
|---|---|---|---|
| snowflake, scipy, huggingface, ray, ultralytics, pydantic, leaflet, prefect, mlflow, optuna, claude, quarto, obsidian (`.svg`) | [Simple Icons](https://simpleicons.org) 16.35.0 | CC0 1.0 | Color oficial de la marca horneado (`si_icon.py --fondo claro`) |
| lightgbm.svg | Repo de LightGBM (`docs/logo/LightGBM_logo_no_text.svg`) | MIT | Sin DOCTYPE ni comentario del editor |
| statsmodels.svg | Repo de statsmodels (`statsmodels-favicon-base.svg`) | BSD-3 | Sin metadatos de Inkscape |
| sql.svg | [Iconify](https://iconify.design), set vscode-icons (`file-type-sql`) | MIT | Ninguno. SQL no tiene logo propio |
| catboost, gymnasium, librosa (`.png`) | Logos oficiales en sus repos | Marcas de sus proyectos | Solo el símbolo; librosa sin texto. Copiados de `15.LambdasVault/docs/img/icons/` (aclarados para fondo negro) |
| xgboost.png | dmlc.github.io | Marca del proyecto | Logotipo de solo palabra, 66 px de ancho |
| postgis.png | Repo de PostGIS (`doc/html/images/static/PostGIS_logo.png`) | Marca del proyecto | Solo el elefante con el globo: sin texto y sin el fondo blanco |
| seaborn.png | Repo de seaborn (`doc/_static/logo-mark-lightbg.png`) | BSD-3 | En PNG porque el SVG pesa 268 KB |
| tidyverse.png | Repo de tidyverse (`man/figures/logo.png`) | MIT | Ninguno aparte de lo común |
| praat.png | Repo de Parselmouth, la interfaz de Praat en Python (`docs/images/logo.png`) | GPL-3.0 | Ninguno aparte de lo común. Praat no tiene logo propio |

Todos los PNG: RGBA de 8 bits, a lo más 66 px de lado (3× los 22 px a los que se dibujan) y reducidos a 64 colores; así pesan de 2 a 8 KB y una banda del colofón con 14 logos cabe en 100 KB.

`alias.json` dirige nombres al ícono de otra cosa: Cypher (y CQL) al de Neo4j, porque no tiene logo propio; YOLO al de Ultralytics, Ray RLlib al de Ray, Claude Code al de Claude y Parselmouth al de Praat.
