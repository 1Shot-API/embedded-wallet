import {
  DomainString,
  EVMAccountAddress,
  OWSAnalyticsEvent,
  type EVMChainId,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class DelegationCreatedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.DelegationCreated, hostDomain);
  }
}

export class DelegationCreateFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.DelegationCreateFailed, hostDomain);
  }
}

export class DelegationCreateCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.DelegationCreateCancelled, hostDomain);
  }
}

export class DelegationCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly txHash: EVMTransactionHash,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.DelegationCancelled, hostDomain);
  }
}

export class DelegationCancelFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.DelegationCancelFailed, hostDomain);
  }
}

export class DelegationCancelAbortedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly chainId: EVMChainId,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.DelegationCancelAborted, hostDomain);
  }
}
