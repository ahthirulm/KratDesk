#!/usr/bin/env python3
"""Replace only KaratDesk location blocks, preserving Certbot and unrelated Nginx lines."""
from pathlib import Path
import re
import sys

INCLUDE = '/etc/nginx/snippets/karatdesk-locations.conf'
MANAGED_LOCATIONS = {'/', '/sb/', '/assets/'}


def matching_brace(text: str, opening: int) -> int:
    depth = 0
    quote = None
    escaped = False
    comment = False
    for index in range(opening, len(text)):
        char = text[index]
        if comment:
            if char == '\n':
                comment = False
            continue
        if escaped:
            escaped = False
            continue
        if char == '\\':
            escaped = True
            continue
        if quote:
            if char == quote:
                quote = None
            continue
        if char == '#':
            comment = True
        elif char in {'\"', "'"}:
            quote = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return index
    raise ValueError('Unbalanced Nginx block')


def depth_at(text: str, position: int) -> int:
    depth = 0
    quote = None
    escaped = False
    comment = False
    for char in text[:position]:
        if comment:
            if char == '\n':
                comment = False
            continue
        if escaped:
            escaped = False
            continue
        if char == '\\':
            escaped = True
            continue
        if quote:
            if char == quote:
                quote = None
            continue
        if char == '#':
            comment = True
        elif char in {'\"', "'"}:
            quote = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
    return depth


def configure_server(body: str, domain: str) -> tuple[str, bool]:
    names = re.search(r'(?m)^\s*server_name\s+([^;]+);', body)
    if not names or domain not in names.group(1).split():
        return body, False

    ranges = []
    location_pattern = re.compile(r'(?m)^[ \t]*location\s+(?:(?:\^~|=|~\*?)\s+)?(/sb/|/assets/|/)\s*\{')
    for match in location_pattern.finditer(body):
        if depth_at(body, match.start()) != 0 or match.group(1) not in MANAGED_LOCATIONS:
            continue
        opening = body.find('{', match.start(), match.end())
        ranges.append((match.start(), matching_brace(body, opening) + 1))
    include_pattern = re.compile(rf'(?m)^[ \t]*include\s+{re.escape(INCLUDE)};[ \t]*\r?\n?')
    for match in include_pattern.finditer(body):
        if depth_at(body, match.start()) == 0:
            ranges.append((match.start(), match.end()))
    for start, end in sorted(ranges, reverse=True):
        body = body[:start] + body[end:]

    names = re.search(r'(?m)^([ \t]*)server_name\s+[^;]+;[^\S\r\n]*\r?\n?', body)
    if not names:
        raise ValueError(f'server_name {domain} disappeared while updating Nginx')
    insertion = f'{names.group(1)}include {INCLUDE};\n'
    body = body[:names.end()] + insertion + body[names.end():]
    return body, True


def configure(text: str, domain: str) -> str:
    servers = []
    for match in re.finditer(r'(?m)^[ \t]*server\s*\{', text):
        opening = text.find('{', match.start(), match.end())
        servers.append((match.start(), opening, matching_brace(text, opening)))
    found = False
    for start, opening, closing in reversed(servers):
        body, changed = configure_server(text[opening + 1:closing], domain)
        if changed:
            text = text[:opening + 1] + body + text[closing:]
            found = True
    if not found:
        raise ValueError(f'No Nginx server block contains server_name {domain}')
    return text


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit('Usage: configure-nginx.py /path/to/site.conf pos.example.com')
    path = Path(sys.argv[1])
    path.write_text(configure(path.read_text(), sys.argv[2]))
    print(f'Nginx locations updated for {sys.argv[2]}; certificate and other settings were preserved.')


if __name__ == '__main__':
    main()
