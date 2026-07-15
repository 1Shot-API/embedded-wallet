import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export interface IColorPickerFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Hex color field with a Popover + react-colorful canvas
 * (shadcn.io color-picker alternative for our host ShadCN setup).
 */
export function ColorPickerField({
  id,
  label,
  value,
  onChange,
}: IColorPickerFieldProps) {
  const hex = normalizeHex(value) ?? "#000000";

  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-1 max-sm:grid-cols-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 overflow-hidden p-0"
              aria-label={`Pick ${label}`}
            >
              <span
                className="size-full"
                style={{ backgroundColor: value || hex }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <HexColorPicker
              color={hex}
              onChange={(next) => {
                onChange(next);
              }}
            />
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          value={value}
          spellCheck={false}
          className="font-mono text-[0.85rem]"
          placeholder="#000000"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
