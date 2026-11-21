# KaratDesk preview restoration

- [x] Restore original application screens, routes, assets, and business rules.
- [x] Recreate the database and existing access rules in separate Lovable Cloud.
- [x] Run source tests and verify public preview screens on desktop and mobile.
- [x] Correct email-free staff creation in the shared source used by self-hosted builds; regression tests pass.
- [x] Reproduce and correct stale runtime configuration and legacy real-email password gateway failures; regression tests pass.
- [ ] Verify authenticated stock and local staff login end-to-end — temporary test account was declined; awaiting a preview sign-in.
- [ ] Deploy and verify both corrections on Dell — release 2.6.0 agreed; awaiting previous upgrade ZIP and owner-run production verification.
- [ ] Import existing records and identities — awaiting application/user exports.
- [ ] Import existing photos — awaiting private uploaded bytes and metadata.
- [ ] Verify email delivery and scheduled email backups — awaiting fresh Resend connection and authorized sender.
- [ ] Verify imported-user email/password setup and ownership — awaiting user exports.

## Deployment and full handover request

- [x] Restore the supplied self-hosted build kit to the source project.
- [x] Use the owner-approved release number 2.6.0.
- [x] Build and validate isolated compiled Node output with both corrections and all 78 migrations; 255 app tests, 11 hosting/assembly tests and local runtime/asset checks pass.
- [ ] Assemble the Dell 2.6.0 upgrade ZIP from the prior upgrade baseline — awaiting owner upload.
- [x] Prepare a clean full source ZIP and comprehensive versioned handover guide, verification report and checksums for Files.
- [x] Inspect all staged source entries, run regression/hosting checks, and record exact verification limits; final ZIP integrity and file hashes are checked before Files delivery.

Production installation and Lovable publication are not requested by this packaging task.