import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@/lib/utils";

import styles from "./Button.module.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "accent" | "active" | "ghost" | "ghostSmooth" | "ghostActive" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "state" | "xs";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(
          styles.Button,
          styles[`${variant}` as keyof typeof styles],
          styles[`size-${size}` as keyof typeof styles],
          props.disabled && styles.Disabled,
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };
