import {
  EClearSigningDisplayKind,
  type IClearSigningDisplayField,
} from "@1shotapi/ows-clear-signing";
import type { EVMChainId } from "@1shotapi/ows-types";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { IClearSigningPresentation } from "../../lib/types/domain/ClearSigningPresentation";
import { truncateAddress } from "../../lib/utils/identityDisplay";
import { resolveAssetIconUrl } from "../../lib/utils/tokenIcons";
import { useStyle } from "../../style/StyleProvider";
import { CopyableText } from "../CopyableText";
import { SafeAssetImage } from "../SafeAssetImage";

/** Label / value pair rendered after the descriptor's own fields (e.g. attached native value). */
export interface IClearSigningExtraRow {
  label: string;
  value: string;
}

/**
 * ERC-7730 rendering shared by the transaction and typed-data consent modals (which use
 * `display.intent` as their title): interpolated intent sentence, contract / owner, one row per
 * descriptor field (optional ones collapsed), provenance footer.
 */
export function ClearSigningDetails({
  presentation,
  chainId,
  extraRows = [],
}: {
  presentation: IClearSigningPresentation;
  chainId: EVMChainId | null;
  extraRows?: IClearSigningExtraRow[];
}) {
  const { style } = useStyle();
  const copy = style.copy.clearSigning;
  const { display } = presentation;
  const sentence = display.interpolatedIntent;
  const subtitle = [display.contractName, display.owner]
    .filter((part, index, parts): part is string =>
      Boolean(part) && parts.indexOf(part) === index,
    )
    .join(" · ");
  const primary = display.fields.filter((field) => !field.optional);
  const optional = display.fields.filter((field) => field.optional);

  return (
    <div className="border-border rounded-md border px-3 py-2.5">
      {sentence ? (
        <p className="text-foreground m-0 mb-1 text-sm leading-snug font-medium text-pretty">
          {sentence}
        </p>
      ) : null}
      {subtitle ? (
        <p className="text-muted-foreground m-0 truncate text-xs">{subtitle}</p>
      ) : null}

      {primary.length > 0 || extraRows.length > 0 ? (
        <dl
          className={
            sentence || subtitle
              ? "m-0 mt-3 flex flex-col gap-2.5"
              : "m-0 flex flex-col gap-2.5"
          }
        >
          {primary.map((field, index) => (
            <FieldRow
              key={`${field.label}-${index}`}
              field={field}
              chainId={chainId}
            />
          ))}
          {extraRows.map((row) => (
            <Row key={row.label} label={row.label}>
              <span className="text-sm font-medium">{row.value}</span>
            </Row>
          ))}
        </dl>
      ) : null}

      {optional.length > 0 ? (
        <details className="group mt-3">
          <summary className="text-muted-foreground cursor-pointer text-xs font-medium select-none">
            {copy.moreDetailsLabel}
          </summary>
          <dl className="m-0 mt-2.5 flex flex-col gap-2.5">
            {optional.map((field, index) => (
              <FieldRow
                key={`${field.label}-${index}`}
                field={field}
                chainId={chainId}
              />
            ))}
          </dl>
        </details>
      ) : null}

      <p
        className="text-muted-foreground m-0 mt-3 text-[0.7rem]"
        title={`${presentation.path} @ ${String(presentation.registrySha).slice(0, 7)}`}
      >
        {copy.provenanceText}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground shrink-0 pt-0.5 text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="m-0 flex min-w-0 flex-col items-end gap-0.5 text-right">
        {children}
      </dd>
    </div>
  );
}

function FieldRow({
  field,
  chainId,
}: {
  field: IClearSigningDisplayField;
  chainId: EVMChainId | null;
}) {
  return (
    <Row label={field.label}>
      <FieldValue field={field} chainId={chainId} />
      {field.warning ? (
        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlertIcon className="size-3 shrink-0" aria-hidden />
          {field.warning}
        </span>
      ) : null}
    </Row>
  );
}

function FieldValue({
  field,
  chainId,
}: {
  field: IClearSigningDisplayField;
  chainId: EVMChainId | null;
}) {
  if (field.kind === EClearSigningDisplayKind.TokenAmount) {
    const iconUrl =
      chainId && field.tokenAddress
        ? resolveAssetIconUrl(chainId, field.tokenAddress)
        : undefined;
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
        {iconUrl ? (
          <SafeAssetImage
            src={iconUrl}
            className="size-4 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <span className="break-words">{field.value}</span>
      </span>
    );
  }

  if (field.address) {
    const address = String(field.address);
    // Unnamed address: copyable, middle-truncated. Named ("You", a token name): name, address on hover.
    if (field.value.toLowerCase() === address.toLowerCase()) {
      return (
        <CopyableText
          text={address}
          truncate
          className="max-w-[14rem] font-mono text-sm"
        />
      );
    }
    return (
      <span className="text-sm font-medium" title={address}>
        {field.value}{" "}
        <span className="text-muted-foreground font-mono text-xs">
          {truncateAddress(address)}
        </span>
      </span>
    );
  }

  return (
    <span className="text-sm font-medium break-words whitespace-pre-wrap">
      {field.value}
    </span>
  );
}
