import { HTMLAttributes, ReactNode } from "react";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ScrollArea(props: ScrollAreaProps): JSX.Element;
