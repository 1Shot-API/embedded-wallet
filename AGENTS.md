# Agent instructions — 1Shot Embedded Wallet

Branding Layer for the 1Shot Wallet (`wallet.1shotapi.com`). Host → Branding → Signing; never embed `/signer/` from the Host.

## Compatibility policy (until further notice)

Prefer **clean code over backwards compatibility**. Do not add legacy redirects, `@deprecated` aliases, dual APIs, compatibility shims, or parallel code paths “just in case.” When a pattern is renamed or superseded, update all call sites in this repo (and docs/skills) to the new shape — breaking changes are expected and welcome during active development.

## Layout

| Path | Content |
|------|---------|
| `/` | Branding Layer (React SPA) |
| `/signer/` | Signing Layer (`@1shotapi/ows-signer`) |
| `src/lib/types/primitives/` | Wallet-local branded types (one file each) |
| `src/lib/types/enum/` | Domain enums (`EAssetType`, `EWalletEventKind`, …) |
| `src/lib/types/business/` | Domain DTOs (e.g. `KnownAsset`, `TrackedAsset`) |
| `src/lib/types/events/` | Domain event classes (one file each) |
| `src/lib/interfaces/{business,data,utils}/` | Layer interfaces |
| `src/lib/implementations/{business,data,utils}/` | Layer implementations |
| `src/assets/` | Static media only (SVGs, images) |

Test Host Layer: `host/` (`npm run dev:host`). Style via Host RPC `setStyle`, not in-wallet debug knobs.

### Form validation UX

Primary submit actions (e.g. Send in `TransferTokensModal`) stay **disabled until every required field is valid**. Do not leave the button enabled and only reject on click. Empty fields show no error text; invalid non-empty input shows inline errors; the CTA enables only when the whole form is ready.

### User-facing copy (`setStyle`)

When adding or changing UI strings:

1. Wire them through `style.copy` (defaults, types, and `registerSetStyle` Zod schema) so hosts can override via `setStyle`.
2. Expose the same keys in **both** WalletConfigurator playgrounds: `host/` in this repo and `app/playground/` in **1Shot-API-Website-New** (`styleForm.ts` + `WalletConfigurator.tsx`).

### Domain layers (assets example)

- **Utils:** `IBlockchainProvider` / `AddressUtils` (from `@1shotapi/ows-wallet-utils`) / `DemoChainsBlockchainProvider`, `IEventBus` / `EventBus`, `ITransactionUtils` / `TransactionUtils`
- **Data:** `IKnownAssetRepository`, `ITrackedAssetRepository`, `IOneshotRelayerRepository` (`src/lib`) and their implementations
- **Business:** services that orchestrate domain logic (add as needed)

`IOneshotRelayerRepository.sendTransaction` owns prepare + passkey sign + broadcast (interim: `eth_sendRawTransaction`). Host EIP-1193 sends go SignHelper → branding `approveAndSignTransaction` (ConfirmTransfer / SendTransaction consent) → relayer. In-wallet Send uses `TransferTokensModal` → `WalletProvider.sendTransaction` → relayer, then `SentTransactionModal` (hash + explorer link). Host-driven sends do not show that confirmation — the host surfaces the hash itself.

## Branded types

Prefer branded primitives from `@1shotapi/ows-types` when a shared type already exists. For **wallet-local** branded types (e.g. `TrackedAssetId`), put each brand in its **own file** under `src/lib/types/primitives/` (type alias + `make()` constructor, same pattern as `ows-types` primitives) — do not declare brands inline in DTO modules.

**Trust brands after construction.** Validate shape (`string` / `number` / `boolean`, regex, etc.) **before** wrapping with a branded constructor (`EVMAccountAddress(...)`, `makeTrackedAssetId(...)`, …). Once a value is branded, compare and pass it as that type — do **not** coerce with `String(...)`, `Number(...)`, or similar for identity checks (`===`) or Map/Set keys. Coercion hides type changes (e.g. id becoming a `number`) and creates runtime bugs that are hard to track down. Brand subtypes of `string`/`number` remain assignable to the underlying primitive where an API truly needs it (display, JSON fields typed as `string`).
