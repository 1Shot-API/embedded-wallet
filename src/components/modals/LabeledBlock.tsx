import { DetailBlock } from "./DetailBlock";
import { FieldLabel } from "./FieldLabel";

export function LabeledBlock({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  return (
    <div className="mb-3 min-w-0 last:mb-0">
      <FieldLabel>{label}</FieldLabel>
      <DetailBlock content={content} />
    </div>
  );
}
