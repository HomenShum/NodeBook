"use client";
/**
 * Sole motion.dev import surface for the app.
 * Rules: transform/opacity only, every entrance is one-shot, nothing loops.
 */
import { MotionConfig, motion } from "motion/react";
import React from "react";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const RISE_DISTANCE = 14;
const RISE_DURATION = 0.5;

/** Wrap the app once; honors the user's prefers-reduced-motion setting. */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface RiseProps {
  /** Entrance delay in milliseconds (hero stagger: 0/60/140/220/300). */
  delay?: number;
  /** Trigger on scroll into view (once) instead of on mount. */
  inView?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** One-shot fade+rise entrance. Mount-triggered by default, viewport-triggered with `inView`. */
export function Rise({ delay = 0, inView = false, className, style, children }: RiseProps) {
  const transition = { duration: RISE_DURATION, delay: delay / 1000, ease: EASE_OUT_EXPO };
  const hidden = { opacity: 0, y: RISE_DISTANCE };
  const shown = { opacity: 1, y: 0 };

  if (inView) {
    return (
      <motion.div
        className={className}
        style={style}
        initial={hidden}
        whileInView={shown}
        viewport={{ once: true, amount: 0.2 }}
        transition={transition}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div className={className} style={style} initial={hidden} animate={shown} transition={transition}>
      {children}
    </motion.div>
  );
}

type PressButtonProps = React.ComponentPropsWithoutRef<typeof motion.button> & {
  /** Optional one-shot fade+rise entrance delay in milliseconds. */
  riseDelay?: number;
};

/** Primary-action button: spring scale on hover/press, optional one-shot entrance. */
export const PressButton = React.forwardRef<HTMLButtonElement, PressButtonProps>(function PressButton(
  { riseDelay, children, ...rest },
  ref,
) {
  const entrance =
    riseDelay !== undefined
      ? {
          initial: { opacity: 0, y: RISE_DISTANCE },
          animate: { opacity: 1, y: 0 },
          transition: { duration: RISE_DURATION, delay: riseDelay / 1000, ease: EASE_OUT_EXPO },
        }
      : {};
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.03, transition: { type: "spring", stiffness: 400, damping: 17 } }}
      whileTap={{ scale: 0.96, transition: { type: "spring", stiffness: 400, damping: 17 } }}
      {...entrance}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
