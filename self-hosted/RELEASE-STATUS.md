# Self-hosted release status — 2.6.0

The shared application source now contains the email-free local-staff creation correction and the restore-password runtime/legacy-account corrections. `src/lib/version.ts` is the owner-approved version source.

The Node builder is a compilation tool, **not a release installer**. Its output still uses the original all-in-one installer. Do not run that installer on the existing Dell.

The final in-place upgrade must be assembled from the previously shipped Dell upgrade ZIP. That archive has not been attached to this workspace. Its Nginx 60 MB / 300-second restore settings, tunnel routing and installer changes must be retained and compared, not reconstructed from the older source kit.

`upgrade/` is the original source-kit baseline with stale 2.5.2 labels; it is retained for reference, not represented as a ready 2.6.0 release. Final labels and installer safeguards are updated after the previous deployment ZIP is available.

Production migrations are the 78 byte-identical original files 0000–0077. Migration 0078 only comments the Lovable preview schema; it remains in the complete source history but is deliberately omitted from Node deployment output.

Read the project-root `HANDOVER-v2.6.0.md` for the exact build procedure, production-preservation rules, pending packaging step and verification limits.