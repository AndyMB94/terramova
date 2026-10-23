"""Comprueba las Reglas de red de docs/DEPLOYMENT.md sobre la configuración de Compose.

Lee la salida de `docker compose config --format json` (ya combinada, con variables
resueltas) y falla si:
  - algún puerto se publica fuera de 127.0.0.1 (Docker se salta UFW: 0.0.0.0 es público);
  - en producción, db o redis publican algún puerto, o publica algo que no sea el backend
    en 127.0.0.1:8100;
  - algún servicio usa la red del host.

Origen: en Vacantia, un Redis sin contraseña publicado en 0.0.0.0 fue secuestrado.

Uso (lo hace `make check-ports`):
    docker compose -f compose.yaml -f compose.prod.yaml config --format json \\
        | python3 infra/scripts/check_compose_ports.py --prod
"""

import argparse
import json
import sys
from typing import Any

LOOPBACK = "127.0.0.1"
PROD_PUBLISHED = {("backend", "8100", 8000)}


def violations(config: dict[str, Any], *, prod: bool) -> list[str]:
    problems: list[str] = []
    published: set[tuple[str, str, int]] = set()
    for name, service in sorted(config.get("services", {}).items()):
        if service.get("network_mode") == "host":
            problems.append(f"{name}: network_mode host expone todos sus puertos")
        for port in service.get("ports", []):
            host_ip = port.get("host_ip") or "0.0.0.0"  # sin IP, Docker escucha en todas
            if host_ip != LOOPBACK:
                problems.append(
                    f"{name}: publica {host_ip}:{port.get('published')} (solo se permite {LOOPBACK})"
                )
            published.add((name, str(port.get("published")), int(port.get("target", 0))))
    if prod:
        for name in ("db", "redis"):
            if config.get("services", {}).get(name, {}).get("ports"):
                problems.append(f"{name}: en producción no puede publicar ningún puerto")
        for name, host_port, target in sorted(published - PROD_PUBLISHED):
            problems.append(f"{name}: publica {host_port}->{target}; en producción solo backend 8100->8000")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--prod", action="store_true", help="Aplica las reglas de producción")
    args = parser.parse_args()
    try:
        config = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Compose no pudo resolver la configuración: se falla en vez de dar por buena.
        print("No se pudo leer la configuración de Compose (¿es válida?).", file=sys.stderr)
        return 1
    problems = violations(config, prod=args.prod)
    label = "producción" if args.prod else "desarrollo"
    if problems:
        print(f"Reglas de red incumplidas ({label}):", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    print(f"Reglas de red cumplidas ({label}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
