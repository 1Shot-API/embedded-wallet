import { SignInSectionLabel } from "./SignInSectionLabel";

/** Key/value row for SIWE / SIWS metadata grids. */
export function SignInMetadataRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "min-w-0" : "mt-3 first:mt-0"}>
      <SignInSectionLabel>{label}</SignInSectionLabel>
      <p className="text-foreground m-0 break-all text-sm leading-snug">
        {value}
      </p>
    </div>
  );
}
