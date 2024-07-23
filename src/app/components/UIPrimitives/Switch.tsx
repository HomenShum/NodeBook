import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils";

import styles from "./Switch.module.css";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root className={cn(styles.Switch, className)} {...props} ref={ref}>
    <SwitchPrimitive.Thumb className={styles.SwitchThumb} />
  </SwitchPrimitive.Root>
));

Switch.displayName = "Switch";

export { Switch };
