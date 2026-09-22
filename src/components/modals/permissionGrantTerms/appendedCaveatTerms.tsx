import type { IAppendedCaveatConfiguration } from "@1shotapi/ows-types";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  CAVEAT_DISPLAY_NAME,
  resolveAppendedCaveatRows,
} from "./appendedCaveatUtils";

export {
  isAppendedCaveatValid,
  resolveAppendedCaveatRows,
  type IAppendedCaveatRow,
} from "./appendedCaveatUtils";

/**
 * Render one appended caveat as a `PermissionGrantTermsCard` with resolved
 * `ConsentSummaryRow`s for each config parameter.
 *
 * The card's `kindLabel` is the caveat's display name (e.g. "Pinned Calldata").
 * Falls back to the themeable `appendedCaveatKindLabel` copy key when the type
 * is unrecognized (defensive — unknown types are normally rejected upstream).
 */
export function AppendedCaveatTerms({
  caveat,
}: {
  caveat: IAppendedCaveatConfiguration;
}) {
  const fallbackKindLabel =
    useStyle().style.copy.grantExecutionPermission.appendedCaveatKindLabel ??
    "Additional Restriction";
  const kindLabel = CAVEAT_DISPLAY_NAME[caveat.type] ?? fallbackKindLabel;
  const rows = resolveAppendedCaveatRows(caveat);

  return (
    <PermissionGrantTermsCard kindLabel={kindLabel}>
      {rows.map((row) => (
        <ConsentSummaryRow key={row.label} label={row.label}>
          <span className="truncate text-sm font-medium" title={row.value}>
            {row.value}
          </span>
        </ConsentSummaryRow>
      ))}
    </PermissionGrantTermsCard>
  );
}
