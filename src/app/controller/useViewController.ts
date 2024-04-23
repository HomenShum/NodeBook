"use client";
import { createContext, useContext } from "react";
import { ViewController } from "./ViewController";

const ViewControllerContext = createContext<null | ViewController>(null);

export const ViewControllerProvider = ViewControllerContext.Provider;

export const useViewController = () => {
  const store = useContext(ViewControllerContext);
  if (!store) {
    throw new Error("useViewController must be used within a ViewControllerProvider");
  }
  return store;
};
