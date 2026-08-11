# 1Shot Wallet browser extension

MetaMask-style host for the 1Shot Branding Layer: a thin MAIN-world EIP-1193 / EIP-6963 shim on the dApp page, with `OWSProxy` hosted **Inline** in a Chrome side panel / Firefox sidebar.

This avoids page `frame-src` CSP, hostile host CSS, and per-dApp third-party storage partitions.

## Requirements

- Node.js 22+
- Chrome 116+ (side panel + `scripting.executeScript` MAIN world)
- Firefox 128+ (MV3 + MAIN world + sidebar)

## Develop

From the embedded-wallet repo root:

```bash
npm install
npm run dev:extension          # Chrome HMR → extension/dist/chrome-mv3-dev
```

### Firefox (important)

Do **not** use Vite serve (`firefox-mv3-dev`) for day-to-day Firefox testing.
Firefox’s extension CSP blocks Vite’s `eval` / `wss://localhost:3000` HMR, so
sidepanel/options modules often never run (buttons appear dead, sidebar stuck on
“Loading wallet…”).

```bash
npm run build:firefox -w @1shotapi/oneshot-wallet-extension
# same as: npm run dev:firefox -w @1shotapi/oneshot-wallet-extension
# → extension/dist/firefox-mv3 (self-contained CSS/JS)
```

Then `about:debugging` → Load Temporary Add-on →
`extension/dist/firefox-mv3/manifest.json`. After code changes, rebuild and
click **Reload** on the temporary add-on (or remove/re-add).

Legacy Vite serve (broken under Firefox CSP) remains as
`npm run dev:firefox:vite -w @1shotapi/oneshot-wallet-extension` →
`firefox-mv3-dev` only.

### Point at a local / ngrok wallet

Open the extension **Settings** and set **Wallet iframe URL** to a full URL
(e.g. `https://immune-sheep-light.ngrok-free.app/`). Default is
`https://wallet.1shotapi.com/`.

Load the unpacked extension:

- **Chrome (dev):** `chrome://extensions` → Load unpacked → `extension/dist/chrome-mv3-dev`
- **Chrome (stable build):** `extension/dist/chrome-mv3`
- **Firefox (recommended):** load `extension/dist/firefox-mv3/manifest.json`
  (from `build:firefox` / `dev:firefox`)
- **Firefox Vite-dev (unsupported):** `extension/dist/firefox-mv3-dev` — CSS may
  load after CSP tweaks, but entrypoint JS regularly dies; prefer `firefox-mv3`.

## Use

The **side panel / sidebar** is the wallet UI (Branding iframe). It does **not**
automatically put a provider on the dApp. Injection is explicit:

1. Open the dApp tab (or the host **Injected** playground).
2. In the extension side panel top bar, click **Inject** (or the toolbar
   popup → **Inject on this page**). Grant host permission if prompted.
3. Optionally **Always** / **Always inject on this origin** for reload auto-inject.
4. Confirm in the page console:
   - `window.ethereum?.is1Shot === true`, and/or
   - EIP-6963 announce for `com.1shotapi.wallet`
5. Connect in the dApp. If MetaMask is also installed, enable **Prefer 1Shot as
   window.ethereum** in extension Settings, or pick 1Shot from an EIP-6963 wallet
   list (Uniswap’s shortcut strip may only highlight MetaMask).

Approve / sign stays in the side panel.

**Firefox note:** Keep the side panel open while connecting. The extension only
opens the sidebar when it has no live panel connection — calling
`sidebarAction.open()` on an already-open panel can reload it and drop Connect RPCs.

### Easiest local test

```bash
npm run dev:host
npm run build -w @1shotapi/oneshot-wallet-extension   # reload the temp add-on
```

Open the host → sidebar mode **Injected** → extension **Inject** on that tab →
**Connect**. That page never creates `OWSProxy`; it only talks to the injected
provider.


## Build / pack

```bash
npm run build:extension                 # Chrome MV3 → extension/dist/chrome-mv3
npm run build:firefox -w @1shotapi/oneshot-wallet-extension
npm run pack:chrome -w @1shotapi/oneshot-wallet-extension   # zip for CWS
npm run pack:firefox -w @1shotapi/oneshot-wallet-extension  # zip for AMO
```

### Chrome Web Store (unlisted / test)

1. `npm run pack:chrome -w @1shotapi/oneshot-wallet-extension`
2. Upload the zip from `extension/.output/` (WXT zip output) in the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Publish as **Unlisted** for testers.

### Firefox AMO self-distribution

1. `npm run pack:firefox -w @1shotapi/oneshot-wallet-extension`
2. Sign with [AMO](https://addons.mozilla.org/developers/) “On your own” / self-distributed listing (JWT API credentials), or upload for signing and download the `.xpi`.
3. Extension id: `wallet-extension@1shotapi.com` (see `browser_specific_settings.gecko`).

## Architecture

```
dApp MAIN world          content script           service worker           side panel
─────────────────        ──────────────           ──────────────           ──────────
inpage.js shim    ←post→ bridge            ←msg→ router / queue    ←port→ OWSProxy Inline
window.ethereum                                 openWalletUi()            Branding iframe
EIP-6963 announce                               allowlist inject
```

- `@1shotapi/ows-provider` is **only** bundled into the side panel page.
- MAIN-world inject uses `chrome.scripting.executeScript({ world: "MAIN" })` so page `script-src` CSP does not block the shim.

## Privacy

- No page scraping or analytics beyond what the Branding iframe already does for wallet UX.
- Scripts inject only after user action or for allowlisted origins the user added.
- Use **Always** (side panel) so the provider re-injects after a dApp tab refresh.
  One-shot **Inject** does not survive reload — without Always you must Inject again
  before Connect will find 1Shot.
- Optional host permissions are requested per origin when injecting.

## Limitations

- Closing the side panel destroys the `OWSProxy` session; the next RPC reopens the panel and recreates the proxy (wallet storage under the extension top-level partition should restore accounts).
- Extension page CSP must allow framing your wallet URL (`https:` and localhost are allowed in this test build).
- Safari `/create/` handoff still opens from Branding inside the panel iframe — allow popups from the extension page if prompted.

## Manual test checklist

- [ ] Inject on a page with strict `frame-src 'self'` — Connect Wallet still works (iframe is only in the side panel).
- [ ] MetaMask installed: EIP-6963 lists 1Shot; Prefer 1Shot toggles `window.ethereum`.
- [ ] MetaMask absent: `window.ethereum` is 1Shot after inject.
- [ ] Allowlist origin → reload → shim present without clicking Inject.
- [ ] Settings wallet URL → ngrok Branding → panel loads and unlock/connect works.
- [ ] `eth_requestAccounts` / send opens and focuses the side panel.
