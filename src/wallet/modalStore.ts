import { create } from "zustand";
import { nextModalId, type ActiveModal } from "./modalTypes";

export type ModalBuildHandlers<T> = {
  id: string;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export interface IModalStore {
  queue: ActiveModal[];
  activeModal: ActiveModal | null;
  /** Enqueue a modal; resolves when the modal calls resolve/reject. */
  push: <T>(build: (handlers: ModalBuildHandlers<T>) => ActiveModal) => Promise<T>;
  remove: (id: string) => void;
}

export const useModalStore = create<IModalStore>((set, get) => ({
  queue: [],
  activeModal: null,

  remove: (id) => {
    const queue = get().queue.filter((modal) => modal.id !== id);
    set({
      queue,
      activeModal: queue[0] ?? null,
    });
  },

  push: <T>(build: (handlers: ModalBuildHandlers<T>) => ActiveModal) => {
    return new Promise<T>((resolve, reject) => {
      const id = nextModalId();
      let settled = false;

      const finishResolve = (value: T) => {
        if (settled) return;
        settled = true;
        get().remove(id);
        resolve(value);
      };

      const finishReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        get().remove(id);
        reject(error);
      };

      const modal = build({
        id,
        resolve: finishResolve,
        reject: finishReject,
      });

      set((state) => ({
        queue: [...state.queue, modal],
        activeModal: state.activeModal ?? modal,
      }));
    });
  },
}));
