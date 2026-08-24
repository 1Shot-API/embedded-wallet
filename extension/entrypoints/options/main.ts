import { getSettings, setSettings } from "../../src/shared/storage";

const walletUrlInput = document.getElementById("wallet-url") as HTMLInputElement;
const preferInput = document.getElementById(
  "prefer-oneshot",
) as HTMLInputElement;
const allowlistInput = document.getElementById("allowlist") as HTMLTextAreaElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;

function setStatus(message: string, kind: "ok" | "error" | "" = ""): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("ok", kind === "ok");
  statusEl.classList.toggle("error", kind === "error");
}

function parseAllowlist(text: string): string[] {
  const origins = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      throw new Error(`Invalid origin: ${trimmed}`);
    }
  }
  return [...origins];
}

async function load(): Promise<void> {
  const settings = await getSettings();
  walletUrlInput.value = settings.walletUrl;
  preferInput.checked = settings.preferOneshot;
  allowlistInput.value = settings.allowlist.join("\n");
}

saveBtn.addEventListener("click", () => {
  void (async () => {
    try {
      new URL(walletUrlInput.value.trim());
      const allowlist = parseAllowlist(allowlistInput.value);
      await setSettings({
        walletUrl: walletUrlInput.value.trim(),
        preferOneshot: preferInput.checked,
        allowlist,
      });
      setStatus("Saved", "ok");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  })();
});

void load();
