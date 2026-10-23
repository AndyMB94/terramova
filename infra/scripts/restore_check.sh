#!/usr/bin/env bash
# Prueba de restauración en una base AISLADA (docs/DEPLOYMENT.md): una copia que no se ha
# restaurado nunca no es una copia. No toca la base de producción ni la de desarrollo.
#
# Verifica el SHA-256, restaura el volcado en un PostgreSQL temporal sin red (misma
# versión que compose.yaml), muestra cuántas filas tienen las tablas principales y
# borra el contenedor al terminar.
#
# Uso: infra/scripts/restore_check.sh backups/terramova-<fecha>.dump
set -euo pipefail

dump="${1:?Indica el volcado: infra/scripts/restore_check.sh backups/terramova-<fecha>.dump}"
cd "$(dirname "$0")/../.."

(cd "$(dirname "$dump")" && sha256sum --check --quiet "$(basename "$dump").sha256")
echo "SHA-256 correcto."

image="$(sed -n 's/^ *image: \(postgres:[^ ]*\)$/\1/p' compose.yaml | head -n 1)"
container="terramova-restore-check-$$"
trap 'docker rm -f "$container" > /dev/null 2>&1 || true' EXIT

# Sin red: el contenedor temporal no es accesible desde fuera ni desde otros servicios.
docker run -d --name "$container" --network none \
    -e POSTGRES_PASSWORD="$(head -c 24 /dev/urandom | base64)" -e POSTGRES_DB=restore \
    "$image" > /dev/null
for _ in $(seq 1 60); do
    docker exec "$container" pg_isready -U postgres -d restore > /dev/null 2>&1 && break
    sleep 1
done

docker exec -i "$container" pg_restore --no-owner --exit-on-error -U postgres -d restore < "$dump"

docker exec "$container" psql -U postgres -d restore -At -F ' ' -c "
    SELECT 'eventos', count(*) FROM earthquakes_earthquake
    UNION ALL SELECT 'sincronizaciones', count(*) FROM earthquakes_syncrun
    UNION ALL SELECT 'migraciones', count(*) FROM django_migrations;"
echo "Restauración correcta en una base aislada ($image)."
