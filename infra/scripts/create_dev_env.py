"""Crea .env para desarrollo a partir de .env.example con secretos aleatorios.

No sobrescribe un .env existente. Uso: python3 infra/scripts/create_dev_env.py
"""

import secrets
import sys
from pathlib import Path

PLACEHOLDER = "change-me"
REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    template = REPO_ROOT / ".env.example"
    target = REPO_ROOT / ".env"
    if target.exists():
        print(".env ya existe; no se modifica.")
        return 0

    lines = []
    for line in template.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and not key.lstrip().startswith("#") and value == PLACEHOLDER:
            line = f"{key}={secrets.token_urlsafe(32)}"
        lines.append(line)

    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    target.chmod(0o600)
    print(".env creado con valores aleatorios (permisos 600).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
