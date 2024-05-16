"use client";

import dynamic from "next/dynamic";

const OutlineView = dynamic(() => import("./components/OutlineView").then((x) => x.OutlineView), {
  ssr: false,
});

export default function Page() {
  return <OutlineView />;
}
