export function FieldLabel({ children }: { children: string }) {
  return (
    <p className="text-muted-foreground mb-1 text-[0.8rem] font-medium">
      {children}
    </p>
  );
}
