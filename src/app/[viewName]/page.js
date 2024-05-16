"use client";
import dynamic from "next/dynamic";

const OutlineView = dynamic(() => import("../components/OutlineView").then((x) => x.OutlineView), {
  ssr: false,
});
const ThoughtstreamView = dynamic(() => import("../components/ThoughtstreamView").then((x) => x.ThoughtstreamView), {
  ssr: false,
});
const SplitView = dynamic(() => import("../components/SplitView").then((x) => x.SplitView), {
  ssr: false,
});

export default function Page({ params: { viewName, path } }) {
  if (viewName === "stream") {
    return <ThoughtstreamView></ThoughtstreamView>;
  } else if (viewName === "outline") {
    return <OutlineView></OutlineView>;
  } else if (viewName === "split") {
    return <SplitView></SplitView>;
  }
}
