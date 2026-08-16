"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// PageTransition — Smooth morphing / zoom fade between pages
//
// Uses AnimatePresence with Framer Motion to create a cinematic page
// transition: the outgoing page zooms out and fades, then the incoming
// page zooms in from the center.
// ---------------------------------------------------------------------------

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.04 }}
        transition={{
          duration: 0.35,
          ease: [0.25, 0.1, 0.25, 1], // cubic-bezier
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
