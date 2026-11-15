WETUDY - privacy P0 release protocol, 14 Nov 2026

This is NOT authorization to deploy. All SQL grants in PR #438 remain unapplied.

1. Ensure PR #438 and parent alert PR #434 pass all four workflows and a single reviewed application preview. Preserve original cards, postal-code radius, photographs and infinite scroll.
2. Complete and verify full isolated recovery of DB, Auth and Storage. The passing synthetic PostgreSQL17-only restore does not count as full disaster recovery.
3. Run scripts/pilot-privacy-prod-preflight-readonly.sql on the authorized production project and record metadata only. Expected baseline: 36 columns and privacy NO-GO until migration.
4. Obtain explicit founder approval for any DDL, production rollout or onboarding of real AMPA families.
5. Apply reviewed anon and authenticated SELECT restrictions in ONE controlled DB transaction and only after the new server-side marketplace readers are deployed; do not modify DML or other RLS rules incidentally.
6. Run immediate E2E canaries with synthetic real QA accounts: anon direct REST denied; auth 33-columns only and postal_code/lat/lng denied; service-side catalog; seller create/edit/status, purchaser conversations, school isolation, favorites, photo gallery, 60-row infinite scroll and radio.
7. If a blocking regression occurs, stop family onboarding and review restore or rollback. Restoring broad anon SELECT would RE-EXPOSE postal codes, so it must not be used casually.
8. Require evidence of AMPA acceptance, legal/privacy readiness and recovery before full GO.

Refs: GitHub PR #438, parent #434, privacy issue #433 and Realtime issue #445.
