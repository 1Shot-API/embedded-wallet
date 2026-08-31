import {
  DomainString,
  EVMAccountAddress,
  OWSAnalyticsEvent,
  type EVMChainId,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class BridgeOpenedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly destChainId: EVMChainId | null = null,
  ) {
    super(EAnalyticsEventName.BridgeOpened, hostDomain);
  }
}

export class BridgeCompletedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly destChainId: EVMChainId | null,
    public readonly txHash: EVMTransactionHash,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.BridgeCompleted, hostDomain);
  }
}

export class BridgeFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly errorCode: string,
    public readonly durationMs: number,
    public readonly destChainId: EVMChainId | null = null,
  ) {
    super(EAnalyticsEventName.BridgeFailed, hostDomain);
  }
}

export class BridgeCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly durationMs: number,
    public readonly destChainId: EVMChainId | null = null,
  ) {
    super(EAnalyticsEventName.BridgeCancelled, hostDomain);
  }
}
