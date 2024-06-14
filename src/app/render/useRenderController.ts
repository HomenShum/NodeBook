"use client";
import { createContext, useContext } from "react";

import { RenderController } from "./RenderController";

const RenderControllerContext = createContext<null | RenderController>(null);

export const RenderControllerProvider = RenderControllerContext.Provider;

export const useRenderController = () => {
  const controller = useContext(RenderControllerContext);
  if (!controller) {
    throw new Error("useRenderController must be used within a RenderControllerProvider");
  }
  return controller;
};
