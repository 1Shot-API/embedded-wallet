import { create } from "zustand";
import type { EPasskeyPromptReason } from "../lib/types/enum";

type PasskeyPromptEntry = {
  id: string;
  reason: EPasskeyPromptReason;
};

export interface IPasskeyPromptStore {
  stack: PasskeyPromptEntry[];
  /** Top of stack, or `null` when no ceremony is in flight. */
  activeReason: EPasskeyPromptReason | null;
  show: (reason: EPasskeyPromptReason) => string;
  hide: (id: string) => void;
}

let nextId = 0;

function allocateId(): string {
  nextId += 1;
  return `passkey-prompt-${nextId}`;
}

/**
 * Stack of in-flight passkey explanations. Nested ceremonies push/pop so the
 * visible copy always matches the innermost WebAuthn prompt.
 */
export const usePasskeyPromptStore = create<IPasskeyPromptStore>((set, get) => ({
  stack: [],
  activeReason: null,

  show: (reason) => {
    const id = allocateId();
    const stack = [...get().stack, { id, reason }];
    set({
      stack,
      activeReason: stack[stack.length - 1]!.reason,
    });
    return id;
  },

  hide: (id) => {
    const stack = get().stack.filter((entry) => entry.id !== id);
    set({
      stack,
      activeReason: stack.length > 0 ? stack[stack.length - 1]!.reason : null,
    });
  },
}));
