"use client";

import type { ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";

type HomeScrollMotionProps = {
  children: ReactNode;
};

export function HomeScrollMotion({ children }: HomeScrollMotionProps) {
  const shouldReduceMotion = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [scrollDepth, setScrollDepth] = useState(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? latest;
    setDirection(latest > previous ? "down" : "up");
    setScrollDepth(latest);
  });

  const glowStyle = useMemo(() => {
    const intensity = Math.min(1, scrollDepth / 1200);
    return {
      opacity: shouldReduceMotion ? 0.18 : 0.12 + intensity * 0.18,
      filter: `blur(${shouldReduceMotion ? 36 : 28 + intensity * 10}px)`
    };
  }, [scrollDepth, shouldReduceMotion]);

  const movingY = direction === "down" ? 18 : -18;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] bg-black/4 dark:bg-white/5">
        <motion.div
          className="h-full origin-left bg-black/20 dark:bg-white/35"
          style={{ scaleX: scrollYProgress }}
          transition={{ duration: 0.12 }}
        />
      </div>
      {children}
    </>
  );
}
