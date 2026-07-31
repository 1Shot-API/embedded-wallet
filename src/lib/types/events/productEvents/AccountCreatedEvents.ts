import {
  DomainString,
  EVMAccountAddress,
  OWSAnalyticsEvent,
} from "@1shotapi/ows-types";
import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class AccountCreatedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
  ) {
    super(EAnalyticsEventName.AccountCreated, hostDomain);
  }
}

export class AccountCreateFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly errorCode: string,
  ) {
    super(EAnalyticsEventName.AccountCreateFailed, hostDomain);
  }
}

export class AccountCreateCancelledEvent extends OWSAnalyticsEvent {
  constructor(hostDomain: DomainString) {
    super(EAnalyticsEventName.AccountCreateCancelled, hostDomain);
  }
}
