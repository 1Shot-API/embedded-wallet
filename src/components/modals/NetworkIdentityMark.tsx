import { SafeAssetImage } from "../SafeAssetImage";

export function NetworkIdentityMark({
  label,
  logoUrl,
  size = "md",
}: {
  label: string;
  logoUrl?: string;
  size?: "sm" | "md";
}) {
  const letter = (label.trim()[0] ?? "?").toUpperCase();
  const box = size === "sm" ? "size-12" : "size-16";
  const text = size === "sm" ? "text-xl" : "text-2xl";
  return (
    <div className={`relative shrink-0 ${box}`} aria-hidden>
      <SafeAssetImage
        src={logoUrl}
        className={`${box} rounded-full object-cover`}
        fallback={
          <div
            className={`bg-muted text-foreground flex ${box} items-center justify-center rounded-full font-semibold ${text}`}
          >
            {letter}
          </div>
        }
      />
    </div>
  );
}
