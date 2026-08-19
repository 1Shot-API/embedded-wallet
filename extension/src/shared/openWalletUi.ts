/**
 * Open / focus the wallet UI: Chrome sidePanel or Firefox sidebarAction.
 */
export async function openWalletUi(windowId?: number): Promise<void> {
  const chromeSidePanel = (
    globalThis as unknown as {
      chrome?: {
        sidePanel?: {
          open: (options: { windowId: number }) => Promise<void>;
          setOptions?: (options: {
            path?: string;
            enabled?: boolean;
          }) => Promise<void>;
        };
      };
    }
  ).chrome?.sidePanel;

  if (chromeSidePanel?.open) {
    let id = windowId;
    if (id == null) {
      const win = await browser.windows.getCurrent();
      id = win.id;
    }
    if (id == null) {
      throw new Error("No window id for sidePanel.open");
    }
    await chromeSidePanel.open({ windowId: id });
    return;
  }

  // Firefox MV3 sidebar
  const sidebar = (
    browser as unknown as {
      sidebarAction?: {
        open: () => Promise<void>;
      };
    }
  ).sidebarAction;

  if (sidebar?.open) {
    await sidebar.open();
    return;
  }

  // Last resort: open sidepanel.html in a popup window
  await browser.windows.create({
    url: browser.runtime.getURL("/sidepanel.html"),
    type: "popup",
    width: 400,
    height: 640,
  });
}
