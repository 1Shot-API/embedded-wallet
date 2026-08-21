# 1Shot Wallet — ShadCN + customization roadmap

Phased refactor of the Branding Layer UI onto ShadCN, with host-driven theming via `configure`, and cleaner state boundaries. Work proceeds **one phase (or one modal) per query**.

## Goals

1. **Integrator customization** — Host calls `proxy.rpc("configure", options)` before / during display; wallet applies CSS tokens + copy overrides. Re-callable for the future customization tester site.
2. **ShadCN UI** — Replace bespoke Tailwind shells/modals with tokenized shadcn/ui components.
3. **State that scales** — Theme in Context; wallet session / modal queue in Zustand; server data (later) via TanStack Query.

## Architecture (locked)

```
Host OWSProxy
  └── rpc("configure", IStyleOptions)     # branding-app registerRpc
        └── StyleProvider (React Context)
              ├── CSS variables on document / root
              └── copy / labels object

Wallet session + modal queue  →  Zustand stores
Durable keys / addresses      →  localStorage (existing storage.ts)
Relayer / credential fetch    →  TanStack Query (later phase)
```

### UI ground rules

- No hardcoded brand colors — use semantic tokens (`bg-primary`, `text-muted-foreground`, etc.).
- User-visible copy comes from StyleContext defaults / overrides, not scattered string literals.
- `configure` merges into current style state (additive, re-applicable).
- Defaults = 1Shot branding when host never calls `configure`.
- Style state stays separate from unlock / chain / modal runtime state.

---

## Inventory — current UI surfaces

### Shell (non-modal)

| Surface | File | Notes |
|---------|------|--------|
| App shell | `src/App.tsx` | Loading / onboarding / main switch |
| Embedded chrome | `src/components/WalletChrome.tsx` | Title + hide |
| Onboarding | `src/components/OnboardingPanel.tsx` | Login vs create |
| Main panel | `src/components/MainPanel.tsx` | Status, addresses, chain, actions |
| Modal shell | `src/components/Modal.tsx` | Custom dialog — replace with shadcn Dialog |
| Modal router | `src/components/ModalHost.tsx` | Switches on `activeModal.kind` |
| Signer host | `src/components/SignerHost.tsx` | Keep minimal; no visual design |

### Modals (`activeModal.kind`)

| Kind | Component file | Purpose |
|------|----------------|---------|
| `walletSetup` | `SetupModals.tsx` → `WalletSetupModal` | Login / create / cancel |
| `passkeyName` | `SetupModals.tsx` → `PasskeyNameModal` | Name for new passkey |
| `connect` | `SetupModals.tsx` → `ConnectModal` | Account connect consent |
| `personalSign` | `SignModals.tsx` → `PersonalSignModal` | EIP-191 consent |
| `typedData` | `SignModals.tsx` → `TypedDataModal` | EIP-712 consent |
| `credentialOffer` | `CredentialModals.tsx` → `CredentialOfferModal` | OID4VCI accept |
| `credentialPresentation` | `CredentialModals.tsx` → `CredentialPresentationModal` | OID4VP disclose |
| `credentialList` | _(removed)_ | Replaced by Credentials tab |
| `credentials` | `CredentialsTab.tsx` + `CredentialDetailDialog.tsx` | Stored credentials table + detail |
| `createBackup` | `BackupModals.tsx` → `CreateBackupModal` | Recovery create + overlay |
| `restoreBackup` | `BackupModals.tsx` → `RestoreBackupModal` | Recovery restore + overlay |

---

## Phases

### Phase 0 — Foundations (style + RPC, no visual redesign)

**Outcome:** Host can call `configure`; CSS vars + copy map exist; shadcn theme CSS restored alongside wallet layout.

- [x] Define `IStyleOptions` (theme tokens + copy/labels + feature flags as needed).
- [x] Defaults module (`DEFAULT_STYLE` / 1Shot branding).
- [x] `applyStyleToDocument(options)` → set CSS variables on `document.documentElement` (or `#root`).
- [x] `StyleProvider` + `useStyle()` context.
- [x] Register `wallet.registerRpc("configure", …)` **before** `wallet.start()` (merge + apply).
- [x] Restore / merge shadcn theme into `src/index.css` (css variables + Tailwind) without breaking `/signer/` host styles.
- [x] Smoke: call `configure` from a temporary button or host console; primary/background tokens update.
- [x] Bootstrap Host integrator skill (`skills/oneshot-embedded-wallet`) documenting `configure` + wallet URL.

**Exit criteria:** Defaults render; RPC path works; no modal UI rewritten yet.

---

### Phase 1 — Shell on ShadCN + tokens

**Outcome:** App chrome uses Button / layout primitives; reads brand name / labels from StyleContext. Host test app exercises `configure` over Host ↔ Branding RPC (not an in-wallet debug button).

- [x] Wire `StyleProvider` around app in `main.tsx`.
- [x] Refactor `WalletChrome` → tokens + styled title from copy map.
- [x] Refactor `OnboardingPanel` → shadcn Button / typography.
- [x] Refactor `MainPanel` → shadcn Button, Select (chain).
- [x] Replace shell ad-hoc `<button>` styles with `@/components/ui/button`.
- [x] Ensure shell respects `configure` colors and product name.
- [x] Add `host/` test Host Layer (from OWS `examples/host`) with configure knobs; `npm run dev:host`.

**Exit criteria:** Standalone + embedded shell looks like a coherent 1Shot product; theme knobs on the host exercise host↔branding communication.

---

### Phase 2 — Modal system (Dialog primitive)

**Outcome:** One shadcn Dialog-based `Modal` / `AppDialog` used by all kinds; ModalHost unchanged in routing.

- [x] `npx shadcn add dialog` (and Input / Label / Textarea as needed).
- [x] Replace `src/components/Modal.tsx` with shadcn Dialog wrapper (actions, title, description slots).
- [x] Keep `ModalHost` switch; each modal migrates in later phases.
- [x] Accessibility: focus trap, Escape → reject/cancel where appropriate.

**Exit criteria:** At least one modal (prefer `connect`) uses the new Dialog shell end-to-end.

---

### Phase 3 — Setup & connect modals

Migrate one kind at a time:

1. [x] `connect` — `copy.connect.*` via StyleContext; Dialog + Button tokens
2. [x] `walletSetup` — `copy.walletSetup.*` via StyleContext; Dialog + Button tokens
3. [x] `passkeyName` — `copy.passkeyName.*` via StyleContext; Dialog + Button tokens

Copy via StyleContext (titles, button labels). Tokens only for colors.

---

### Phase 4 — Signing modals

1. [x] `personalSign` — `copy.personalSign.*` via StyleContext; token-styled detail blocks
2. [x] `typedData` — `copy.typedData.*` via StyleContext; token-styled detail blocks

Preserve request detail display; avoid overstuffing the first viewport of the flyout.

---

### Phase 5 — Credential modals

1. [x] `credentialOffer` — `copy.credentialOffer.*` via StyleContext (`{issuerName}` / `{issuerId}` templates)
2. [x] `credentialPresentation` — `copy.credentialPresentation.*` via StyleContext
3. [x] `credentials` — `copy.credentials.*` via StyleContext (tab + detail dialog)

Keep OID4 wiring in `registerCredentialsProvider` / WalletProvider; UI-only change.

---

### Phase 6 — Backup / recovery modals

1. [x] `createBackup` — `copy.createBackup.*` via StyleContext; `overlaySignerIframe` + `waitForSignerSlot` unchanged
2. [x] `restoreBackup` — `copy.restoreBackup.*` via StyleContext; Signing Layer labels from copy

**Do not** reparent the signer iframe — keep `overlaySignerIframe`. Passphrase UI can sit in Dialog; signer overlay behavior stays as today.

---

### Phase 7 — Zustand session + modal queue

**Outcome:** `WalletProvider` sheds UI state into stores; OWS handlers call stores from outside React.

- [x] Add `zustand`.
- [x] `useWalletSessionStore` — ready, unlocked, addresses, chain, credentialCount, bootError, walletCreated.
- [x] `useModalStore` — queue, push/pop, `activeModal`.
- [x] Thin `WalletProvider` (boot, refs, `ensureReady`, register handlers) that syncs into stores.
- [x] Update consumers (`useWallet` → store selectors where appropriate).

**Exit criteria:** Opening a modal does not force unrelated shell re-renders; handlers remain correct.

---

### Phase 8 — Polish + customization tester prep

**Outcome:** Host tester is a professional playground for `configure`; wallet docs catch up.

- [ ] Document `IStyleOptions` and example host `configure` call in README.
- [x] Expand knobs as needed (logo URL, colors, radius, font; showBackup later).
- [x] Host tester: React + ShadCN shell; style knobs encapsulated in `WalletConfigurator` (organization TBD).
- [x] Host layout v1: 1Shot-branded header + Sidebar (Test / Design); Design embeds wallet inline with configurator.
- [x] Wallet presentation: MetaMask-like 360×600; create-time `presentationMode`; Test/Design destroy+recreate proxy (no reparent).
- [x] Reorganize `WalletConfigurator` (Basic / Style / Text tabs; color picker + accordion).
- [ ] Dark mode strategy if we support host toggle via `configure`.

**Exit criteria:** Host looks intentional; `configure` knobs are maintainable as we grow the wallet UI.
---

### Later (out of this refactor)

- TanStack Query for relayer credential blob / balances.
- Full host-side customization tester site (separate app using `ows-provider`).
- Production 1Shot visual identity beyond shadcn nova defaults (brand fonts/imagery rules).

---

## Suggested shadcn components (add as phases need them)

| Component | Used by |
|-----------|---------|
| `button` | Shell, all modals (already present) |
| `dialog` | Modal system |
| `input` / `label` | passkey name, backup passphrase |
| `textarea` | typed data / backup paste |
| `select` | chain switch |
| `separator` | Main panel sections |
| `badge` / `scroll-area` | credential list (optional) |

---

## Working agreement

- One phase or one modal per chat query unless explicitly batched.
- Prefer grepping `examples/general-wallet` + this roadmap over reinventing flows.
- Keep OWS boot order: register handlers (including `configure`) → `wallet.start()` → deferred signer.
- No deprecation shims — update call sites when renaming.

## Progress

| Phase | Status |
|-------|--------|
| 0 Foundations | done |
| 1 Shell | pending |
| 2 Modal system | pending |
| 3 Setup modals | pending |
| 4 Sign modals | pending |
| 5 Credential modals | pending |
| 6 Backup modals | pending |
| 7 Zustand | pending |
| 8 Polish | pending |
