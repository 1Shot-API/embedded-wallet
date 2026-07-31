import {
  DomainString,
  EVMAccountAddress,
  OWSAnalyticsEvent,
} from "@1shotapi/ows-types";
import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class PersonalSignEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly messageLength: number,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.PersonalSign, hostDomain);
  }
}

export class PersonalSignFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.PersonalSignFailed, hostDomain);
  }
}

export class PersonalSignCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.PersonalSignCancelled, hostDomain);
  }
}
