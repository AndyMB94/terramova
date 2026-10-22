"""Genera los recursos estáticos del globo a partir de fuentes públicas verificadas.

- Teselas de NASA Blue Marble (dominio público en EE. UU.; crédito: NASA Earth Observatory)
  en el esquema geográfico de Cesium: nivel z = 2^(z+1) x 2^z teselas de 256 px.
- Fronteras terrestres de Natural Earth 1:110m (dominio público), sin propiedades y con
  coordenadas redondeadas para reducir el peso.

Cada fuente se descarga una vez a una caché fuera del repositorio y se comprueba su
SHA-256 antes de usarla. La salida se versiona en frontend/public/ (docs/DECISIONS.md).

Uso (desde la raíz del repo):
    uv run --no-project --with pillow==12.0.0 python infra/scripts/build_globe_assets.py \
        --cache ~/.cache/terramova
"""

import argparse
import hashlib
import json
import shutil
import sys
import urllib.request
from pathlib import Path

from PIL import Image

BLUE_MARBLE = {
    "url": "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/"
    "world.topo.bathy.200412.3x21600x10800.jpg",
    # Suma de verificación pública del archivo de NASA, no un secreto.
    "sha256": "3006c58b1272362db0a8c2df02dc07cea4b12dfe820b7dc4a159a075caf5d4d4",  # pragma: allowlist secret
    "file": "bluemarble-world.topo.bathy.200412-21600.jpg",
}
BORDERS = {
    "url": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/"
    "geojson/ne_110m_admin_0_boundary_lines_land.geojson",
    "sha256": "d42479fd79552cca4eec7f85fcdca717a790d29ff06be7676f1af0568c6d3f7c",  # pragma: allowlist secret
    "file": "ne_110m_admin_0_boundary_lines_land-v5.1.2.geojson",
}

TILE_SIZE = 256
MAX_LEVEL = 4  # 8192 x 4096 px en el nivel más detallado (decisión del propietario)
JPEG_QUALITY = 82
COORDINATE_DECIMALS = 3  # ~100 m, de sobra para 1:110m

REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC = REPO_ROOT / "frontend" / "public"


def fetch(source: dict[str, str], cache: Path) -> Path:
    target = cache / source["file"]
    if not target.exists():
        print(f"Descargando {source['url']}")
        cache.mkdir(parents=True, exist_ok=True)
        partial = target.with_suffix(".part")
        with urllib.request.urlopen(source["url"], timeout=120) as response, partial.open("wb") as out:  # noqa: S310 - URL fija
            shutil.copyfileobj(response, out)
        partial.rename(target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    if digest != source["sha256"]:
        raise SystemExit(f"SHA-256 inesperado para {target.name}: {digest}")
    return target


def build_tiles(source: Path, out_dir: Path) -> int:
    # La imagen (233 Mpx) supera el límite anti "decompression bomb" de Pillow; es una
    # fuente fija y verificada por hash.
    Image.MAX_IMAGE_PIXELS = None
    world = Image.open(source).convert("RGB")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    count = 0
    for level in range(MAX_LEVEL + 1):
        cols, rows = 2 ** (level + 1), 2**level
        scaled = world.resize((cols * TILE_SIZE, rows * TILE_SIZE), Image.Resampling.LANCZOS)
        for x in range(cols):
            column = out_dir / str(level) / str(x)
            column.mkdir(parents=True, exist_ok=True)
            for y in range(rows):  # y = 0 es la fila más al norte
                box = (x * TILE_SIZE, y * TILE_SIZE, (x + 1) * TILE_SIZE, (y + 1) * TILE_SIZE)
                scaled.crop(box).save(
                    column / f"{y}.jpg", quality=JPEG_QUALITY, optimize=True, progressive=True
                )
                count += 1
    return count


def build_borders(source: Path, target: Path) -> int:
    data = json.loads(source.read_text(encoding="utf-8"))
    lines: list[list[list[float]]] = []
    for feature in data["features"]:
        geometry = feature["geometry"]
        parts = (
            geometry["coordinates"]
            if geometry["type"] == "MultiLineString"
            else [geometry["coordinates"]]
        )
        for part in parts:
            lines.append(
                [[round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)] for lon, lat in part]
            )
    collection = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "MultiLineString", "coordinates": lines},
            }
        ],
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(collection, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, required=True, help="Caché de descargas (fuera del repo)")
    args = parser.parse_args()
    cache = args.cache.expanduser()

    tiles = build_tiles(fetch(BLUE_MARBLE, cache), PUBLIC / "imagery" / "blue-marble")
    lines = build_borders(fetch(BORDERS, cache), PUBLIC / "geo" / "borders-110m.geojson")
    print(f"Teselas: {tiles} (niveles 0–{MAX_LEVEL}). Fronteras: {lines} líneas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
