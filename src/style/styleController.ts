import type { IResolvedStyle, IStyleOptions } from "./types";
import { applyStyleToDocument, createInitialStyle, mergeStyle } from "./applyStyle";

type StyleListener = (style: IResolvedStyle) => void;

let current = createInitialStyle();
const listeners = new Set<StyleListener>();

/** Module-level style controller — callable from OWS RPC handlers outside React. */
export const styleController = {
  get(): IResolvedStyle {
    return current;
  },

  /** Apply defaults (or an optional cold-start patch) once at app boot. */
  init(patch?: IStyleOptions): IResolvedStyle {
    current = createInitialStyle(patch);
    applyStyleToDocument(current);
    notify();
    return current;
  },

  /** Deep-merge options (additive; used by configure RPC). */
  merge(patch: IStyleOptions): IResolvedStyle {
    current = mergeStyle(current, patch);
    applyStyleToDocument(current);
    notify();
    return current;
  },

  subscribe(listener: StyleListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function notify(): void {
  for (const listener of listeners) {
    listener(current);
  }
}
