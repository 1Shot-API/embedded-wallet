import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TrackedAsset } from "../../lib/types/domain";
import { useStyle } from "../../style/StyleProvider";
import { AddAssetView } from "./AddAssetView";
import { AssetList } from "./AssetList";

export interface IBalancesTabProps {
  onView: (asset: TrackedAsset) => void;
}

export function BalancesTab({ onView }: IBalancesTabProps) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <AssetList onView={onView} />

      <Button
        type="button"
        size="sm"
        className="self-center"
        onClick={() => setAddOpen(true)}
      >
        {copy.addLabel}
      </Button>

      {addOpen ? <AddAssetView onClose={() => setAddOpen(false)} /> : null}
    </div>
  );
}
