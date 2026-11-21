# Environment setup

Actual environment files and managed workspace backend settings are intentionally excluded.

For Dell builds, run the sanitized build procedure in HANDOVER-v2.6.0.md. Keep the real existing /opt/karatdesk/.env privately on the Dell; do not replace it with hosted settings.

For a new Lovable workspace, reconnect Lovable Cloud using the platform setup so its generated configuration belongs to that workspace. Do not copy production or previous-workspace secrets into a new project.

The original self-hosted backend .env.example is only an upstream template. Never use its defaults as credentials or run fresh-install/reset utilities on the existing Dell.
