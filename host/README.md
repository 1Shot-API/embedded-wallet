# Test Host Layer

Local Host Layer for exercising Host ↔ Branding communication against this repo’s wallet (served at domain root).

Adapted from OWS [`examples/host`](https://github.com/1Shot-API/open-wallet/tree/main/examples/host), plus a **Style** panel that calls `proxy.rpc("setStyle", options)`.

## Run

From the repo root (after `npm install`):

```bash
# Terminal 1 — Branding Layer (prefer ngrok for passkeys)
npm run dev

# Terminal 2 — this host
npm run dev:host
```

Open the printed host URL (default `http://localhost:5173`). The iframe URL comes from:

1. `WALLET_IFRAME_URL` if set
2. else `https://{NGROK_DOMAIN}/` when `NGROK_DOMAIN` is set in root `.env`
3. else `http://localhost:5174/`

## HTTPS (passkeys)

If the wallet iframe is HTTPS (ngrok), the host page should also be HTTPS for a secure-context ancestor chain:

```bash
mkcert -install
mkcert -cert-file host/certs/dev-cert.pem \
  -key-file host/certs/dev-key.pem \
  localhost 127.0.0.1
```

Certs present under `host/certs/` enable HTTPS automatically; or set `HOST_HTTPS=1`.
