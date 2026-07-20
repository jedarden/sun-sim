# sun-sim — Plan

This file did not exist before 2026-07-20. It is being created now (not
backfilled retroactively) to hold architecture decision records going
forward, per this workspace's repo convention. It is not a rewrite of
`docs/architecture.md` (the original, much more elaborate 2025-11-14 draft
architecture document, which describes a larger tooling stack — Vite,
Vitest, Playwright, Web Components — than what actually shipped: a single
1207-line `index.html` with inlined CSS/JS, served by a 60-line
`serve.py`). That gap is out of scope here; this doc starts from what the
repo actually is today and records decisions from this point forward.

## What this repo ships

A single-page, no-build, vanilla-JS interactive sun-position simulator
(`index.html`), served as a static file by a tiny Python HTTP server
(`serve.py`) inside a `python:3.11-slim` Docker image. Three third-party
libraries are loaded from public CDNs at runtime: Leaflet (map), SunCalc
(astronomical calculations), Flatpickr (date picker).

**Live deployment:** `https://sunsim.jedarden.com` — confirmed reachable
(HTTP 200, `2026-07-20`). Deployed on the `ardenone-cluster` Kubernetes
cluster (`utilities` namespace) via
`jedarden/declarative-config:k8s/ardenone-cluster/utilities/sun-sim-deployment.yml`,
pinned to `ghcr.io/jedarden/sun-sim:0.1.3`, fronted by Traefik +
Cloudflare Tunnel. CI currently runs via a GitHub Actions workflow
(`.github/workflows/docker-publish.yml`) that auto-bumps `VERSION` and
publishes to GHCR on every push touching `index.html`, `serve.py`,
`Dockerfile`, or `docs/`; migration to Argo Workflows CI is tracked
separately (see `bf-32z`, `bf-33d`, `bf-2bc`, `bf-4ke` — not duplicated
here).

## ADR-001: 2026-07-20 — Vendor third-party JS/CSS assets into the image instead of loading them from public CDNs at runtime

### Context

`index.html` currently loads its three runtime dependencies directly from
public CDNs on every page load:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-..." crossorigin=""/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
...
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-..." crossorigin=""></script>
<script src="https://cdn.jsdelivr.net/npm/suncalc@1.9.0/suncalc.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
```

Problems this creates, in order of severity:

1. **Flatpickr is unpinned** (`.../npm/flatpickr` with no version segment)
   — jsdelivr resolves this to whatever the latest published version is
   at request time. A breaking major-version release upstream would
   silently break the date picker in production with no code change on
   our side and no warning.
2. **Flatpickr has no Subresource Integrity hash** (unlike the Leaflet
   `<link>`/`<script>` tags, which do). A compromised or MITM'd CDN
   response for Flatpickr would execute arbitrary JS in the page with no
   detection.
3. **Availability is coupled to two third-party CDNs.** If `unpkg.com` or
   `cdn.jsdelivr.net` has an outage, the app is unusable even though
   `sunsim.jedarden.com` itself is up and healthy — the health checks in
   `sun-sim-deployment.yml` only check `GET /` on the origin, so this
   failure mode is invisible to k8s liveness/readiness probes.
4. **`serve.py` sends `Cache-Control: no-cache, no-store, must-revalidate`
   on every response**, and there are no local static assets to cache
   anyway — so there is currently no browser caching story at all for
   this app's own bytes, only whatever jsdelivr/unpkg choose to do at
   the edge for the CDN files.

The README's own performance table claims "Load Time < 2.1s" and the
draft `architecture.md` lists "Offline Capability" as a key requirement.
Neither is actually achievable while critical rendering-path JS is
fetched from two different third-party origins with no local fallback
and no caching of our own bytes.

### Decision

Vendor Leaflet, SunCalc, and Flatpickr (JS + CSS) into the repo under a
new `vendor/` directory at their currently-pinned versions
(leaflet@1.9.4, suncalc@1.9.0, flatpickr — pin to the latest stable at
migration time), fetched once at image build time (or committed
directly, given their small combined size — under 300KB uncompressed)
and served same-origin from the Docker image alongside `index.html`.
Update `index.html` to reference `/vendor/...` paths instead of CDN
URLs. Update `serve.py` to send a long-lived, immutable `Cache-Control`
header (e.g. `public, max-age=31536000, immutable`) for everything under
`/vendor/`, while keeping `index.html` itself on `no-cache` so app
updates are picked up immediately.

This removes the SRI/version-pinning problem entirely for the vendored
files (same-origin script execution needs no integrity check — it's
already covered by the deployment's own TLS + image provenance), and
makes the site's own uptime the only uptime that matters for it to
render.

### Alternatives Considered

- **Keep CDN loading, just pin Flatpickr's version and add an SRI hash
  to it.** Lower effort, fixes problems (1) and (2) above, but leaves
  (3) and (4) — the app remains dependent on two external CDNs staying
  up, and there is still no working browser cache for the bulk of the
  page's byte weight.
- **Add a Service Worker that caches the CDN responses client-side
  (stale-while-revalidate).** Solves caching and repeat-visit
  offline-ness, but does nothing for a first-time visitor during a CDN
  outage, and adds a second caching layer (SW cache + whatever the CDN
  sends) that has to be reasoned about together with the `serve.py`
  headers. More moving parts for a smaller slice of the problem.
- **Migrate to a real bundler (Vite), matching the original
  `architecture.md` draft.** Would solve all four problems and more
  (minification, tree-shaking, dev server), but reintroduces the build
  tooling this project deliberately avoided — `architecture.md` itself
  gives the rationale for vanilla JS as "avoiding framework overhead."
  A full bundler migration is a much bigger lift for a single
  hand-maintained HTML file and is not proportionate to the problem
  being solved here.
- **Do nothing.** Leaves an unpinned, non-integrity-checked third-party
  script in the critical path of a public-facing site indefinitely.

### Consequences

**Positive:**
- The app renders correctly even during an `unpkg.com` or
  `cdn.jsdelivr.net` outage — its availability is now bounded only by
  its own deployment's health.
- Flatpickr is frozen at a known-good, explicitly-chosen version;
  upstream breaking changes can no longer land silently.
- Browser caching actually works for the majority of the page's byte
  weight on repeat visits (vendored libs rarely change between
  releases), improving on the current "cache nothing, ever" behavior.
- SRI/version-drift maintenance burden for the three libraries goes away
  (same-origin files don't need integrity hashes).

**Negative / costs:**
- Loses the CDN's global edge caching for first-time, geographically
  distant visitors — acceptable given the app is already served from a
  single origin behind Cloudflare, which provides its own edge caching
  for the (now cacheable) vendor assets.
- Upgrading a vendored library becomes a manual step (re-fetch, re-pin,
  commit) instead of "the CDN URL now points at something newer."
  Mitigated by keeping this list small (3 libraries) and tracking
  refreshes as a normal bead when a CVE or feature need arises, rather
  than getting silent auto-updates neither reviewed nor tested.
- Docker image grows by roughly the combined vendored size (~250-300KB
  uncompressed) — negligible against the current `python:3.11-slim`
  base image size.

**Follow-up work:** tracked as a bead referencing this ADR (see
`.beads/` in this repo, label `artifact-improvement`) rather than
implemented as part of writing this decision record.
