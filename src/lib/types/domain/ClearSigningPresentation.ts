import type { IClearSigningDisplay } from "@1shotapi/ows-clear-signing";
import type { ClearSigningRegistrySha } from "@1shotapi/ows-types";

/**
 * A request rendered through an ERC-7730 descriptor: what the consent modals show in place of
 * raw calldata / typed-data fields, plus which registry file described it.
 */
export interface IClearSigningPresentation {
  readonly display: IClearSigningDisplay;
  /** Registry commit the descriptor was resolved at. */
  readonly registrySha: ClearSigningRegistrySha;
  /** Repo-relative registry file, e.g. `registry/1inch/calldata-AggregationRouterV6.json`. */
  readonly path: string;
}

export class ClearSigningPresentation implements IClearSigningPresentation {
  constructor(
    public readonly display: IClearSigningDisplay,
    public readonly registrySha: ClearSigningRegistrySha,
    public readonly path: string,
  ) {}
}
