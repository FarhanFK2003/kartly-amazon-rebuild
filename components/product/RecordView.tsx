"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/lib/store/recentlyViewed";

/** Records a PDP visit. Renders nothing. */
export function RecordView({ productId }: { productId: string }) {
  const record = useRecentlyViewed((s) => s.record);
  useEffect(() => {
    record(productId);
  }, [productId, record]);
  return null;
}
