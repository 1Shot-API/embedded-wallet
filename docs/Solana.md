# Solana support — plan for a plan

Incremental roadmap to full Solana support across OWS (`prf-wallet`) and this Branding Layer. **Not an implementation plan.** Each numbered phase should get its own scoped design/build cycle before the next.

## Goals

- Treat Solana like Bitcoin for execution: **raw transactions to an RPC we own** (Alchemy). No relayer, no EIP-7710, no gas abstraction.
- Ship Host discovery via **Wallet Standard** (not a custom Wallet Adapter package).
- Keep in-wallet UX close to EVM (balances → asset details → send/receive/bridge), with Solana-specific account semantics called out explicitly.
- Amplify CoinOperated by making Solana a real destination early (native SOL first, then USDC mint, then CCTP).

## Non-goals (for this roadmap)

- Solana delegations / session keys / program-derived authority products.
- Relayer sponsorship of Solana txs or ATA rent.
- Credentials — already chain-agnostic; no Solana-specific work expected.
- Publishing a first-party `@solana/wallet-adapter-*` package (Wallet Standard replaces that).
- Token-2022 edge cases beyond “detect program id so ATA derivation is correct.”
- Closing empty ATAs / rent reclaim UX (nice follow-on after mint support).
- Phantom-era `window.solana` injection (optional later; not required for Adapter/Kit).

## Context we already learned

### Stack shape

| Layer | Role for Solana |
|-------|-----------------|
| Signing (`ows-signer`) | Ed25519 from existing PRF path; already derives Solana addresses |
| Branding ↔ Signing (`ows-signer-utils`) | `signer.solana.*` — today only `getAccountAddress()` |
| Branding ↔ Host (`ows-wallet-utils` / Branding RPC) | Consent UI + Host method handlers |
| Host (`ows-provider`) | `proxy.solana` Wallet Standard object + explicit `registerSolanaWallet()` |
| Branding app (this repo) | Chain UI, tracked mints, Alchemy submit, CCTP |

### Discovery model (critical asymmetry vs EIP-1193)

- EVM: host gets `proxy.ethereum` and passes it to viem/wagmi. No page-global injection required.
- Solana: dapps discover wallets via **Wallet Standard** (`registerWallet` on the **Host window**). Wallet Adapter / Kit wrap Standard wallets automatically via `StandardWalletAdapter`.
- We implement a **Standard Wallet**, not a Wallet Adapter. Registration must happen on the Host page that constructed `OWSProxy`, never inside the Branding iframe.

### Account / asset model (critical asymmetry vs ERC-20)

- Wallet pubkey holds **native SOL** only.
- SPL balances live in **Associated Token Accounts (ATAs)** derived from `(wallet, mint, token program)`.
- Recipient ATA **must exist** before a transfer can credit it. Usual pattern: sender includes `CreateIdempotent` in the same tx (~0.002 SOL rent, reclaimable later by the **recipient**).
- Receive UI shows the **wallet address**, never the ATA. Bridge/`mintRecipient` for CCTP must use the USDC ATA bytes internally.
- `EAssetType` today is EVM-centric (`Native` / `Erc20` / …). Mint support will need a Solana-appropriate type (or a carefully generalized “fungible” concept) — decide in the phase-7 design cycle, don’t pretend ERC-20.

### Signing primitives

| Need | Solana surface | EVM analogue |
|------|----------------|--------------|
| Arbitrary bytes | `solana:signMessage` | `personal_sign` |
| Auth | `solana:signIn` (SIWS) | SIWE |
| Typed data | **None** | EIP-712 |
| Execute | Sign versioned tx (+ optional submit) | `eth_sendTransaction` / raw tx |

Tx simulation / instruction decoding is the hard consent UX (not a 712 field tree).

### Bridging

- Circle **CCTP** supports Solana (domain **5**), including Forwarding Service.
- Li.FI lists Solana as an SVM chain — useful later; CCTP is the intentional first bridge path.
- EVM → Solana via Forwarding can avoid dest-side SOL if setup fees cover ATA creation (`includeRecipientSetup`).
- Solana → EVM requires a Solana burn tx (our Alchemy path).

### Already present (do not re-invent)

- `SolanaAccountAddress`, CAIP `SolanaChainId`, program/mint/signature brands, and `solana.*` Host/Branding wire (Phase 1 done).
- Session store already holds `solanaAddress`; unlock hydrates it via `signer.solana.getAccountAddress()`.
- Mobile WalletConnect tests already mention a `solana` namespace — align later, don’t fork semantics.

### Integrator docs

When Host RPC / Standard registration / Branding conventions land, update **`1shot-wallet`** and **`ows-branding-layer`** skills in `1Shot-API/skills` in the same effort as the matching code.

---

## Phased roadmap

Rough order is dependency order. Prefer finishing a phase’s Host + Branding vertical slice before opening the next, except where noted.

### Phase 0 — Decisions (locked)

| Decision | Choice | Notes |
|----------|--------|-------|
| **Product clusters** | **Mainnet + Devnet only** | Drop Testnet from the product surface. Keep `solana:testnet` out of Embedded Wallet / Host registration unless a later need appears. |
| **Chain id brand** | **CAIP-2 / Wallet Standard sentinels** | Branded `SolanaChainId` becomes `"solana:mainnet"` \| `"solana:devnet"` (and `"solana:testnet"` only if we retain the type for completeness). Replace today’s `"Solana"` / `"SolanaDevnet"` / `"SolanaTestnet"`. Map in `ChainUtils` the way Bitcoin maps to `bip122:…`. Phase 1 implements the rename (pre-1.0, update all call sites — no deprecation shims). |
| **Host execution** | **`signAndSendTransaction`** | Branding signs + submits via Alchemy. Hosts need no Solana RPC. Optional raw `signTransaction` can wait. |
| **CoinOperated path** | Native SOL send + later USDC/CCTP (incl. bridge back toward Arc) | Covered by Phases 3 → 6 → 7–8; no Phase 0 change. |
| **Branding Solana SDK** | **`@solana/kit` + program clients** | See tradeoffs below. Signing Layer stays dep-free; `ows-signer-utils` stays curve/bytes-oriented (no Kit in the signer iframe path). |

#### Cluster = Solana’s word for “which network”

Yes — **cluster ≈ chain** in our vocabulary. Official roles:

| Cluster | Who it’s for | Verdict for us |
|---------|--------------|----------------|
| **Mainnet** | Production | Required |
| **Devnet** | App / wallet / program developers; public faucets; same software family as mainnet; Alchemy `solana-devnet` | **Our one test network** |
| **Testnet** | Core/validator stress tests; newer release branch; flakier; not the app playground | Skip |

“Bigger / easier” for wallets is **Devnet**, not Testnet. Testnet can run *newer* validator software, but that doesn’t help CoinOperated or CCTP testing — Devnet has the faucets, docs, and RPC product surface (including Alchemy).

#### Library tradeoffs (Branding only)

| Option | Pros | Cons |
|--------|------|------|
| **`@solana/web3.js` v1 (legacy)** | Familiar tutorials; already a transitive dep in this repo | Maintenance mode; SPL path stuck on legacy; wrong long-term bet |
| **`@solana/web3.js` v3** | Class API (`Connection`, `Transaction`, `PublicKey`) on Kit internals; easier if we want old-shaped snippets | Transitional; still not where new Solana frontend docs lead |
| **`@solana/kit` + `@solana-program/system` (and later token)** | Current official path; tree-shakeable; Wallet Standard–aligned types (`Address`); instruction planners for send/confirm | Newer mental model; fewer copy-paste Stack Overflow answers; AI/docs must follow Kit, not v1 |

**Recommendation: Kit for the Embedded Wallet.** We are building a Standard wallet and owning RPC submit — Kit’s RPC + transaction planner match that. Do **not** put Kit (or web3.js) in `ows-signer`; Branding builds the tx bytes / message bytes, Signing only Ed25519-signs what Branding asks for. Avoid legacy web3.js v1 for *our* code even if something transitive still pulls it. If Phase 3 hits painful Kit gaps, fall back to web3.js v3 as a bridge — not v1.

**Phase 0 exit:** Decisions above recorded; Phase 1 starts by migrating `SolanaChainId` to CAIP sentinels and extending `SolanaSigner` signing APIs.

---

### Phase 1 — OWS layer primitives & signer routing

**Status: done** (OWS packages). CAIP `SolanaChainId`, program/mint/signature brands, `SolanaSigner.signMessage` / `signTransaction`, `toKitPartialSigner`, `SOLANA_WIRE_METHODS` + `proxy.solana` / `wallet.solana.register`. No Wallet Standard discovery yet (Phase 2).

**Repos:** `prf-wallet` (`ows-types`, `ows-signer-utils`, thin hooks in `ows-wallet-utils` / `ows-provider`).

**Intent:** Curve/address/signing building blocks and Branding↔Signing methods. No Host Wallet Standard yet, no Embedded Wallet Solana panel required to merge (tests in OWS packages).

**Delivered**

- Branded primitives (`SolanaAccountAddress`, `SolanaProgramAddress`, `SolanaMintAddress`, `SolanaSignature`, `SolanaTransactionSignature`) via `@solana/addresses`.
- `SolanaSigner.signMessage` / `signTransaction` over `ed25519` `signDigest`; `toKitPartialSigner` for Kit planners.
- Wire vocabulary `solana.getAccountAddress` | `signMessage` | `signTransaction` | `signAndSendTransaction` | `signIn`.

**Reminders (carry forward)**

- Address is the base58 Ed25519 pubkey — already derived; keep cache invalidation rules consistent with Change Account.
- No EIP-191 prefix; Ledger-style prefixes are a wallet/app concern if we ever support hardware (out of scope).
- Versioned transactions (v0 + ALTs) are the ecosystem default — Branding/Kit supplies `messageBytes`.

**Exit criteria:** Met for OWS layer (types + signer + Host/Branding wire shell).

---

### Phase 2 — Wallet Standard on `ows-provider`

**Status: done.** Hosts opt in with `proxy.solana.registerSolanaWallet()` / `unregisterSolanaWallet()` (never auto-registered in `OWSProxy.create`). Branding registers a connect stub via `wallet.solana.register` (`registerSolanaProvider`); sign paths throw `OwsUnimplementedError` until Phases 4–6.

**Repos:** `prf-wallet/packages/ows-provider` + embedded-wallet Branding stub + host demos / skills.

**API**

```ts
const proxy = await OWSProxy.create(container, walletUrl);
proxy.solana.registerSolanaWallet(); // optional { name?, icon? }
// Visible via getWallets() / Wallet Adapter StandardWalletAdapter
```

**Delivered**

- `OwsSolanaStandardWallet` — features: `standard:connect` / `disconnect` / `events`, `solana:signMessage`, `solana:signIn`, `solana:signTransaction`, `solana:signAndSendTransaction` on `solana:mainnet` + `solana:devnet`.
- Host tx split/merge with `@solana/transactions` (full serialized tx ↔ message bytes + signature merge); Branding wire still message-bytes.
- Branding `getAccountAddress` stub (session → storage → signer); other methods unimplemented stubs.
- Host demos + `1shot-wallet` / `ows-branding-layer` skill notes.

**Exit criteria:** Met — discovery + connect path; sign features discoverable and reject cleanly without Branding sign handlers.

---

### Phase 3 — Embedded Wallet: native SOL (mainnet + Devnet)

**Repos:** `embedded-wallet` UI + chain catalog + Solana RPC read path.

**Intent:** Selecting Solana feels like a first-class chain: show **native balance + address**, Receive, and Send for SOL only. No SPL mints yet. Product clusters: **`solana:mainnet`** and **`solana:devnet`** only.

**UI direction**

- Prefer **EVM-like layout** (balances chrome, asset identity, send/receive) over the Bitcoin-only stripped panel — user callout: `SolanaDetails` similar in *role* to `BitcoinDetails`, but **styled like EVM**, with a `SolanaAssetList` (initially a single native row) under `src/components/balances/`.
- Reuse `ReceiveModal` with the Solana wallet address (not an ATA).
- Send: Solana-native send modal (system transfer). Confirm sheet shows fee only (no ATA creation for native SOL).

**Infra**

- Add Solana entries to `EChain` / `HardcodedChainRepository` with **Alchemy** HTTPS RPC (same key pattern as EVM `alchemyRpc(...)`).
- `ISolanaRpc` / service analogous to Bitcoin’s read+send split, but keep types branded.

**Reminders**

- Native SOL ≠ SPL; don’t model SOL as a mint in this phase.
- Sender must hold SOL for fees; failure modes differ from ERC-20 (no separate “gas token” abstraction beyond SOL itself).
- Chain switch / `configure` / playground: if Host-tunable chain lists or copy gain Solana keys, update Zod defaults + both configurators (this repo `host/` and website playground) per AGENTS.md.

**Exit criteria:** User can unlock, switch to Solana mainnet (and one test cluster), see balance/address, receive via QR, send SOL via Alchemy-submitted tx.

**Suggested immediate follow within this phase or a tight 3b:** in-wallet native Send is required for CoinOperated demos even before Host `signAndSendTransaction`.

---

### Phase 4 — `SolanaSignModal` (`signMessage`)

**Repos:** Branding consent UI + Host Standard `solana:signMessage` + signer-utils.

**Intent:** Hosts/dapps can request Ed25519 signatures over arbitrary bytes (usually UTF-8).

**Reminders**

- Consent copy should show a **decoded UTF-8 preview when valid**, hex/bytes fallback otherwise (same spirit as personal_sign).
- Return signature **and** clarify whether Branding/Standard also returns the exact bytes signed (Standard `signMessage` does — keep Host/Branding aligned).
- Passkey ceremony still runs in Signing iframe; Branding owns the “what are you signing?” modal.

**Exit criteria:** Standard `signMessage` + in-wallet modal; denial paths match existing analytics/error helpers.

---

### Phase 5 — SIWS modal (`solana:signIn`)

**Repos:** Branding SIWS consent + Standard `solana:signIn`.

**Intent:** Sign-In With Solana parity with SIWE-style Host auth flows.

**Reminders**

- Wallet constructs / may adjust the message; output includes `signedMessage` + `signature` + account. Verifiers must use the returned bytes.
- Message shape is EIP-4361-like; domain binding matters for phishing UX — show domain prominently.
- Many apps still abuse raw `signMessage` with SIWS text; Phase 4 covers that. Phase 5 is the one-shot connect+sign feature.

**Exit criteria:** `solana:signIn` works end-to-end with a clear SIWS-specific modal (not a generic byte blob if we can parse inputs).

---

### Phase 6 — `signAndSendTransaction` (Host execution via Alchemy)

**Repos:** Branding tx decode/consent + build/sign/submit + Standard feature. **Haziest phase — design spike required.**

**Intent:** Dapps can request execution without owning a Solana RPC. Branding signs with the passkey and **submits through Alchemy**.

#### Requirements (non-negotiable)

1. **Branding owns RPC submit** for `signAndSendTransaction`. Hosts must not be required to pass an RPC URL or API key.
2. **User consent before Signing ceremony** — show a Solana-specific confirm UI (fee payer, summary of instructions at a human level, destination SOL amount when detectable). Perfect ABI decoding is not required for MVP; silent blind-sign is not acceptable.
3. **Fee payer = user** for MVP. Do not silently replace fee payer or sponsor fees.
4. **Block or warn on dangerous patterns** we can detect cheaply (exact policy TBD in spike): e.g. unexpected durable nonce, authority changes, create-account draining rent to strangers — start conservative.
5. **Idempotent enough UX:** show signature / signature status; surface RPC errors without stuck spinners.
6. **Cluster binding:** tx must match the wallet’s selected Solana cluster (reject mainnet tx while UI is on Devnet, etc.).

#### Restrictions / explicit non-goals for MVP

- No relayer, no sponsored SOL gas, no “Host pays fees.”
- No guarantee of full program IDL decoding (unknown programs → generic instruction list / risk copy).
- No multi-wallet / coin-signer aggregation.
- No automatic ALT (address lookup table) management beyond accepting versioned txs that already reference ALTs.
- Prefer **partially signed only by us**: if the tx requires other signers, fail clearly.
- Cap or reject oversized / multi-hundred-instruction txs if they break consent UI (define limit in spike).
- Priority fees / compute budget: follow sane defaults or preserve what the dapp set; don’t invent a second fee market UI in MVP unless Send already needs it.

#### Open questions for the Phase 6 design cycle

- Expose **`signTransaction`** (return serialized signed tx) in addition to sign-and-send? (Useful for dapps that must submit themselves; still no Host Alchemy key.)
- Simulation (`simulateTransaction`) before confirm — strongly recommended if Alchemy supports it reliably for our tx set.
- How Wallet Standard `account` / `chains` update when the user switches Solana cluster in-wallet.
- Mobile / extension: same Branding submit path vs WalletConnect `solana_signTransaction` already sketched in tests.

**Exit criteria:** A Host using Wallet Standard `signAndSendTransaction` can transfer SOL (and later SPL) with Branding showing consent and returning a signature; no Host RPC configuration.

---

### Phase 7 — Mint / tracked assets (USDC first)

**Repos:** Known assets + tracked assets + balances UI + ATA setup + Send for SPL.

**Intent:** Wallet consistency with EVM token list: track USDC on Solana, show balances, let the user **set up receiving** without exposing ATA addresses.

**Likely work**

- Extend asset typing for Solana mints (new `EAssetType` value or Solana-specific enum — decide deliberately; do not overload `Erc20`).
- Known Asset catalog entry for **USDC** (mainnet mint; optional Devnet mint for test).
- **Add Asset** flow: user picks USDC → Branding creates their USDC ATA (user pays rent + fees) → track + show balance.
- Balances / `AssetDetails`: stick to EVM patterns (icon, symbol, balance, Send / Receive / Bridge placeholders). **Never show ATA address** in primary UI; Receive still shows wallet pubkey + short explanation that senders create accounts as needed.
- Send SPL: if recipient ATA missing, include `CreateIdempotent` and surface **“create recipient token account ~0.002 SOL”** on the confirm sheet; require enough SOL for rent+fees, not only token balance.
- Detect Token program vs Token-2022 when deriving ATAs.

**Reminders**

- Empty ATA with 0 balance still locks rent — listing policy TBD (show tracked zeros vs hide).
- Do not ask users to paste ATA addresses for bridging or receive.
- Griefing (create ATA → close → reclaim) matters for *protocols that sponsor* ATA creation; user-initiated Add Asset and sender-pays-on-Send are the safe defaults.

**Exit criteria:** USDC can be added, ATA created, balance shown, sent/received with EVM-like chrome; native SOL still works.

---

### Phase 8 — CCTP bridge (native SOL? + USDC mints)

**Repos:** Bridge UI + CCTP utils extended for Solana domain + Forwarding.

**Intent:** Bridge flows involving Solana, prioritized around **USDC via CCTP** (product-consistent with EVM). Re-read “native SOL” carefully: CCTP moves **USDC**, not SOL. Native SOL bridging would be a different bridge (Wormhole/Li.FI/etc.) — treat as optional later unless CoinOperated explicitly needs SOL↔X.

**Recommended CCTP scope**

1. **EVM → Solana USDC** using existing burn + Forwarding (dest mint to **USDC ATA**; `includeRecipientSetup` when needed). May work before Solana sign-and-send if Forwarding covers dest.
2. **Solana → EVM USDC** — requires Solana burn tx via Phase 6 Alchemy path + attestation + EVM receive/forwarding as designed.
3. In-wallet Bridge entry from Solana USDC `AssetDetails` / Host `bridge` RPC extended with Solana chain ids.

**Reminders**

- `mintRecipient` = ATA (32-byte), not wallet pubkey.
- Forwarding fees on Solana include rent/gas semantics different from EVM — quote UI must not reuse EVM-only fee copy blindly.
- Li.FI remains a future aggregator option; not required to declare CCTP done.

**Exit criteria:** User can bridge USDC between a supported EVM chain and Solana with consent UX consistent with current CCTP chrome; Host `bridge` accepts Solana where applicable.

---

## Cross-cutting work (schedule into phases, don’t forget)

| Item | Where |
|------|--------|
| Skills: `1shot-wallet`, `ows-branding-layer` | With Phase 2+ Host surface and Branding RPC |
| Extension MAIN-world / side panel | After Standard registration works on Host; may need explicit register in extension page |
| Mobile WC `solana` namespace | Align method names with Standard features when mobile Solana is prioritized |
| Analytics events | Mirror EVM sign/send/bridge events with Solana props (`chainId`, mint, ATA-created flag) |
| Onramp | Circle onramp to Solana USDC — separate spike; not blocking Phases 1–7 |
| Website / host playground chain lists | When Solana appears in configurators |

---

## Suggested build cadence

Do **not** 1-shot. Suggested loops:

1. **Phase 0 + 1** — types & signer (OWS PR)
2. **Phase 2 + connect** — Standard registration + account (OWS + thin Branding)
3. **Phase 3** — native SOL UI & Send (Embedded Wallet) ← first user-visible Solana
4. **Phase 4 → 5** — message auth (can parallelize UI after 3)
5. **Phase 6 spike → build** — signAndSendTransaction (hardest Host value)
6. **Phase 7** — USDC mint / ATA
7. **Phase 8** — CCTP

CoinOperated amplification: **Phase 3** unblocks “Solana exists”; **Phase 6** unblocks dapp execution; **Phase 7–8** unblocks USDC destination narratives.

---

## Document status

Living outline. When a phase starts, spawn a short design note (or PR description) with concrete APIs, file lists, and test plan — then implement. Update this file only when prioritization or non-goals change.
