const CONNECTED_ORIGINS_KEY = "connectedOrigins";

/**
 * Origins the user has connected to the wallet in this browser session.
 *
 * Persisted in `storage.session` so an MV3 service-worker restart does not
 * forget connections; falls back to memory where session storage is missing.
 */
export class ConnectedOrigins {
  private cache: Set<string> | null = null;

  async has(origin: string): Promise<boolean> {
    return (await this.load()).has(origin);
  }

  async add(origin: string): Promise<void> {
    const set = await this.load();
    if (set.has(origin)) return;
    set.add(origin);
    await this.persist(set);
  }

  async remove(origin: string): Promise<void> {
    const set = await this.load();
    if (!set.delete(origin)) return;
    await this.persist(set);
  }

  private async load(): Promise<Set<string>> {
    if (this.cache) return this.cache;
    let stored: unknown;
    try {
      stored = (await browser.storage.session.get(CONNECTED_ORIGINS_KEY))[
        CONNECTED_ORIGINS_KEY
      ];
    } catch {
      stored = undefined;
    }
    this.cache = new Set(
      Array.isArray(stored)
        ? stored.filter((v): v is string => typeof v === "string")
        : [],
    );
    return this.cache;
  }

  private async persist(set: Set<string>): Promise<void> {
    try {
      await browser.storage.session.set({ [CONNECTED_ORIGINS_KEY]: [...set] });
    } catch {
      // Memory-only fallback.
    }
  }
}
