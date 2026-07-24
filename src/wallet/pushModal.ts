import { useModalStore } from "./modalStore";
import type { ActiveModal } from "./modalTypes";

export function pushModal<T>(
  build: (handlers: {
    id: string;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  }) => ActiveModal,
): Promise<T> {
  return useModalStore.getState().push(build);
}
