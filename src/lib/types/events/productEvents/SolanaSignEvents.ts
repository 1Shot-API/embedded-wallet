import {
  type DomainString,
  OWSAnalyticsEvent,
  type SolanaAccountAddress,
  type SolanaChainId,
  type SolanaTransactionSignature,
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

export class SolanaSignTransactionEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly chainId: SolanaChainId,
    public readonly transactionCount: number,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignTransaction, hostDomain);
  }
}

export class SolanaSignTransactionFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly chainId: SolanaChainId,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignTransactionFailed, hostDomain);
  }
}

export class SolanaSignTransactionCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly chainId: SolanaChainId,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignTransactionCancelled, hostDomain);
  }
}

export class SolanaSignAndSendEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly chainId: SolanaChainId,
    public readonly signature: SolanaTransactionSignature,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignAndSend, hostDomain);
  }
}

export class SolanaSignAndSendFailedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly chainId: SolanaChainId,
    public readonly errorCode: string,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignAndSendFailed, hostDomain);
  }
}

export class SolanaSignAndSendCancelledEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: SolanaAccountAddress,
    public readonly chainId: SolanaChainId,
    public readonly durationMs: number,
  ) {
    super(EAnalyticsEventName.SolanaSignAndSendCancelled, hostDomain);
  }
}
