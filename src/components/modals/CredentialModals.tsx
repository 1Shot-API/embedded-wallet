import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
  CredentialSummary,
} from "@1shotapi/ows-types";
import { useStyle } from "../../style";
import { Modal } from "../Modal";

export function CredentialOfferModal({
  request,
  onResolve,
}: {
  request: CredentialOfferApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  const { style } = useStyle();
  const { credentialOffer } = style.copy;

  return (
    <Modal
      title={credentialOffer.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: credentialOffer.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: credentialOffer.acceptLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="mb-3">
        {fillTemplate(credentialOffer.body, {
          issuerName: request.issuerName,
          issuerId: String(request.issuerId),
        })}
      </p>
      <p className="mb-1 font-semibold">{credentialOffer.offeredHeading}</p>
      <ul className="mb-3 list-disc pl-5">
        {request.offeredCredentials.map((credential) => {
          const scope = credential.scope ? ` — ${credential.scope}` : "";
          return (
            <li key={credential.configurationId}>
              {credential.configurationId} ({credential.format})
              {scope}
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground m-0 text-[0.9rem]">
        {credentialOffer.passkeyNote}
      </p>
    </Modal>
  );
}

export function CredentialPresentationModal({
  request,
  onResolve,
}: {
  request: CredentialPresentationApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  const { style } = useStyle();
  const { credentialPresentation } = style.copy;

  return (
    <Modal
      title={credentialPresentation.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: credentialPresentation.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: credentialPresentation.shareLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="mb-2">
        {fillTemplate(credentialPresentation.body, {
          verifierName: request.verifierName,
          verifierId: String(request.verifierId),
        })}
      </p>
      <p className="mb-3">
        {fillTemplate(credentialPresentation.credentialDetail, {
          credentialType: request.credentialType,
          credentialIssuer: String(request.credentialIssuer),
        })}
      </p>
      <p className="mb-1 font-semibold">
        {credentialPresentation.claimsHeading}
      </p>
      <ul className="mb-3 list-disc pl-5">
        {request.requestedClaims.map((claim) => (
          <li key={claim}>{claim}</li>
        ))}
      </ul>
      <p className="text-muted-foreground m-0 text-[0.9rem]">
        {credentialPresentation.passkeyNote}
      </p>
    </Modal>
  );
}

export function CredentialListModal({
  credentials,
  onResolve,
}: {
  credentials: CredentialSummary[];
  onResolve: () => void;
}) {
  const { style } = useStyle();
  const { credentialList } = style.copy;

  return (
    <Modal
      title={credentialList.title}
      wide
      onBackdropDismiss={onResolve}
      actions={[
        {
          label: credentialList.closeLabel,
          variant: "primary",
          autoFocus: true,
          onClick: onResolve,
        },
      ]}
    >
      {credentials.length === 0 ? (
        <p className="text-muted-foreground m-0">{credentialList.emptyBody}</p>
      ) : (
        <ul className="m-0 grid max-h-64 list-none gap-3 overflow-auto p-0">
          {credentials.map((credential) => (
            <li
              key={credential.credentialId}
              className="border-border bg-muted/40 rounded-md border p-3"
            >
              <p className="mb-1 font-semibold">
                {credential.type.join(", ")}
              </p>
              <p className="mb-1 text-[0.85rem]">
                {credentialList.issuerLabel} {credential.issuer}
              </p>
              <p className="text-muted-foreground m-0 font-mono text-xs">
                {credential.validUntil
                  ? `${credentialList.issuedLabel} ${credential.issuedAt} · ${credentialList.validUntilLabel} ${credential.validUntil}`
                  : `${credentialList.issuedLabel} ${credential.issuedAt}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Replace `{name}` tokens; unknown keys become empty strings. */
function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? "");
}
