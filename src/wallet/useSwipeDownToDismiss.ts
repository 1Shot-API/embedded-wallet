import { useRef, type TouchEvent } from "react";

const MIN_DY_PX = 88;
const MAX_DX_RATIO = 0.65;

function elementCanScrollUp(start: EventTarget | null): boolean {
  let node =
    start instanceof Element
      ? start
      : start instanceof Node
        ? start.parentElement
        : null;

  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const { overflowY } = getComputedStyle(node);
      const scrollable =
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay";
      if (scrollable && node.scrollTop > 0) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Touch handlers for swipe-down-to-dismiss (mobile drawer / flyout).
 * Ignores gestures that begin inside a scrolled container.
 */
export function useSwipeDownToDismiss(
  enabled: boolean,
  onDismiss: () => void,
): {
  onTouchStart: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
  onTouchCancel: () => void;
} {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    startRef.current = null;
  };

  return {
    onTouchStart: (event) => {
      if (!enabled || event.touches.length !== 1) {
        clear();
        return;
      }
      if (elementCanScrollUp(event.target)) {
        clear();
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        clear();
        return;
      }
      startRef.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (event) => {
      const start = startRef.current;
      clear();
      if (!enabled || !start || event.changedTouches.length === 0) {
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }
      const dy = touch.clientY - start.y;
      const dx = Math.abs(touch.clientX - start.x);
      if (dy < MIN_DY_PX || dx > dy * MAX_DX_RATIO) {
        return;
      }
      onDismiss();
    },
    onTouchCancel: clear,
  };
}
