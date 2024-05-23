"use client";
import { useViewController } from "@/app/controller/useViewController";
import { useGraphStore } from "@/app/store/useGraphStore";
import { relationsPathToParentChild } from "@/app/util";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const OutlineView = dynamic(() => import("../../components/OutlineView").then((x) => x.OutlineView), {
  ssr: false,
});
const ThoughtstreamView = dynamic(() => import("../../components/ThoughtstreamView").then((x) => x.ThoughtstreamView), {
  ssr: false,
});
const SplitView = dynamic(() => import("../../components/SplitView").then((x) => x.SplitView), {
  ssr: false,
});

export default function Page({ params: { viewName, path } }: { params: { viewName: string; path: string[] } }) {
  const viewController = useViewController();
  const graphStore = useGraphStore();
  const router = useRouter();

  useEffect(() => {
    // redirect to / if viewName is bad
    if (viewName !== "outline" && viewName !== "stream" && viewName !== "split") {
      router.push("/");
    }

    // split view does not have url support
    if (path && viewName === "split") {
      router.push("/split");
      return;
    }

    // if no path then reset the root
    if (!path || path.length === 0) {
      if (viewName === "outline") {
        viewController.setCurrentOutlineViewRoot([graphStore.outlineRootRelationFromUserRoot]);
      } else if (viewName === "stream") {
        viewController.setCurrentStreamViewRoot([graphStore.thoughtstreamRootRelationFromUserRoot]);
      }
      return;
    }

    // try to convert the URL relation ids to objects
    let relations = [];
    for (const id of path) {
      const graphRel = graphStore.relationsById.get(id);
      if (!graphRel) {
        router.push("/");
        return;
      }
      relations.push(graphRel);
    }

    // check that the path is contiguous
    try {
      relationsPathToParentChild(relations);
    } catch (e) {
      router.push("/");
      return;
    }

    // if the path is different from the outline/stream view root, update the latter
    if (
      viewName === "outline" &&
      (!viewController.currentOutlineViewRoot ||
        relations.length !== viewController.currentOutlineViewRoot!.length ||
        !relations.reduce((acc, nxt, idx) => acc && viewController.currentOutlineViewRoot![idx] === nxt, true))
    ) {
      viewController.setCurrentOutlineViewRoot(relations);
    } else if (
      viewName === "stream" &&
      (!viewController.currentStreamViewRoot ||
        relations.length !== viewController.currentStreamViewRoot!.length ||
        !relations.reduce((acc, nxt, idx) => acc && viewController.currentStreamViewRoot![idx] === nxt, true))
    ) {
      viewController.setCurrentStreamViewRoot(relations);
    }
  }, [graphStore, path, router, viewController, viewName]);

  if (viewName === "stream") {
    return <ThoughtstreamView></ThoughtstreamView>;
  } else if (viewName === "outline") {
    return <OutlineView></OutlineView>;
  } else if (viewName === "split") {
    return <SplitView></SplitView>;
  }
}
