# Patchwork

## Patchwork “naming system” for components

A coherent set you can use across repos, services, workers, and docs:

* **Patchwork Web** — the client (`patchwork-web`)
* **Patchwork API** — query + auth (`patchwork-api`)
* **Spool** — ingestion + queueing (“spool” = feed intake) (`patchwork-spool`)
* **Quilt** — indexing + search layer (“quilting” = assembling meaning) (`patchwork-quilt`)
* **Stitch** — chat service (`patchwork-stitch`)
* **Thimble** — moderation worker (small tool, sharp purpose) (`patchwork-thimble`)

Alt mod-worker names (more “safety” coded): **Ward**, **Lamplighter**, **Sifter**, **Shears**.

## Taglines that match the vibe (not nonprofit-corny)

* **“Mutual aid, woven.”**
* **“Requests in. Care out.”**
* **“A commons for need, offer, and coordination.”**
* **“Community infrastructure for getting through it.”**

## Namespace / API flavor (if you want it to feel “protocol-native”)

* Domain-ish IDs: `patchwork/*`, `pw/*`, or `app.patchwork/*`
* Endpoints that match the metaphor:

  * `GET /threads` (requests/offers)
  * `GET /patches` (individual items)
  * `GET /bundles` (resource groupings)
  * `GET /signals` (alerts/urgent items)
  * `GET /ledger` (optional transparency log for mod actions)

## Branding bits that will look good fast

* Icon idea: a **single irregular patch** with 2–3 visible stitches (simple, scalable)
* Motif: **visible seams** = transparency, accountability, and “no magic black box moderation”

If you keep building in the Patchwork metaphor, the whole platform becomes legible: *patches* (needs/offers), *threads* (conversations), *stitches* (links/verification), *quilt* (index/overview), *thimble* (moderation tool).
