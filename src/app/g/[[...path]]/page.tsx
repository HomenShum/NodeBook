"use client";
import { observer } from "mobx-react-lite";
import { useContext, useEffect, useRef } from "react";

import { MainView } from "@/app/components/MainView";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useLoading, useSetLoading } from "@/app/contexts/LoadingContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { parsePathArray } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";

function Page({ params: { path: pathArray } }: { params: { path: string[] | undefined } }) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();
  const isLoading = useLoading();
  const setIsLoading = useSetLoading();
  const hasProcessedPath = useRef(false);
  const isFromAuth0Redirect = useRef(false);

  // Check if we're coming from an Auth0 redirect immediately when component mounts
  const urlParams = new URLSearchParams(window.location.search);
  const hasAuth0Params = urlParams.has("code") || urlParams.has("state");
  isFromAuth0Redirect.current = hasAuth0Params;

  useEffect(() => {
    // If we're coming from Auth0 redirect, wait longer for stores to be fully ready
    if (isFromAuth0Redirect.current && !hasProcessedPath.current) {
      // Give Auth0 redirect callback more time to process
      const timer = setTimeout(() => {
        logger.debug("Processing path after Auth0 redirect delay", { pathArray });
        hasProcessedPath.current = true;
        processPath();
      }, 1000); // Increased delay to allow sync effect to run first
      return () => clearTimeout(timer);
    }

    if (!hasProcessedPath.current) {
      logger.debug("Processing path normally", { pathArray });
      hasProcessedPath.current = true;
      processPath();
    }
  }, [viewStore, graphStore, setRoot, isLoading]);

  // Sync root node with URL after login/redirect, waiting for node data
  useEffect(() => {
    if (typeof window === "undefined") return; // Only run on client
    if (!pathArray || pathArray.length === 0) return;
    if (!viewStore || !graphStore) return;
    if (isLoading) return;

    const nodeIdFromUrl = pathArray[pathArray.length - 1];
    if (!nodeIdFromUrl) return;

    const currentRootId = viewStore?.mainView?.root?.object?.id;
    const node = graphStore.getNode(nodeIdFromUrl);

    if (!node) {
      graphStore.layerManager.loadCanonicalWithIds([nodeIdFromUrl]);
      graphStore.layerManager.loadWithIds([nodeIdFromUrl]);
      return;
    }

    if (nodeIdFromUrl !== currentRootId) {
      setRoot(node);
    }
  }, [pathArray, viewStore, graphStore, setRoot, isLoading]);

  // Additional effect to re-run when nodes are loaded
  useEffect(() => {
    if (typeof window === "undefined") return; // Only run on client
    if (!pathArray || pathArray.length === 0) return;
    if (!viewStore || !graphStore) return;
    if (isLoading) return;

    const nodeIdFromUrl = pathArray[pathArray.length - 1];
    if (!nodeIdFromUrl) return;

    const currentRootId = viewStore?.mainView?.root?.object?.id;
    const node = graphStore.getNode(nodeIdFromUrl);

    // Only set root if node exists and is different from current root
    if (node && nodeIdFromUrl !== currentRootId) {
      setRoot(node);
    }
  }, [pathArray, viewStore, graphStore, setRoot, isLoading, graphStore.nodesById]);

  const processPath = () => {
    logger.debug("Processing path", { pathArray, isFromAuth0Redirect: isFromAuth0Redirect.current });
    const currentPath = window.location.pathname;
    const path = parsePathArray(currentPath.split("/").slice(2), graphStore);
    const lastId = currentPath.split("/").slice(-1)[0];
    graphStore.layerManager.loadWithIds([lastId]).then(() => {
      const object = graphStore.getNode(lastId);
      if (object) {
        logger.debug("Found object, setting root", { objectId: object.id });
        setRoot(object);
      } else {
        // Only redirect to default root if we're not coming from Auth0 redirect AND the path is empty or just /g
        const isAtRootOrEmpty = currentPath === "/" || currentPath === "/g" || currentPath === "";

        if (!isFromAuth0Redirect.current && isAtRootOrEmpty) {
          logger.debug("Could not find object and at root/empty path, redirecting to home", pathArray);
          setRoot(graphStore.getDefaultRootForUser());
        } else {
          logger.debug("Could not find object but staying on current path", {
            pathArray,
            currentPath,
            isFromAuth0Redirect: isFromAuth0Redirect.current,
            isAtRootOrEmpty,
          });
        }
      }
      setIsLoading(false);
    });
    // // If the path is valid, keep the path, and update our view state to match
    // // Otherwise, we redirect to the specified object or the default root
    if (path) {
      logger.debug("Path is valid, setting root", { path: path.objectPath });
      viewStore.setRoot(path.objectPath);
      if (path.objectPath.object.id) {
        graphStore.layerManager.loadCanonicalWithIds([path.objectPath.object.id]);
        graphStore.layerManager.loadWithIds([path.objectPath.object.id]);
      }
    } else {
      logger.debug("Path is not valid, trying to load object", { lastId });

      const object = graphStore.getNode(lastId);
      if (object) {
        logger.debug("Found object, setting root", { objectId: object.id });
        setRoot(object);
      } else {
        // Only redirect to default root if we're not coming from Auth0 redirect AND the path is empty or just /g
        const isAtRootOrEmpty = currentPath === "/" || currentPath === "/g" || currentPath === "";

        if (!isFromAuth0Redirect.current && isAtRootOrEmpty) {
          logger.debug("Could not find object and at root/empty path, redirecting to home", pathArray);
          setRoot(graphStore.getDefaultRootForUser());
        } else {
          logger.debug("Could not find object but staying on current path", {
            pathArray,
            currentPath,
            isFromAuth0Redirect: isFromAuth0Redirect.current,
            isAtRootOrEmpty,
          });
        }
      }
    }
    // We only want to set root in the view store to match the path on initial load. Once the
    // app is loaded, the app is responsible for updating both the view store and the url.
    // To match that, we only run this effect when viewStore or graphStore are instantiated
    // and specifically exclude path as a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  return <MainView tree={viewStore.mainView}></MainView>;
}

export default observer(Page);
