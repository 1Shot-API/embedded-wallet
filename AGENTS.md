# Agent instructions — 1Shot Embedded Wallet

Branding Layer for the 1Shot Wallet (`wallet.1shotapi.com`). Host → Branding → Signing; never embed `/signer/` from the Host.

## Compatibility policy (until further notice)

Prefer **clean code over backwards compatibility**. Do not add legacy redirects, `@deprecated` aliases, dual APIs, compatibility shims, or parallel code paths “just in case.” When a pattern is renamed or superseded, update all call sites in this repo (and docs/skills) to the new shape — breaking changes are expected and welcome during active development.

## Layout

| Path | Content |
|------|---------|
| `/` | Branding Layer (React SPA) |
| `/signer/` | Signing Layer (`@1shotapi/ows-signer`) |

Test Host Layer: `host/` (`npm run dev:host`). Style via Host RPC `setStyle`, not in-wallet debug knobs.
