/**
 * Branding-owned analytics event names on the OWS `ows:analytics` wire and
 * first-party relayer ingest. Hosts narrow on `event.name`.
 */
export enum EAnalyticsEventName {
  AccountCreated = "AccountCreated",
  AccountCreateFailed = "AccountCreateFailed",
  AccountCreateCancelled = "AccountCreateCancelled",

  PersonalSign = "PersonalSign",
  PersonalSignFailed = "PersonalSignFailed",
  PersonalSignCancelled = "PersonalSignCancelled",

  TypedSign = "TypedSign",
  TypedSignFailed = "TypedSignFailed",
  TypedSignCancelled = "TypedSignCancelled",

  TransactionSubmitted = "TransactionSubmitted",
  TransactionSubmitFailed = "TransactionSubmitFailed",
  TransactionSubmitCancelled = "TransactionSubmitCancelled",

  CredentialIssued = "CredentialIssued",
  CredentialIssueFailed = "CredentialIssueFailed",
  CredentialIssueCancelled = "CredentialIssueCancelled",

  CredentialPresented = "CredentialPresented",
  CredentialPresentFailed = "CredentialPresentFailed",
  CredentialPresentCancelled = "CredentialPresentCancelled",

  DelegationCreated = "DelegationCreated",
  DelegationCreateFailed = "DelegationCreateFailed",
  DelegationCreateCancelled = "DelegationCreateCancelled",

  DelegationCancelled = "DelegationCancelled",
  DelegationCancelFailed = "DelegationCancelFailed",
  DelegationCancelAborted = "DelegationCancelAborted",
}
