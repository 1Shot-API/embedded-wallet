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

**Status: done.** Catalog `solana:mainnet` / `solana:devnet`, Alchemy RPC, native SOL balance + Receive + Send; local `oneshot-wallet-host` remaps SIWE→SIWS, disables typed data / delegations, and routes Sign to `proxy.solana.signMessage` (unimplemented until Phase 4).

**Repos:** `embedded-wallet` UI + chain catalog + Solana RPC + host Test panel remapping.

**Delivered**

- `EChain` / `HardcodedChainRepository` Solana rows; `switchChain` / `configure.allowedChains` accept CAIP Solana ids; thin `copy.solana`.
- `SolanaLamports`, `AlchemySolanaRpc`, `SolanaService` (Kit system transfer + `signer.solana.signTransaction` + Alchemy submit).
- `MainPanel` → `SolanaDetails` + `SolanaAssetList` + `SolanaSendModal`; shared `ReceiveModal`.
- Host: Solana in chain picker; SIWS template; Sign → `proxy.solana.signMessage`; typed data + EIP-7715 controls disabled.

**Exit criteria:** Met for native SOL in-wallet + chain-sensitive host demo structure.

---

### Phase 4 — `SolanaSignModal` (`signMessage`)

**Status: done.** Branding `SolanaSignModal` + real `solana.signMessage` (display hold, analytics, `copy.solanaSign`). Host Standard reuses input bytes as `signedMessage`.

**Repos:** Branding consent UI + Host Standard `solana:signMessage` + signer-utils.

**Delivered:** UTF-8 / hex preview consent → `signer.solana.signMessage` → `{ signatures }`; denial via `OwsUserRejectedError`.

**Exit criteria:** Met.

---

### Phase 5 — SIWS modal (`solana:signIn`)

**Status: done.** Branding `SiwsModal` + `SIWSUtils` message construction + real `solana.signIn`; host/website demos call `proxy.solana.signIn`.

**Repos:** Branding SIWS consent + Standard `solana:signIn`.

**Delivered:** Wallet fills SIWS defaults (domain, address, uri, chain, nonce, issuedAt); structured consent (`copy.siws`); returns `{ account, signedMessage, signature }`.

**Exit criteria:** Met.

---

### Phase 6 — `signAndSendTransaction` (Host execution via Alchemy)

**Done.** Branding consent + Alchemy simulate (warn) / submit; Standard `signTransaction` + `signAndSendTransaction` live.

**Intent:** Dapps can request execution without owning a Solana RPC. Branding signs with the passkey and **submits through Alchemy**.

#### Delivered

1. **Branding owns RPC submit** for `signAndSendTransaction` (Alchemy `sendTransaction`). Hosts do not pass RPC URLs or API keys.
2. **Consent UI** (`SolanaSignAndSendModal` / `copy.solanaSignAndSend`) — fee payer, instruction summary (System SOL transfers when detectable), host domain + network chrome.
3. **Fee payer = user**; reject extra required signers; reject more than 64 instructions; `signTransaction` batch capped at 5.
4. **Warn (non-blocking):** Alchemy `simulateTransaction` (`sigVerify: false`) failure; durable nonce AdvanceNonce.
5. **Cluster binding:** `params.chainId` (when set) must match the wallet’s selected Solana cluster.
6. **`signTransaction`** also shipped — same consent + sign path; Host merges signatures (no Branding submit).

#### Still deferred

- Dynamic Standard `account.chains` on in-wallet cluster switch (both chains still advertised).
- Mobile / extension-specific path vs WalletConnect `solana_signTransaction`.
- Full IDL decode / SPL (Phase 7).

**Exit criteria:** Met for native SOL via Wallet Standard (host + website playground demos).

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
3. ~~**Phase 3** — native SOL UI & Send (Embedded Wallet)~~ **done**
4. ~~**Phase 4 → 5** — message auth / SIWS~~ **done**
5. **Phase 6 spike → build** — signAndSendTransaction ← next
6. **Phase 7** — USDC mint / ATA
7. **Phase 8** — CCTP

CoinOperated amplification: Phase 3 unblocked “Solana exists”; **Phase 6** unblocks dapp execution; **Phase 7–8** unblocks USDC destination narratives.

---

## Document status

Living outline. When a phase starts, spawn a short design note (or PR description) with concrete APIs, file lists, and test plan — then implement. Update this file only when prioritization or non-goals change.
