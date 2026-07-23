import type { IStyleFormState } from "../styleForm";

export interface IWalletConfiguratorTextTabSectionProps {
  form: IStyleFormState;
  patch: <K extends keyof IStyleFormState>(
    key: K,
    value: IStyleFormState[K],
  ) => void;
}
