import { useEffect, useId, useState } from "react";
import { ScanLineIcon } from "lucide-react";
import { AddressUtils } from "@1shotapi/ows-wallet-utils";
import {
  EChainTechnology,
  type BitcoinAccountAddress,
  type EVMAccountAddress,
  type EVMChainId,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BarcodeDetectorLike = {
  detect: (
    source: ImageBitmapSource,
  ) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[];
    }) => BarcodeDetectorLike;
  }
}

export type AddressInputValue =
  | EVMAccountAddress
  | SolanaAccountAddress
  | BitcoinAccountAddress
  | null;

export interface IAddressInputProps<T extends EChainTechnology> {
  technology: T;
  chainId: EVMChainId;
  addressUtils: AddressUtils;
  value: string;
  onChange: (value: string) => void;
  onValidated: (address: AddressInputValue) => void;
  label: string;
  placeholder?: string;
  scanQrLabel?: string;
  invalidAddressError: string;
  disabled?: boolean;
  className?: string;
}

async function cameraPermissionGranted(): Promise<boolean> {
  try {
    if (!navigator.permissions?.query) {
      return false;
    }
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return status.state === "granted";
  } catch {
    return false;
  }
}

/**
 * Address field with ENS/Base58/Bitcoin validation via AddressUtils.
 * QR scan is shown only when camera permission is already granted.
 */
export function AddressInput<T extends EChainTechnology>({
  technology,
  chainId,
  addressUtils,
  value,
  onChange,
  onValidated,
  label,
  placeholder,
  scanQrLabel = "Scan QR",
  invalidAddressError,
  disabled,
  className,
}: IAddressInputProps<T>) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [canScan, setCanScan] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void cameraPermissionGranted().then((granted) => {
      if (!cancelled) {
        setCanScan(
          granted &&
            typeof window !== "undefined" &&
            typeof window.BarcodeDetector === "function",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const trimmed = value.trim();
    if (!trimmed) {
      setError(null);
      onValidated(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          let address: AddressInputValue = null;
          switch (technology) {
            case EChainTechnology.Evm:
              address = await addressUtils.validateEVMAddress(trimmed, chainId);
              break;
            case EChainTechnology.Solana:
              address = addressUtils.validateSolanaAddress(trimmed);
              break;
            case EChainTechnology.Bitcoin:
              address = addressUtils.validateBitcoinAddress(trimmed);
              break;
          }
          if (!cancelled) {
            setError(null);
            onValidated(address);
          }
        } catch {
          if (!cancelled) {
            setError(invalidAddressError);
            onValidated(null);
          }
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    addressUtils,
    chainId,
    invalidAddressError,
    onValidated,
    technology,
    value,
  ]);

  async function scanQr(): Promise<void> {
    if (!window.BarcodeDetector) {
      return;
    }
    setScanning(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();
      const detector = new window.BarcodeDetector({
        formats: ["qr_code"],
      });
      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        const codes = await detector.detect(video);
        const raw = codes[0]?.rawValue?.trim();
        if (raw) {
          onChange(raw.replace(/^ethereum:/i, "").split("@")[0] ?? raw);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch {
      // Permission revoked or scan cancelled — leave field unchanged.
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setScanning(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-muted-foreground text-xs font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || scanning}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 font-mono text-sm"
        />
        {canScan ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled || scanning}
            aria-label={scanQrLabel}
            onClick={() => void scanQr()}
          >
            <ScanLineIcon className="size-4" />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
