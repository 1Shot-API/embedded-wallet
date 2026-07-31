import {
  DomainString,
  EVMAccountAddress,
  OWSAnalyticsEvent,
} from "@1shotapi/ows-types";
import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class TypedSignEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly primaryType: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.TypedSign, hostDomain);
  }
}

export class TypedSignFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.TypedSignFailed, hostDomain);
  }
}

export class TypedSignCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.TypedSignCancelled, hostDomain);
  }
}
