"use client";
import { ThoughtstreamView } from "@/app/components/ThoughtstreamView";
import { useViewStore } from "@/app/view/useViewStore";

export default function Page() {
  const viewStore = useViewStore();
  return <ThoughtstreamView tree={viewStore.mainOutlineView}></ThoughtstreamView>;
}
