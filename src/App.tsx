import { Button } from "@/components/ui/button";

export function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">1Shot Wallet</h1>
      <p className="text-muted-foreground max-w-sm text-center text-sm">
        Branding Layer bootstrapping — OWS wiring comes next.
      </p>
      <Button type="button">Get started</Button>
    </div>
  );
}
