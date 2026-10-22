/** Uppercase section label used in SIWE / SIWS consent cards. */
export function SignInSectionLabel({ children }: { children: string }) {
  return (
    <span className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
      {children}
    </span>
  );
}
