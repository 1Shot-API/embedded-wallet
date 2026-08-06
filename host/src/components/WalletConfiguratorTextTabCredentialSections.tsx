import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BodyField, TextField } from "./configuratorFields";
import type { IWalletConfiguratorTextTabSectionProps } from "./walletConfiguratorTextTabTypes";

export function WalletConfiguratorTextTabCredentialSections({
  form,
  patch,
}: IWalletConfiguratorTextTabSectionProps) {
  return (
    <>
      <AccordionItem value="cred-offer">
        <AccordionTrigger>Credential offer</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="cred-offer-title"
            label="Title"
            value={form.credOfferTitle}
            onChange={(value) => patch("credOfferTitle", value)}
          />
          <BodyField
            id="cred-offer-body"
            label="Body"
            value={form.credOfferBody}
            onChange={(value) => patch("credOfferBody", value)}
          />
          <TextField
            id="cred-offer-accept"
            label="Accept"
            value={form.credOfferAccept}
            onChange={(value) => patch("credOfferAccept", value)}
          />
          <TextField
            id="cred-offer-reject"
            label="Reject"
            value={form.credOfferReject}
            onChange={(value) => patch("credOfferReject", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="cred-present">
        <AccordionTrigger>Credential presentation</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="cred-present-title"
            label="Title"
            value={form.credPresentTitle}
            onChange={(value) => patch("credPresentTitle", value)}
          />
          <BodyField
            id="cred-present-body"
            label="Body"
            value={form.credPresentBody}
            onChange={(value) => patch("credPresentBody", value)}
          />
          <TextField
            id="cred-present-share"
            label="Share"
            value={form.credPresentShare}
            onChange={(value) => patch("credPresentShare", value)}
          />
          <TextField
            id="cred-present-reject"
            label="Reject"
            value={form.credPresentReject}
            onChange={(value) => patch("credPresentReject", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="credentials">
        <AccordionTrigger>Credentials tab</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="cred-tab-label"
            label="Tab label"
            value={form.credTabLabel}
            onChange={(value) => patch("credTabLabel", value)}
          />
          <TextField
            id="cred-empty-count"
            label="Empty count"
            value={form.credEmptyCount}
            onChange={(value) => patch("credEmptyCount", value)}
          />
          <TextField
            id="cred-count-label"
            label="Count ({count})"
            value={form.credCountLabel}
            onChange={(value) => patch("credCountLabel", value)}
          />
          <BodyField
            id="cred-empty-body"
            label="Empty body"
            value={form.credEmptyBody}
            onChange={(value) => patch("credEmptyBody", value)}
          />
          <TextField
            id="cred-refresh"
            label="Refresh"
            value={form.credRefresh}
            onChange={(value) => patch("credRefresh", value)}
          />
          <TextField
            id="cred-view"
            label="View"
            value={form.credView}
            onChange={(value) => patch("credView", value)}
          />
          <BodyField
            id="cred-detail-description"
            label="Detail description"
            value={form.credDetailDescription}
            onChange={(value) => patch("credDetailDescription", value)}
          />
          <TextField
            id="cred-claims-heading"
            label="Claims heading"
            value={form.credClaimsHeading}
            onChange={(value) => patch("credClaimsHeading", value)}
          />
          <TextField
            id="cred-close"
            label="Close"
            value={form.credClose}
            onChange={(value) => patch("credClose", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="delegations">
        <AccordionTrigger>Delegations tab</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="del-tab-label"
            label="Tab label"
            value={form.delTabLabel}
            onChange={(value) => patch("delTabLabel", value)}
          />
          <TextField
            id="del-empty-count"
            label="Empty count"
            value={form.delEmptyCount}
            onChange={(value) => patch("delEmptyCount", value)}
          />
          <TextField
            id="del-count-label"
            label="Count ({count})"
            value={form.delCountLabel}
            onChange={(value) => patch("delCountLabel", value)}
          />
          <BodyField
            id="del-empty-body"
            label="Empty body"
            value={form.delEmptyBody}
            onChange={(value) => patch("delEmptyBody", value)}
          />
          <TextField
            id="del-refresh"
            label="Refresh"
            value={form.delRefresh}
            onChange={(value) => patch("delRefresh", value)}
          />
          <TextField
            id="del-cancel"
            label="Cancel"
            value={form.delCancel}
            onChange={(value) => patch("delCancel", value)}
          />
          <TextField
            id="del-no-memo"
            label="No memo"
            value={form.delNoMemo}
            onChange={(value) => patch("delNoMemo", value)}
          />
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
