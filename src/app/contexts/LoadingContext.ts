import { createContext, useContext } from "react";

export const LoadingContext = createContext(false);

export const useLoading = () => {
  return useContext(LoadingContext);
};
