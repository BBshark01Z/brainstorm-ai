"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EEGSample, FileIngestionResult } from "@/lib/types";
import { parseUploadedFile, parseCsv, parseJson, parseRawArrayText } from "@/lib/dataIngestion";

const PLAYBACK_INTERVAL_MS = 150;

export function useFileIngestion(active: boolean) {
  const [result, setResult] = useState<FileIngestionResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [sample, setSample] = useState<EEGSample | null>(null);

  const loadFile = useCallback(async (file: File) => {
    const parsed = await parseUploadedFile(file);
    setResult(parsed);
    setCursor(0);
    setIsPlaying(parsed.samples.length > 0);
  }, []);

  const loadPastedText = useCallback((text: string, format: "csv" | "json" | "raw") => {
    const { samples, warnings } =
      format === "csv" ? parseCsv(text) : format === "json" ? parseJson(text) : parseRawArrayText(text);
    setResult({ format, samples, sourceName: "Pasted text", warnings });
    setCursor(0);
    setIsPlaying(samples.length > 0);
  }, []);

  useEffect(() => {
    if (!active || !isPlaying || !result || result.samples.length === 0) return;

    const intervalId = setInterval(() => {
      setCursor((prev) => {
        const next = (prev + 1) % result.samples.length; // loop playback
        setSample(result.samples[next]);
        return next;
      });
    }, PLAYBACK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [active, isPlaying, result]);

  return {
    result,
    isPlaying,
    setIsPlaying,
    cursor,
    sample,
    loadFile,
    loadPastedText,
  };
}
