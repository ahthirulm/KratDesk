#!/usr/bin/env python3
"""Restrict the actual Supabase Compose ports without changing credentials or volumes."""
from pathlib import Path
import sys


def configure(text: str) -> str:
    output = []
    gateway_found = False
    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        newline = '\n' if line.endswith('\n') else ''
        indent = line[:len(line) - len(line.lstrip())]
        if stripped.startswith('-') and ':8000/tcp' in stripped and ('API_GW_HTTP_PORT' in stripped or 'KONG_HTTP_PORT' in stripped):
            output.append(f'{indent}- "127.0.0.1:8000:8000/tcp"{newline}')
            gateway_found = True
        elif stripped.startswith('-') and ':8443/tcp' in stripped and 'KONG_HTTPS_PORT' in stripped:
            continue
        elif stripped.startswith('-') and ':5432' in stripped and 'POSTGRES_PORT' in stripped:
            continue
        elif stripped.startswith('-') and ':6543' in stripped and 'POOLER_PROXY_PORT_TRANSACTION' in stripped:
            continue
        elif stripped.startswith('-') and ':3000' in stripped and 'STUDIO_PORT' in stripped:
            output.append(f'{indent}- "127.0.0.1:3001:3000"{newline}')
        else:
            output.append(line)
    if not gateway_found and '127.0.0.1:8000:8000/tcp' not in text:
        raise ValueError('No supported Envoy/API_GW or Kong HTTP port mapping was found')

    # Docker Compose rejects a null `ports:` value. If every mapping in a
    # block was removed (Supavisor normally loses both), emit an empty list.
    cleaned = []
    index = 0
    while index < len(output):
        line = output[index]
        if line.strip() == 'ports:':
            indent = line[:len(line) - len(line.lstrip())]
            next_index = index + 1
            has_entries = False
            while next_index < len(output):
                candidate = output[next_index]
                candidate_indent = candidate[:len(candidate) - len(candidate.lstrip())]
                if candidate.strip().startswith('-') and len(candidate_indent) > len(indent):
                    has_entries = True
                    next_index += 1
                else:
                    break
            if not has_entries:
                newline = '\n' if line.endswith('\n') else ''
                cleaned.append(f'{indent}ports: []{newline}')
                index = next_index
                continue
        cleaned.append(line)
        index += 1
    return ''.join(cleaned)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('Usage: configure-compose.py /path/to/docker-compose.yml')
    path = Path(sys.argv[1])
    original = path.read_text()
    updated = configure(original)
    if updated != original:
        path.write_text(updated)
    print('Supabase gateway is localhost-only; PostgreSQL and pooler host ports are disabled.')


if __name__ == '__main__':
    main()
