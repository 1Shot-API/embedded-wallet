import {
  DomainString,
  EVMAccountAddress,
  OWSAnalyticsEvent,
  type EVMChainId,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class TransactionSubmittedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly to: EVMAccountAddress,
    public readonly txHash: EVMTransactionHash,
    public readonly durationMs: number,
    public readonly methodId: string | null = null,
  ) {
    super(EAnalyticsEventName.TransactionSubmitted, hostDomain);
  }
}

export class TransactionSubmitFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly errorCode: string,
    public readonly durationMs: number,
    public readonly to: EVMAccountAddress | null = null,
  ) {
    super(EAnalyticsEventName.TransactionSubmitFailed, hostDomain);
  }
}

export class TransactionSubmitCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly durationMs: number,
    public readonly to: EVMAccountAddress | null = null,
  ) {
    super(EAnalyticsEventName.TransactionSubmitCancelled, hostDomain);
  }
}
