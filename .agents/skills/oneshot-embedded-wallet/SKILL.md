---
name: oneshot-embedded-wallet
description: >-
  Integrate the 1Shot embedded wallet (OWS Host Layer) with @1shotapi/ows-provider.
  Use when embedding wallet.1shotapi.com, wiring OWSProxy, EIP-1193, credentials,
  or custom RPC such as setStyle for theming the 1Shot Branding Layer.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.1.0"
  repository: https://github.com/1Shot-API/embedded-wallet
---

# 1Shot Embedded Wallet (Host integration)

Teach an agent how to embed the **1Shot Wallet** Branding Layer from a Host Layer app using `@1shotapi/ows-provider`.

```
Host (your dapp)          @1shotapi/ows-provider → OWSProxy
  └── Branding iframe     https://wallet.1shotapi.com/wallet/
        └── Signing       https://wallet.1shotapi.com/signer/  (same origin)
```

## Install

```bash
npm install @1shotapi/ows-provider @1shotapi/ows-types
```

## Minimal setup

```typescript
import { OWSProxy } from "@1shotapi/ows-provider";

const WALLET_URL = "https://wallet.1shotapi.com/wallet/";

const container = document.getElementById("wallet-container")!;
const proxy = await OWSProxy.create(container, WALLET_URL);

// Optional: theme / copy before showing the flyout
await proxy.rpc("setStyle", {
  copy: { productName: "Acme Wallet", tagline: "Powered by 1Shot" },
  theme: { primary: "oklch(0.45 0.18 250)" },
});

proxy.showWallet();

// EIP-1193
const accounts = await proxy.ethereum.request({ method: "eth_requestAccounts" });
```

### Local / HTTPS notes

- Passkeys require a **secure-context ancestor chain**. The Host page must be HTTPS (or `localhost`) when the wallet iframe is HTTPS.
- Dev wallet URL: your ngrok or local Vite origin + `/wallet/` (e.g. `https://….ngrok-free.app/wallet/`).
- Production wallet URL: **`https://wallet.1shotapi.com/wallet/`** (Signing Layer at `/signer/` on the same origin — do not embed `/signer/` from the host).

## Custom RPC — `setStyle`

1Shot-specific method registered on the Branding Layer. Call via:

```typescript
await proxy.rpc("setStyle", options);
```

`options` is a partial merge (safe to call repeatedly):

| Field | Type | Purpose |
|-------|------|---------|
| `theme.primary` | string (CSS color) | `--primary` |
| `theme.primaryForeground` | string | `--primary-foreground` |
| `theme.background` / `foreground` | string | page colors |
| `theme.muted` / `mutedForeground` | string | secondary text |
| `theme.border` / `accent` / `accentForeground` | string | chrome |
| `theme.radius` | string | `--radius` (e.g. `"0.625rem"`) |
| `theme.fontSans` | string | `--font-sans` |
| `copy.productName` | string | titles / chrome |
| `copy.tagline` | string | supporting line |
| `dark` | boolean | toggles `html.dark` |

Returns `{ ok: true, productName: string }` with the resolved product name after merge.

Unknown keys are rejected (Zod `.strict()`).

See also [README.md](../../README.md) in this repository.

## Other Host APIs

| API | Use |
|-----|-----|
| `proxy.ethereum.request(...)` | EIP-1193 (accounts, sign, chain, …) |
| `proxy.credentials.*` | OID4 offer / present (when enabled in wallet) |
| `proxy.showWallet()` / `hideWallet()` | Host-driven flyout without an EIP-1193 call |
| `proxy.rpc(method, params)` | Custom Branding RPC (`setStyle`, …) |

## Hard rules

- Never embed the Signing Layer iframe from the Host — always Host → Branding → Signing.
- Prefer the published wallet URL in production; point at a local Branding origin only while developing this repo.
- Theme with `setStyle`; do not ask integrators to fork CSS for basic brand colors / product name.
