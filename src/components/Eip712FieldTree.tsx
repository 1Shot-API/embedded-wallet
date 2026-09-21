import type { ReactNode } from "react";
import {
  formatEip712Primitive,
  humanizeEip712Key,
  isEip712NestedValue,
  isEvmAddressString,
} from "../lib/utils/eip712Display";
import { truncateAddress } from "../lib/utils/identityDisplay";

const MAX_DEPTH = 12;

export type IEip712FieldTreeProps = {
  value: unknown;
  depth?: number;
  label?: string;
};

/** Renders a resolved EIP-712 `message` as nested label / value rows. */
export function Eip712FieldTree({
  value,
  depth = 0,
  label,
}: IEip712FieldTreeProps) {
  if (depth > MAX_DEPTH) {
    return (
      <Eip712PrimitiveRow
        label={label ?? "Value"}
        value={formatEip712Primitive(value)}
      />
    );
  }

  if (Array.isArray(value)) {
    return (
      <Eip712Group label={label}>
        {value.map((item, index) => (
          <Eip712FieldTree
            key={String(index)}
            value={item}
            depth={depth + 1}
            label={String(index)}
          />
        ))}
      </Eip712Group>
    );
  }

  if (isEip712NestedValue(value)) {
    return (
      <Eip712Group label={label}>
        {Object.keys(value as Record<string, unknown>).map((key) => (
          <Eip712FieldTree
            key={key}
            value={(value as Record<string, unknown>)[key]}
            depth={depth + 1}
            label={humanizeEip712Key(key)}
          />
        ))}
      </Eip712Group>
    );
  }

  return (
    <Eip712PrimitiveRow
      label={label ?? "Value"}
      value={formatEip712Primitive(value)}
    />
  );
}

function Eip712Group({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  if (!label) {
    return <div className="flex flex-col">{children}</div>;
  }
  return (
    <div className="py-1 first:pt-0 last:pb-0">
      <p className="text-foreground m-0 text-xs font-semibold">{label}</p>
      <div className="border-border mt-1 flex flex-col border-l pl-3">
        {children}
      </div>
    </div>
  );
}

function Eip712PrimitiveRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value) {
    return null;
  }
  const isAddress = isEvmAddressString(value);
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-right text-sm ${isAddress ? "font-mono" : ""}`}
        title={value}
      >
        {isAddress ? truncateAddress(value) : value}
      </span>
    </div>
  );
}
