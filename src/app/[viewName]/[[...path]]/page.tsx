"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";

import { DataLoadContext } from "@/app/DataLoadContext";
import { GraphStore } from "@/app/graph/GraphStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import styles from "@/app/page.module.css";
import { relationsPathToParentChild } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";

const OutlineView = dynamic(() => import("@/app/components/OutlineView").then((x) => x.OutlineView), {
  ssr: false,
});
const ThoughtstreamView = dynamic(() => import("@/app/components/ThoughtstreamView").then((x) => x.ThoughtstreamView), {
  ssr: false,
});
const SplitView = dynamic(() => import("@/app/components/SplitView").then((x) => x.SplitView), {
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
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const router = useRouter();
  const hasLoaded = useContext(DataLoadContext);

  useEffect(() => {
    if (!hasLoaded) return;

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
        viewStore.mainOutlineView.setRoot([graphStore.outlineRootRelationFromUserRoot]);
        viewStore.mainStreamView.setRoot([graphStore.thoughtstreamRootRelationFromUserRoot]);
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
        viewStore.mainOutlineView.setRoot([graphStore.outlineRootRelationFromUserRoot]);
        return;
      }
      newOutlineRoot = pathToRelationList(path, graphStore);
      if (!newOutlineRoot) {
        router.push("/");
        return;
      }
    } else if (viewName === "stream") {
      if (!path || path.length === 0) {
        viewStore.mainStreamView.setRoot([graphStore.thoughtstreamRootRelationFromUserRoot]);
        return;
      }
      newStreamRoot = pathToRelationList(path, graphStore);
      if (!newStreamRoot) {
        router.push("/stream/");
        return;
      }
    }

    // if the path is different from the outline/stream view root, update the latter
    if (newOutlineRoot && !arrayEqual(viewStore.mainOutlineView.pathToRoot, newOutlineRoot)) {
      viewStore.mainOutlineView.setRoot(newOutlineRoot);
    }

    if (newStreamRoot && !arrayEqual(viewStore.mainStreamView.pathToRoot, newStreamRoot)) {
      viewStore.mainStreamView.setRoot(newStreamRoot);
    }
  }, [graphStore, hasLoaded, path, router, viewName, viewStore]);

  if (!hasLoaded)
    return (
      <div className={styles.LoaderContainer}>
        <span className={styles.Loader}></span> Loading
      </div>
    );

  if (viewName === "stream") {
    return <ThoughtstreamView tree={viewStore.mainStreamView}></ThoughtstreamView>;
  } else if (viewName === "outline") {
    return <OutlineView tree={viewStore.mainOutlineView}></OutlineView>;
  } else if (viewName === "split") {
    return <SplitView></SplitView>;
  }
}
