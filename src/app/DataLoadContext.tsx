"use client";

import { createContext } from "react";

export const DataLoadContext = createContext<boolean>(false);

export const DataLoadProvider = DataLoadContext.Provider;
