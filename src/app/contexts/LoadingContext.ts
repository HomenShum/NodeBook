import { createContext, useContext } from "react";

export type LoadingContextType = {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
};

export const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  setIsLoading: () => {},
});

export const useLoading = () => {
  return useContext(LoadingContext).isLoading;
};

export const useSetLoading = () => {
  return useContext(LoadingContext).setIsLoading;
};
