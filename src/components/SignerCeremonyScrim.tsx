import { useWalletSessionStore } from "../wallet/sessionStore";

/** Dims branding content while the signing-layer ceremony strip is open. */
export function SignerCeremonyScrim() {
  const open = useWalletSessionStore((state) => state.signerCeremonyOpen);
  if (!open) {
    return null;
  }
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[10000] bg-black/20"
      aria-hidden
    />
  );
}
