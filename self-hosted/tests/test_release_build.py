"""Check release assembly rules without rebuilding the application or touching a backend."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import unittest

SELF_HOSTED = Path(__file__).resolve().parents[1]
PROJECT = SELF_HOSTED.parent
PREVIEW_COMMENT = '0078_restore_karatdesk_preview_history.sql'


class MigrationPackagingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        root = Path(cls.temp.name) / 'source'
        root.mkdir()
        shutil.copytree(SELF_HOSTED, root / 'self-hosted', ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        (root / 'src/lib').mkdir(parents=True)
        shutil.copyfile(PROJECT / 'src/lib/version.ts', root / 'src/lib/version.ts')
        (root / 'public').mkdir()
        (root / 'node_modules').mkdir()
        for name in ['package.json', 'tsconfig.json', 'bunfig.toml', 'components.json']:
            shutil.copyfile(PROJECT / name, root / name)
        shutil.copytree(PROJECT / 'drizzle/migrations', root / 'drizzle/migrations')
        fake_bin = Path(cls.temp.name) / 'bin'
        fake_bin.mkdir()
        fake_bun = fake_bin / 'bun'
        fake_bun.write_text('#!/usr/bin/env python3\nfrom pathlib import Path\np=Path(".output/server"); p.mkdir(parents=True); (p/"index.mjs").write_text("// Test build output\\n")\n')
        fake_bun.chmod(0o755)
        cls.output = Path(cls.temp.name) / 'output'
        env = dict(os.environ)
        env['PATH'] = str(fake_bin) + os.pathsep + env.get('PATH', '')
        subprocess.run(['node', str(root / 'self-hosted/build.mjs'), str(cls.output)], env=env, capture_output=True, text=True, check=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_preview_comment_is_not_a_dell_migration(self):
        self.assertTrue((PROJECT / 'drizzle/migrations' / PREVIEW_COMMENT).is_file())
        self.assertFalse((self.output / 'database/migrations' / PREVIEW_COMMENT).exists())

    def test_original_78_production_migrations_are_packaged_unchanged(self):
        expected = sorted(p for p in (PROJECT / 'drizzle/migrations').glob('*.sql') if p.name != PREVIEW_COMMENT)
        actual = sorted((self.output / 'database/migrations').glob('*.sql'))
        self.assertEqual(len(actual), 78)
        self.assertEqual([p.name for p in actual], [p.name for p in expected])
        for source, packaged in zip(expected, actual):
            self.assertEqual(source.read_bytes(), packaged.read_bytes(), source.name)


if __name__ == '__main__':
    unittest.main()