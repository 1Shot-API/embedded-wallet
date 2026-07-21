import type { WalletConfig } from "../../types/domain/WalletConfig";

export interface IConfigProvider {
  getConfig(): Promise<WalletConfig>;
}

export const IConfigProviderType = Symbol.for("IConfigProvider");
