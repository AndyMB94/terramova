#!/usr/bin/env bash
# Copia de seguridad de PostgreSQL (docs/DEPLOYMENT.md, "Backups y rollback").
#
# Crea backups/terramova-<fecha UTC>.dump (formato custom de pg_dump) con su SHA-256,
# comprueba que el volcado se puede leer y borra las copias más antiguas que
# BACKUP_KEEP_DAYS. Los datos sísmicos se pueden volver a importar de USGS (30 días),
# pero el historial de sincronizaciones y la cobertura no: por eso se guarda todo.
#
# Uso (desde la raíz del repositorio):
#   infra/scripts/backup_db.sh                       # producción (compose.prod.yaml)
#   COMPOSE_CMD="docker compose" infra/scripts/backup_db.sh   # entorno de desarrollo
# Variables: BACKUP_DIR (por defecto backups/), BACKUP_KEEP_DAYS (por defecto 14).
#
# Cifrado y copia fuera del VPS: pendientes de decidir destino y coste (D119).
set -euo pipefail

cd "$(dirname "$0")/../.."
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
read -r -a COMPOSE <<< "${COMPOSE_CMD:-docker compose -f compose.yaml -f compose.prod.yaml}"

# Las copias contienen toda la base: solo legibles por el propietario.
umask 077
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/terramova-$stamp.dump"
partial="$target.part"
trap 'rm -f "$partial"' EXIT

# Usuario y base se leen dentro del contenedor: el script no necesita las credenciales.
# shellcheck disable=SC2016  # las comillas simples son a propósito: expande el contenedor
"${COMPOSE[@]}" exec -T db sh -c \
    'pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    > "$partial"

# Un volcado vacío o ilegible no cuenta como copia.
if [ ! -s "$partial" ]; then
    echo "El volcado está vacío: no se guarda ninguna copia." >&2
    exit 1
fi
"${COMPOSE[@]}" exec -T db pg_restore --list < "$partial" > /dev/null

mv "$partial" "$target"
(cd "$BACKUP_DIR" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256")

find "$BACKUP_DIR" -maxdepth 1 -name 'terramova-*.dump*' -mtime +"$KEEP_DAYS" -print -delete

echo "Copia creada: $target ($(du -h "$target" | cut -f1))"
