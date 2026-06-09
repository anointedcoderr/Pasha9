// Built by Anointed Coder.
//
// Premium motion variants for the Spin + Lotto modules. Shared so
// every component lands on the same easing curves, timings, and
// reduced-motion fallbacks.

import type { Variants } from 'framer-motion';

// Cubic-bezier curve used across the atelier. "Stage curtain"
// feel: slight overshoot, soft settle.
export const EASE_STAGE = [0.22, 1, 0.36, 1] as const;
export const EASE_GENTLE = [0.4, 0, 0.2, 1] as const;

export const stageVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: EASE_STAGE },
  },
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_STAGE, delay: i * 0.06 },
  }),
};

export const popInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.86 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: EASE_STAGE },
  },
};

export const ribbonUnfurlVariants: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  show: {
    scaleX: 1,
    opacity: 1,
    transition: { duration: 0.55, ease: EASE_STAGE },
  },
};

export const medallionVariants: Variants = {
  hidden: { opacity: 0, scale: 0.7, rotate: -8 },
  show: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.7, ease: EASE_STAGE },
  },
};

// Stagger container helper. Wrap a parent motion.div with this and
// child elements automatically cascade.
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};
