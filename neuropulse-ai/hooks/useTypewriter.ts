"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// useTypewriter — types out `text` character-by-character, then optionally
// pauses on the finished string (keeps the caret blinking via .type-caret).
//
// Honors prefers-reduced-motion: if the user prefers reduced motion we render
// the full text immediately (no loop, no delay).
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTypewriter(
  text: string,
  opts: { speedMs?: number; startDelayMs?: number } = {}
) {
  const { speedMs = 28, startDelayMs = 350 } = opts;
  const [display, setDisplay] = useState("");
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    setDisplay("");
    setDone(false);
    idxRef.current = 0;

    // Reduced motion: show the full sentence immediately.
    if (prefersReducedMotion()) {
      setDisplay(text);
      setDone(true);
      return;
    }

    let charId: number | undefined;
    const startAt = window.setTimeout(() => {
      charId = window.setInterval(() => {
        idxRef.current += 1;
        setDisplay(text.slice(0, idxRef.current));
        if (idxRef.current >= text.length) {
          if (charId !== undefined) window.clearInterval(charId);
          setDone(true);
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      window.clearTimeout(startAt);
      if (charId !== undefined) window.clearInterval(charId);
    };
  }, [text, speedMs, startDelayMs]);

  return { display, done };
}