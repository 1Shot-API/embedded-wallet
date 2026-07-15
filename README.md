# embedded-wallet

1Shot API's free, permissionless embedded wallet. Includes passkey-based verification and OID4 credential management for shared KYC.

This repo is the **OWS Branding Layer** for the 1Shot Wallet — a frontend-only static app (React + Vite + Tailwind + shadcn/ui) hosted at `wallet.1shotapi.com`.

```
Host Layer (integrator dapp)
  └── This app /wallet/     Branding Layer (@1shotapi/ows-wallet-utils)
        └── /signer/        Signing Layer (@1shotapi/ows-signer)
```

## Stack

| Path | Content |
|------|---------|
| `/wallet/` | React Branding Layer (Vite bundle) |
| `/signer/` | Static `@1shotapi/ows-signer` ES modules |

Production deliverable: a static **nginx** Docker image (no server-side runtime).

## Setup

```bash
npm install
cp .env.example .env  # set NGROK_AUTHTOKEN (and optional NGROK_DOMAIN)
```

## Develop

```bash
npm run dev           # Vite + ngrok HTTPS tunnel
npm run dev:local     # local HTTP only (no tunnel)
```

| Service | Local URL |
|---------|-----------|
| Branding (`/wallet/`) | http://localhost:5174/wallet/ |
| Signing (`/signer/`) | http://localhost:5174/signer/ |

Passkeys need HTTPS — use the printed ngrok `/wallet/` URL as the host iframe source.

In Vite **dev**, the main panel includes a **Debug: setStyle** button that patches theme/copy via the same path as host RPC.

## Host integration

Production iframe URL: **`https://wallet.1shotapi.com/wallet/`**

```bash
npm install @1shotapi/ows-provider
```

```typescript
import { OWSProxy } from "@1shotapi/ows-provider";

const proxy = await OWSProxy.create(container, "https://wallet.1shotapi.com/wallet/");

await proxy.rpc("setStyle", {
  copy: { productName: "Acme Wallet", tagline: "Powered by 1Shot" },
  theme: { primary: "oklch(0.45 0.18 250)" },
});

proxy.showWallet();
```

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
npm run build         # dist/wallet + dist/signer
npm run preview       # preview production wallet build
```

## Docker

```bash
docker build -t oneshot-wallet .
docker run --rm -p 8080:80 oneshot-wallet
# open http://localhost:8080/wallet/
# signer at http://localhost:8080/signer/
```

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` / `dev:local` | Dev server (± ngrok) |
| `build` | Typecheck + Vite build + copy signer from `node_modules` |
| `clean` | Remove `dist/` |
| `lint` | `tsc --noEmit` |

## Refactor roadmap

See [roadmap.md](roadmap.md) (ShadCN + customization phases).

## Status

Functional Branding Layer (passkey unlock, EIP-1193, signing consent, recovery, credentials) with Phase 0 style foundations (`setStyle` + StyleProvider). ShadCN UI migration in progress.
