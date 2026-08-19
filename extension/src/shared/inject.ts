/**
 * Ensure the extension can inject scripts into the tab (optional host permission).
 */
export async function ensureHostPermissionForTab(
  tabId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tab = await browser.tabs.get(tabId);
  const url = tab.url;
  if (!url) {
    return { ok: false, error: "Tab has no URL" };
  }
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return { ok: false, error: "Invalid tab URL" };
  }
  if (
    origin.startsWith("chrome:") ||
    origin.startsWith("about:") ||
    origin.startsWith("moz-extension:") ||
    origin.startsWith("chrome-extension:") ||
    origin === "null"
  ) {
    return { ok: false, error: "Cannot inject into browser-internal pages" };
  }

  const originPattern = `${origin}/*`;
  const has = await browser.permissions.contains({
    origins: [originPattern],
  });
  if (has) {
    return { ok: true };
  }

  const granted = await browser.permissions.request({
    origins: [originPattern],
  });
  if (!granted) {
    return { ok: false, error: "Host permission denied" };
  }
  return { ok: true };
}

export async function injectProviderIntoTab(
  tabId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const perm = await ensureHostPermissionForTab(tabId);
  if (!perm.ok) {
    return perm;
  }

  try {
    // Isolated content bridge
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["/content-scripts/content.js"],
    });
  } catch (error) {
    // Already injected is fine; continue to MAIN world
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|duplicate|Cannot access/i.test(message)) {
      // Still try MAIN; content may already be present
      console.warn("[1Shot] content inject:", message);
    }
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["/inpage.js"],
      world: "MAIN",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `MAIN-world inject failed: ${message}` };
  }

  return { ok: true };
}
