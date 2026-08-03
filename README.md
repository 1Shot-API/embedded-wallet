# embedded-wallet

1Shot API's free, permissionless embedded wallet. Includes passkey-based verification and OID4 credential management for shared KYC.

This repo is the **OWS Branding Layer** for the 1Shot Wallet — a frontend-only static app (React + Vite + Tailwind + shadcn/ui) hosted at `wallet.1shotapi.com`.

```
Host Layer (integrator dapp)
  └── This app /            Branding Layer (@1shotapi/ows-wallet-utils)
        └── /signer/        Signing Layer (@1shotapi/ows-signer)

Safari create (first-party): /create/  → embeds Branding + createAccount RPC
```

## Stack

| Path | Content |
|------|---------|
| `/` | React Branding Layer (Vite bundle) |
| `/signer/` | Static `@1shotapi/ows-signer` ES modules |
| `/create/` | First-party Host page for Safari passkey create |

Production deliverable: a static **nginx** Docker image (no server-side runtime).

`/assets/` never SPA-fallbacks (missing files return **404**). That prevents CDNs from caching `index.html` under a hashed `.js`/`.css` URL, which Firefox surfaces as `NS_ERROR_CORRUPTED_CONTENT`. After a bad cache, purge Cloudflare for `wallet.1shotapi.com/assets/*` (or the whole zone) — redeploying alone will not clear poisoned entries until `max-age` expires.

## Setup

```bash
npm install
cp .env.example .env  # set NGROK_AUTHTOKEN (and optional NGROK_DOMAIN)
```

## Develop

```bash
npm run dev           # Branding Layer + ngrok HTTPS tunnel
npm run dev:local     # Branding Layer, local HTTP only
npm run dev:host      # Test Host Layer (setStyle knobs + EIP-1193)
```

| Service | Local URL |
|---------|-----------|
| Branding (`/`) | http://localhost:5174/ |
| Signing (`/signer/`) | http://localhost:5174/signer/ |
| Create (`/create/`) | http://localhost:5174/create/ |
| Test host | http://localhost:5173 |

Passkeys need HTTPS — use the printed ngrok wallet URL as the host iframe source (`NGROK_DOMAIN` in `.env` is picked up by `dev:host`).

By default Vite uses published `@1shotapi/ows-*` from `node_modules`. To point at a sibling `../prf-wallet` checkout, set `OWS_LOCAL_PACKAGES=1` (Firefox often breaks on the resulting `/@fs/C:` module URLs — prefer Chrome, or leave the flag unset for ngrok).

Style testing: use the **Style (setStyle RPC)** panel on the test host (`host/`), not in-wallet debug UI. See [host/README.md](host/README.md).

## Host integration

Production iframe URL: **`https://wallet.1shotapi.com/`**

```bash
npm install @1shotapi/ows-provider
```

```typescript
import { OWSProxy } from "@1shotapi/ows-provider";

const proxy = await OWSProxy.create(container, "https://wallet.1shotapi.com/");

await proxy.rpc("setStyle", {
  copy: { productName: "Acme Wallet", tagline: "Powered by 1Shot" },
  theme: { primary: "oklch(0.45 0.18 250)" },
});

proxy.showWallet();
```

### Analytics (`proxy.analytics`)

The Branding Layer publishes product events over Postmate (`ows:analytics`). OWS types only the base fields (`eventId`, `timestamp`, `hostDomain`, `name`); this wallet adds rich fields. Hosts receive the **full** object:

```typescript
proxy.analytics.on((event) => {
  // switch (event.name) { case "PersonalSign": ... }
  console.info("wallet analytics", event);
});
```

| `name` | When | Notable fields |
|--------|------|----------------|
| `AccountCreated` / `AccountCreateFailed` / `AccountCreateCancelled` | Passkey create | `accountAddress`, `errorCode` |
| `PersonalSign` / `…Failed` / `…Cancelled` | EIP-191 sign | `accountAddress`, `messageLength`, `durationMs` |
| `TypedSign` / `…Failed` / `…Cancelled` | EIP-712 sign | `accountAddress`, `primaryType`, `durationMs` |
| `TransactionSubmitted` / `…Failed` / `…Cancelled` | Send / host tx | `accountAddress`, `chainId`, `to`, `txHash`, `methodId`, `durationMs` |
| `CredentialIssued` / `…Failed` / `…Cancelled` | OID4VCI accept | `issuerOrigin`, `durationMs` |
| `CredentialPresented` / `…Failed` / `…Cancelled` | OID4VP present | `verifierOrigin`, `durationMs` |
| `DelegationCreated` / `…Failed` / `…Cancelled` | EIP-7715 grant | `accountAddress`, `chainId`, `durationMs` |
| `DelegationCancelled` / `…Failed` / `DelegationCancelAborted` | EIP-7715 revoke | `accountAddress`, `chainId`, `txHash`, `durationMs` |

The same rich payload is also POSTed fire-and-forget to the 1Shot relayer
`POST /wallet/product-events`. The local Host playground (`host/`) shows a live
Analytics panel fed by `proxy.analytics.on` — filter by `name` to inspect
outcomes while testing.

### `setStyle` (custom RPC)

Additive merge of theme CSS variables + copy. Safe to call repeatedly. Schema is Zod-strict (unknown keys rejected). Full field list: [skills/oneshot-embedded-wallet/SKILL.md](skills/oneshot-embedded-wallet/SKILL.md).

### Agent skill

Integrators / coding agents:

```bash
npx skills add 1Shot-API/embedded-wallet@oneshot-embedded-wallet
# or from a sibling clone:
npx skills add ../embedded-wallet --skill oneshot-embedded-wallet
```

Source: [skills/oneshot-embedded-wallet](skills/oneshot-embedded-wallet/).

## Build

```bash
npm run build         # dist/ (branding + create/) + dist/signer
npm run preview       # preview production wallet build
```

## Docker

```bash
docker build -t oneshot-wallet .
docker run --rm -p 8080:80 oneshot-wallet
# open http://localhost:8080/
# signer at http://localhost:8080/signer/
```

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` / `dev:local` | Dev server (± ngrok) |
| `dev:host` | Test Host Layer |
| `build` | Typecheck + Vite build + copy signer from `node_modules` |
| `clean` | Remove `dist/` |
| `lint` | `tsc --noEmit` |

## Refactor roadmap

See [roadmap.md](roadmap.md) (ShadCN + customization phases).

## Status

Functional Branding Layer (passkey unlock, EIP-1193, signing consent, recovery, credentials) with Phase 0–1 style foundations (`setStyle` + StyleProvider + shell). ShadCN UI migration in progress.
