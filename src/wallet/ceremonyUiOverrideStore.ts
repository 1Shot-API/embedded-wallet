import { create } from "zustand";
import type { EPasskeyPromptReason } from "../lib/types/enum";

/**
 * Optional ceremony-copy override for nested Signing Layer calls (e.g. wallet
 * upgrade authorization signing through viem). Does not show Branding overlays.
 */
export interface ICeremonyUiOverrideStore {
  reason: EPasskeyPromptReason | null;
  runWithReason: <T>(
    reason: EPasskeyPromptReason,
    run: () => Promise<T>,
  ) => Promise<T>;
}

export const useCeremonyUiOverrideStore = create<ICeremonyUiOverrideStore>(
  (set, get) => ({
    reason: null,

    async runWithReason(reason, run) {
      const previous = get().reason;
      set({ reason });
      try {
        return await run();
      } finally {
        set({ reason: previous });
      }
    },
  }),
);

/** Run Signing Layer work with temporary passkey Confirm copy override. */
export async function withCeremonyUiReason<T>(
  reason: EPasskeyPromptReason,
  run: () => Promise<T>,
): Promise<T> {
  return useCeremonyUiOverrideStore.getState().runWithReason(reason, run);
}
