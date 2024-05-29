"use client";
import { useViewController } from "@/app/controller/useViewController";
import { GraphStore } from "@/app/model/GraphStore";
import { useGraphStore } from "@/app/model/useGraphStore";
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

function pathToRelationList(path: string[], graphStore: GraphStore) {
  let relations = [];
  for (const id of path) {
    const graphRel = graphStore.relationsById.get(id);
    if (!graphRel) {
      return null;
    }
    relations.push(graphRel);
  }

  // check that the path is contiguous
  try {
    relationsPathToParentChild(relations);
  } catch (e) {
    return null;
  }

  return relations;
}

function arrayEqual<T>(a: T[], b: T[]) {
  if (a.length !== b.length) return false;

  return a.reduce((acc, nxt, idx) => acc && b[idx] === nxt, true);
}

export default function Page({ params: { viewName, path } }: { params: { viewName: string; path: string[] } }) {
  const viewController = useViewController();
  const graphStore = useGraphStore();
  const router = useRouter();

  useEffect(() => {
    // redirect to / if viewName is bad
    if (viewName !== "outline" && viewName !== "stream" && viewName !== "split") {
      router.push("/");
      return;
    }

    let newOutlineRoot;
    let newStreamRoot;

    if (viewName === "split") {
      // split view URL is structured as /split/outline/.../stream/...
      if (!path || path.length === 0) {
        viewController.setCurrentOutlineViewRoot([graphStore.outlineRootRelationFromUserRoot]);
        viewController.setCurrentStreamViewRoot([graphStore.thoughtstreamRootRelationFromUserRoot]);
        return;
      }

      const separator = path.indexOf("stream");
      if (separator < 0) {
        router.push("/split/");
        return;
      }
      const outlinePath = path.slice(1, separator);
      const streamPath = path.slice(separator + 1);

      newOutlineRoot = pathToRelationList(outlinePath, graphStore);
      newStreamRoot = pathToRelationList(streamPath, graphStore);
      if (!newStreamRoot || !newOutlineRoot) {
        router.push("/split/");
        return;
      }
    } else if (viewName === "outline") {
      if (!path || path.length === 0) {
        viewController.setCurrentOutlineViewRoot([graphStore.outlineRootRelationFromUserRoot]);
        return;
      }
      newOutlineRoot = pathToRelationList(path, graphStore);
      if (!newOutlineRoot) {
        router.push("/");
        return;
      }
    } else if (viewName === "stream") {
      if (!path || path.length === 0) {
        viewController.setCurrentStreamViewRoot([graphStore.thoughtstreamRootRelationFromUserRoot]);
        return;
      }
      newStreamRoot = pathToRelationList(path, graphStore);
      if (!newStreamRoot) {
        router.push("/stream/");
        return;
      }
    }

    // if the path is different from the outline/stream view root, update the latter
    if (
      newOutlineRoot &&
      (!viewController.currentOutlineViewRoot || !arrayEqual(viewController.currentOutlineViewRoot, newOutlineRoot))
    ) {
      viewController.setCurrentOutlineViewRoot(newOutlineRoot);
    }

    if (
      newStreamRoot &&
      (!viewController.currentStreamViewRoot || !arrayEqual(viewController.currentStreamViewRoot, newStreamRoot))
    ) {
      viewController.setCurrentStreamViewRoot(newStreamRoot);
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
