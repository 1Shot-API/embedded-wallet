import type { OWSAnalyticsEvent } from "@1shotapi/ows-types";

export {
  AccountCreatedEvent,
  AccountCreateCancelledEvent,
  AccountCreateFailedEvent,
} from "./AccountCreatedEvents";
export {
  PersonalSignCancelledEvent,
  PersonalSignEvent,
  PersonalSignFailedEvent,
} from "./PersonalSignEvents";
export {
  TypedSignCancelledEvent,
  TypedSignEvent,
  TypedSignFailedEvent,
} from "./TypedSignEvents";
export {
  TransactionSubmitCancelledEvent,
  TransactionSubmittedEvent,
  TransactionSubmitFailedEvent,
} from "./TransactionEvents";
export {
  CredentialIssueCancelledEvent,
  CredentialIssuedEvent,
  CredentialIssueFailedEvent,
  CredentialPresentCancelledEvent,
  CredentialPresentedEvent,
  CredentialPresentFailedEvent,
} from "./CredentialEvents";
export {
  DelegationCancelAbortedEvent,
  DelegationCancelledEvent,
  DelegationCancelFailedEvent,
  DelegationCreateCancelledEvent,
  DelegationCreatedEvent,
  DelegationCreateFailedEvent,
} from "./DelegationEvents";

/** Any branding analytics event published on the EventBus analytics channel. */
export type WalletAnalyticsEvent = OWSAnalyticsEvent;
