import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


compose = load('configure_compose', ROOT / 'deploy' / 'configure-compose.py')
nginx = load('configure_nginx', ROOT / 'deploy' / 'configure-nginx.py')


class ComposeTests(unittest.TestCase):
    def test_pinned_envoy_ports_are_private_and_idempotent(self):
        source = (ROOT / 'backend' / 'docker-compose.yml').read_text()
        result = compose.configure(source)
        self.assertEqual(result.count('127.0.0.1:8000:8000/tcp'), 1)
        self.assertNotIn('${POSTGRES_PORT}:5432', result)
        self.assertNotIn('${POOLER_PROXY_PORT_TRANSACTION}:6543', result)
        self.assertEqual(compose.configure(result), result)

    def test_legacy_kong_ports_are_also_restricted(self):
        sample = '''services:\n  kong:\n    ports:\n      - 127.0.0.1:${KONG_HTTP_PORT}:8000/tcp\n      - ${KONG_HTTPS_PORT}:8443/tcp\n  supabase-pooler:\n    ports:\n      - ${POSTGRES_PORT}:5432\n      - ${POOLER_PROXY_PORT_TRANSACTION}:6543\n'''
        result = compose.configure(sample)
        self.assertIn('127.0.0.1:8000:8000/tcp', result)
        self.assertNotIn('8443', result)
        self.assertNotIn('6543', result)
        self.assertNotIn(':5432', result)

    def test_fully_unpublished_services_use_an_empty_ports_array(self):
        sample = '''services:\n  api-gw:\n    ports:\n      - ${API_GW_HTTP_PORT:-8000}:8000/tcp\n  supavisor:\n    ports:\n      - ${POSTGRES_PORT}:5432\n      - ${POOLER_PROXY_PORT_TRANSACTION}:6543\n    volumes:\n      - ./volumes/pooler/pooler.exs:/app/pooler.exs\n'''
        result = compose.configure(sample)
        self.assertIn('  supavisor:\n    ports: []\n    volumes:', result)
        self.assertNotIn('ports:\n    volumes:', result)
        self.assertEqual(compose.configure(result), result)

    def test_real_supavisor_ports_become_an_empty_array(self):
        source = (ROOT / 'backend' / 'docker-compose.yml').read_text()
        result = compose.configure(source)
        self.assertIn('  supavisor:\n    container_name: supabase-pooler', result)
        self.assertIn('    ports: []\n    volumes:', result)


class NginxTests(unittest.TestCase):
    def test_public_api_prefixes_survive_gateway_forwarding(self):
        snippet = (ROOT / 'deploy' / 'nginx-locations.conf').read_text()
        for prefix in ('auth/v1', 'rest/v1', 'storage/v1'):
            self.assertIn(
                f'location ^~ /sb/{prefix}/ {{\n  proxy_pass http://127.0.0.1:8000/{prefix}/;',
                snippet.replace('  # A URI on proxy_pass replaces only the matched /sb/auth/v1/ prefix.\n  # /sb/auth/v1/token therefore reaches the gateway as /auth/v1/token.\n', ''),
            )
        self.assertNotIn('proxy_pass http://127.0.0.1:8000/;', snippet)

    def test_v2_certbot_settings_survive_and_locations_do_not_duplicate(self):
        sample = '''server {\n  listen 80;\n  server_name pos.example.com;\n  client_max_body_size 60m;\n  location /sb/ {\n    proxy_pass http://127.0.0.1:8000/;\n  }\n  location /assets/ {\n    alias /opt/karatdesk/.runtime/public/assets/;\n  }\n  location / {\n    proxy_pass http://127.0.0.1:3000;\n  }\n  listen 443 ssl; # managed by Certbot\n  ssl_certificate /etc/letsencrypt/live/pos.example.com/fullchain.pem; # managed by Certbot\n  ssl_certificate_key /etc/letsencrypt/live/pos.example.com/privkey.pem; # managed by Certbot\n  if ($scheme != "https") {\n    return 301 https://$host$request_uri;\n  } # managed by Certbot\n}\n'''
        result = nginx.configure(sample, 'pos.example.com')
        self.assertEqual(result.count('include /etc/nginx/snippets/karatdesk-locations.conf;'), 1)
        self.assertNotIn('location /sb/', result)
        self.assertNotIn('location /assets/', result)
        self.assertEqual(result.count('# managed by Certbot'), 4)
        self.assertIn('return 301 https://$host$request_uri;', result)
        self.assertEqual(nginx.configure(result, 'pos.example.com'), result)

    def test_other_domains_are_not_changed(self):
        sample = 'server {\n  server_name other.example.com;\n  location / { return 200; }\n}\n'
        with self.assertRaises(ValueError):
            nginx.configure(sample, 'pos.example.com')


class ReleaseTests(unittest.TestCase):
    def test_installer_is_pinned_and_does_not_use_old_schema_marker(self):
        installer = (ROOT / 'install.sh').read_text()
        self.assertNotIn('SUPABASE_TAG:-master', installer)
        self.assertNotIn('.schema-loaded', installer)
        self.assertIn('migrate.py', installer)
        self.assertIn('nginx -t', installer)

    def test_launcher_never_rewrites_compiled_javascript(self):
        launcher = (ROOT / 'start.mjs').read_text()
        self.assertIn('fs.cpSync(source, runtime', launcher)
        self.assertNotIn('writeFileSync', launcher)
        self.assertNotIn('replaceAll', launcher)


if __name__ == '__main__':
    unittest.main()
