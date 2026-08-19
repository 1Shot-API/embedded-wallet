/**
 * Resolve the dApp tab the user is working on.
 *
 * Firefox sidebars / Chrome side panels are not normal browser windows, so
 * `tabs.query({ active: true, currentWindow: true })` often returns nothing
 * ("No active tab"). Prefer the last-focused browser window instead.
 */
export async function queryActiveDappTab(): Promise<{
  id?: number;
  url?: string;
} | undefined> {
  try {
    const [fromLastFocused] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (fromLastFocused?.id != null && isInjectableTabUrl(fromLastFocused.url)) {
      return fromLastFocused;
    }
  } catch {
    // fall through
  }

  try {
    const [fromCurrent] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (fromCurrent?.id != null && isInjectableTabUrl(fromCurrent.url)) {
      return fromCurrent;
    }
  } catch {
    // fall through
  }

  try {
    const windows = await browser.windows.getAll({
      populate: true,
      windowTypes: ["normal"],
    });
    const focused = windows.find((win) => win.focused) ?? windows[0];
    const tab = focused?.tabs?.find((t) => t.active);
    if (tab?.id != null && isInjectableTabUrl(tab.url)) {
      return tab;
    }
  } catch {
    // fall through
  }

  return undefined;
}

function isInjectableTabUrl(url: string | undefined): boolean {
  if (!url) return true; // may fill in after tabs permission / pending load
  return !(
    url.startsWith("about:") ||
    url.startsWith("chrome:") ||
    url.startsWith("chrome-extension:") ||
    url.startsWith("moz-extension:") ||
    url.startsWith("devtools:")
  );
}
