"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useReferenceSelector } from "@/components/brainprint/BandPowerComparison";
import { BrainprintRecognitionResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// App-wide Brainprint session context.
//
// BrainprintView owns a lot of state that lives on the /brainprint page
// (which unmounts on navigation), so any scan/verification result or selected
// reference subject is lost the moment the user leaves. This provider sits
// above the route in the root layout and survives navigation, keeping:
//
//   1. `verifiedProfile` — the most recent VERIFIED (recognized) scan result,
//      kept until the user re-scans or logs out. An unrecognized scan is NOT
//      persisted: it is a transient result the user either registers or walks
//      away from, so it resets if they navigate mid-flow.
//
//   2. `refSelector` — the lifted reference-data selector. By calling
//      useReferenceSelector() here (instead of inside BrainprintView) the
//      selected sleep stage / subject and its fetched subjects/aggregates
//      survive navigation instead of re-fetching from defaults on every visit.
//
// This is the same "persistent provider above the route" pattern already used
// by AuthProvider, EEGProvider, and AppStatusContext (DashboardShell).
// ---------------------------------------------------------------------------

export type VerifiedBrainprintProfile = {
  result: Extract<BrainprintRecognitionResult, { status: "recognized" }>;
  verifiedAt: string;
};

const BrainprintContext = createContext<{
  verifiedProfile: VerifiedBrainprintProfile | null;
  setVerifiedProfile: (result: VerifiedBrainprintProfile["result"], verifiedAt: string) => void;
  clearVerifiedProfile: () => void;
  refSelector: ReturnType<typeof useReferenceSelector>;
} | null>(null);

export function BrainprintProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  // 1. Persist the verified (recognized) profile result across navigation.
  const [verifiedProfile, setVerifiedProfileState] =
    useState<VerifiedBrainprintProfile | null>(null);

  // 2. Lift the reference selector so its selected stage/subject + fetched
  //    data persist across navigation (it never unmounts while in the layout).
  const refSelector = useReferenceSelector();

  // Reset on logout / auth transition to not-authenticated. The provider sits
  // above the app shell, so it isn't unmounted by a logout — without this the
  // previous user's verified profile would linger for the next user.
  useEffect(() => {
    if (!isAuthenticated) {
      setVerifiedProfileState(null);
    }
  }, [isAuthenticated]);

  const setVerifiedProfile = (
    result: VerifiedBrainprintProfile["result"],
    verifiedAt: string
  ) => {
    setVerifiedProfileState({ result, verifiedAt });
  };

  const clearVerifiedProfile = () => {
    setVerifiedProfileState(null);
  };

  return (
    <BrainprintContext.Provider
      value={{ verifiedProfile, setVerifiedProfile, clearVerifiedProfile, refSelector }}
    >
      {children}
    </BrainprintContext.Provider>
  );
}

export function useBrainprintContext() {
  const ctx = useContext(BrainprintContext);
  if (!ctx) {
    throw new Error("useBrainprintContext must be used within BrainprintProvider");
  }
  return ctx;
}