import {
  type DomainString,
  OWSAnalyticsEvent,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";

import { EAnalyticsEventName } from "../../enum/EAnalyticsEventName";

export class SolanaSignMessageEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly messageCount: number,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignMessage, hostDomain);
  }
}

export class SolanaSignMessageFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignMessageFailed, hostDomain);
  }
}

export class SolanaSignMessageCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignMessageCancelled, hostDomain);
  }
}

export class SolanaSignInEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly domain: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignIn, hostDomain);
  }
}

export class SolanaSignInFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignInFailed, hostDomain);
  }
}

export class SolanaSignInCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignInCancelled, hostDomain);
  }
}
