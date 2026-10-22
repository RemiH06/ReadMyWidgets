"""Genera los subsets .woff2 de Hubot Sans y metrics.json.

Se corre una vez (o al cambiar el rango de caracteres); la salida va versionada
y el runtime de Node solo la lee. Requiere fontTools y brotli.

    python tools/font.py
"""
import base64
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "fonts"

# "Hubot Sans" es Reserved Font Name en el OFL y un subset cuenta como versión
# modificada, así que el subset lleva otro nombre.
FAMILY = "RMW Sans"

VARIANTS = {
    "regular": ("HubotSans-Regular.ttf", "Regular"),
    "bold": ("HubotSans-Bold.ttf", "Bold"),
}

# Latin-1 imprimible más la puntuación tipográfica que aparece en descripciones
# de repos; U+2026 es el "…" del truncado (RF-04).
CODEPOINTS = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026]
)


def rename(font, style):
    for record in font["name"].names:
        if record.nameID in (1, 16):
            record.string = FAMILY
        elif record.nameID in (2, 17):
            record.string = style
        elif record.nameID == 4:
            record.string = f"{FAMILY} {style}"
        elif record.nameID == 6:
            record.string = f"{FAMILY.replace(' ', '')}-{style}"


def build(src, style, out):
    options = subset.Options()
    options.flavor = "woff2"
    # shortcut: sin kerning ni GPOS; metrics.json mide solo avances, así que lo
    # que se dibuja coincide con lo que se mide.
    options.layout_features = []
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 16, 17]
    options.notdef_outline = True

    font = subset.load_font(str(FONTS / src), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=CODEPOINTS)
    subsetter.subset(font)
    rename(font, style)
    subset.save_font(font, str(out), options)


def measure(path):
    font = TTFont(str(path))
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    os2 = font["OS/2"]
    return {
        "unitsPerEm": font["head"].unitsPerEm,
        "ascender": os2.sTypoAscender,
        "descender": os2.sTypoDescender,
        "capHeight": os2.sCapHeight,
        "fallback": hmtx[".notdef"][0],
        "advances": {str(cp): hmtx[cmap[cp]][0] for cp in sorted(cmap)},
    }


def main():
    metrics = {"family": FAMILY, "variants": {}}
    for key, (src, style) in VARIANTS.items():
        out = FONTS / f"rmw-sans-{key}.woff2"
        build(src, style, out)
        metrics["variants"][key] = measure(out)
        size = out.stat().st_size
        b64 = len(base64.b64encode(out.read_bytes()))
        print(f"{out.name}: {size} B, {b64} B en base64")
    (FONTS / "metrics.json").write_text(
        json.dumps(metrics, indent=1, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
