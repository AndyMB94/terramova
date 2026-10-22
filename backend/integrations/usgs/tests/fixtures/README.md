# Fixtures de USGS

`all_day_sample.geojson`: recorte de 5 eventos del feed real
`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`, descargado el
2026-10-22 a las 02:27 UTC (`metadata.generated = 1792636054000`). Se conservan sin cambios
los eventos elegidos, el bloque `metadata` (salvo `count`, ajustado a 5) y `bbox`.

Incluye a propósito un evento con varios identificadores (`nc75452891`, con `ids`
`,nc75452891,nn00926046,us6000u3uq,`) y un evento que no es sismo (`uw714123632`,
`type: explosion`).

Los datos de USGS son de dominio público. Los casos inválidos (coordenadas fuera de rango,
nulos, JSON roto, etc.) se derivan de esta fixture dentro de cada test, no se versionan
como archivos.
