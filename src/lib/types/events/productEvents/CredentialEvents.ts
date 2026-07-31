import { DomainString, OWSAnalyticsEvent } from "@1shotapi/ows-types";
import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class CredentialIssuedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly issuerOrigin: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.CredentialIssued, hostDomain);
  }
}

export class CredentialIssueFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly errorCode: string,
    public readonly durationMs: number,
    public readonly issuerOrigin: string | null = null,
  ) {
    super(EAnalyticsEventName.CredentialIssueFailed, hostDomain);
  }
}

export class CredentialIssueCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly durationMs: number,
    public readonly issuerOrigin: string | null = null,
  ) {
    super(EAnalyticsEventName.CredentialIssueCancelled, hostDomain);
  }
}

export class CredentialPresentedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly verifierOrigin: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.CredentialPresented, hostDomain);
  }
}

export class CredentialPresentFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly errorCode: string,
    public readonly durationMs: number,
    public readonly verifierOrigin: string | null = null,
  ) {
    super(EAnalyticsEventName.CredentialPresentFailed, hostDomain);
  }
}

export class CredentialPresentCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly durationMs: number,
    public readonly verifierOrigin: string | null = null,
  ) {
    super(EAnalyticsEventName.CredentialPresentCancelled, hostDomain);
  }
}
