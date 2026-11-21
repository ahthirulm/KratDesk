#!/usr/bin/env python3
"""Apply KaratDesk SQL migrations once, with an explicit v2 baseline for safe upgrades."""
from pathlib import Path
import os
import subprocess
import sys

DOCKER = os.environ.get('KD_DOCKER_BIN', 'docker')
PSQL_BASE = [DOCKER, 'exec', '-i', 'supabase-db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres']
TRACKING_TABLE = 'public.karatdesk_schema_migrations'


def query(sql: str) -> str:
    result = subprocess.run(PSQL_BASE + ['-Atqc', sql], text=True, capture_output=True)
    if result.returncode:
        sys.stderr.write(result.stderr)
        raise RuntimeError('Could not read the KaratDesk migration state')
    return result.stdout.strip()


def execute(sql: str, transaction: bool = False) -> None:
    command = PSQL_BASE + (['--single-transaction'] if transaction else [])
    result = subprocess.run(command, input=sql, text=True)
    if result.returncode:
        raise RuntimeError('Database command failed')


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit('Usage: migrate.py /path/to/backend /path/to/migrations')
    migrations_dir = Path(sys.argv[2])
    migrations = sorted(migrations_dir.glob('*.sql'))
    if not migrations:
        raise RuntimeError(f'No migrations found in {migrations_dir}')

    state = query(f"SELECT (to_regclass('{TRACKING_TABLE}') IS NOT NULL)::int || '|' || (to_regclass('public.profiles') IS NOT NULL)::int")
    tracking_exists, shop_exists = state == '1|1' or state == '1|0', state in {'0|1', '1|1'}
    execute(f"""CREATE TABLE IF NOT EXISTS {TRACKING_TABLE} (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON {TRACKING_TABLE} FROM PUBLIC, anon, authenticated;""")

    if shop_exists and not tracking_exists:
        baseline_path = migrations_dir.parent / 'v2-baseline.txt'
        baseline = [line.strip() for line in baseline_path.read_text().splitlines() if line.strip()]
        known = {path.name for path in migrations}
        missing = [name for name in baseline if name not in known]
        if missing:
            raise RuntimeError(f'The v2 baseline is missing migration files: {missing}')
        values = ','.join("('" + name.replace("'", "''") + "')" for name in baseline)
        execute(f'INSERT INTO {TRACKING_TABLE}(version) VALUES {values} ON CONFLICT DO NOTHING;')
        print(f'Existing v2 shop detected: recorded {len(baseline)} baseline migrations without rerunning them.')

    applied = set(query(f'SELECT version FROM {TRACKING_TABLE}').splitlines())
    for migration in migrations:
        if migration.name in applied:
            continue
        print(f'==> Applying migration {migration.name}', flush=True)
        record = f"\nINSERT INTO {TRACKING_TABLE}(version) VALUES ('{migration.name.replace(chr(39), chr(39) * 2)}');\n"
        try:
            execute(migration.read_text() + record, transaction=True)
        except RuntimeError:
            raise RuntimeError(
                f'Migration {migration.name} failed. It was not marked as applied and no later migration was attempted. '
                'Review the PostgreSQL error above, correct the package or database issue, then rerun install.sh.'
            )
        print(f'    Applied {migration.name}', flush=True)
    print(f'Database is current: {len(migrations)} migrations checked.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
